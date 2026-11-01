use futures_util::StreamExt;
use serde::Serialize;
use std::fs::OpenOptions;
use std::io::{Seek, SeekFrom, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Default)]
pub struct DownloadState {
  active: Mutex<Option<(String, Arc<AtomicBool>)>>,
}

#[derive(Clone, Serialize)]
pub struct DownloadProgressPayload {
  pub id: String,
  pub downloaded_bytes: u64,
  pub total_bytes: Option<u64>,
}

#[tauri::command]
pub async fn download_model(
  app: AppHandle,
  state: State<'_, DownloadState>,
  id: String,
  url: String,
  filename: String,
) -> Result<String, String> {
  let cancel = Arc::new(AtomicBool::new(false));
  {
    let mut lock = state.active.lock().map_err(|e| e.to_string())?;
    *lock = Some((id.clone(), cancel.clone()));
  }

  let models_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("models");
  std::fs::create_dir_all(&models_dir).map_err(|e| format!("failed to create models dir: {e}"))?;

  let dest_path = models_dir.join(&filename);
  let temp_path = models_dir.join(format!("{filename}.download"));

  // Build resilient client with keepalive and browser user-agent
  let client = reqwest::Client::builder()
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 SecondBrain/0.1.0")
    .tcp_keepalive(Some(Duration::from_secs(15)))
    .connect_timeout(Duration::from_secs(30))
    .build()
    .map_err(|e| format!("failed to create HTTP client: {e}"))?;

  let mut total_bytes: Option<u64> = None;
  let mut last_emit = Instant::now();
  let max_retries = 8;
  let mut retry_count = 0;

  loop {
    if cancel.load(Ordering::Relaxed) {
      let _ = std::fs::remove_file(&temp_path);
      let mut lock = state.active.lock().map_err(|e| e.to_string())?;
      *lock = None;
      return Err("download cancelled".to_string());
    }

    // Determine how many bytes we already have on disk
    let existing_len = if temp_path.exists() {
      std::fs::metadata(&temp_path).map(|m| m.len()).unwrap_or(0)
    } else {
      0
    };

    if let Some(total) = total_bytes {
      if existing_len >= total && total > 0 {
        break;
      }
    }

    let mut req = client.get(&url);
    if existing_len > 0 {
      req = req.header("Range", format!("bytes={existing_len}-"));
    }

    let res = match req.send().await {
      Ok(r) => r,
      Err(e) => {
        retry_count += 1;
        if retry_count > max_retries {
          let _ = state.active.lock().map(|mut l| *l = None);
          return Err(format!("network error connecting to download: {e}"));
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
        continue;
      }
    };

    let status = res.status();
    if !status.is_success() && status.as_u16() != 206 {
      retry_count += 1;
      if retry_count > max_retries {
        let _ = state.active.lock().map(|mut l| *l = None);
        return Err(format!("download request failed with HTTP {status}"));
      }
      tokio::time::sleep(Duration::from_secs(2)).await;
      continue;
    }

    // Determine total length from Content-Length or Content-Range
    if status.as_u16() == 206 {
      if let Some(cr) = res.headers().get("content-range").and_then(|h| h.to_str().ok()) {
        if let Some(slash_idx) = cr.rfind('/') {
          if let Ok(tot) = cr[slash_idx + 1..].trim().parse::<u64>() {
            total_bytes = Some(tot);
          }
        }
      }
      if total_bytes.is_none() {
        if let Some(cl) = res.content_length() {
          total_bytes = Some(existing_len + cl);
        }
      }
    } else {
      total_bytes = res.content_length();
    }

    let is_resuming = status.as_u16() == 206;
    let mut file = match OpenOptions::new()
      .create(true)
      .write(true)
      .truncate(!is_resuming)
      .open(&temp_path)
    {
      Ok(f) => f,
      Err(e) => {
        let _ = state.active.lock().map(|mut l| *l = None);
        return Err(format!("failed to open destination file: {e}"));
      }
    };

    if is_resuming {
      if let Err(e) = file.seek(SeekFrom::End(0)) {
        let _ = state.active.lock().map(|mut l| *l = None);
        return Err(format!("failed to seek to end of file: {e}"));
      }
    }

    let mut current_downloaded = if is_resuming { existing_len } else { 0 };
    let mut stream = res.bytes_stream();
    let mut stream_failed = false;

    while let Some(chunk_result) = stream.next().await {
      if cancel.load(Ordering::Relaxed) {
        drop(file);
        let _ = std::fs::remove_file(&temp_path);
        let mut lock = state.active.lock().map_err(|e| e.to_string())?;
        *lock = None;
        return Err("download cancelled".to_string());
      }

      match chunk_result {
        Ok(chunk) => {
          if let Err(e) = file.write_all(&chunk) {
            let _ = state.active.lock().map(|mut l| *l = None);
            return Err(format!("failed to write data to disk: {e}"));
          }
          current_downloaded += chunk.len() as u64;
          retry_count = 0; // data is actively flowing

          if last_emit.elapsed().as_millis() >= 200 {
            let _ = app.emit(
              "model-download:progress",
              DownloadProgressPayload {
                id: id.clone(),
                downloaded_bytes: current_downloaded,
                total_bytes,
              },
            );
            last_emit = Instant::now();
          }
        }
        Err(_err) => {
          stream_failed = true;
          break;
        }
      }
    }

    let _ = file.flush();
    drop(file);

    if stream_failed {
      retry_count += 1;
      if retry_count > max_retries {
        let _ = state.active.lock().map(|mut l| *l = None);
        return Err("download interrupted: network connection dropped repeatedly".to_string());
      }
      tokio::time::sleep(Duration::from_millis(1500)).await;
      continue;
    }

    break;
  }

  std::fs::rename(&temp_path, &dest_path)
    .map_err(|e| format!("failed to finalize downloaded file: {e}"))?;

  let final_size = std::fs::metadata(&dest_path).map(|m| m.len()).unwrap_or(0);
  let _ = app.emit(
    "model-download:progress",
    DownloadProgressPayload {
      id: id.clone(),
      downloaded_bytes: final_size,
      total_bytes: Some(final_size),
    },
  );

  let mut lock = state.active.lock().map_err(|e| e.to_string())?;
  *lock = None;

  Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn cancel_model_download(state: State<'_, DownloadState>, id: String) -> Result<(), String> {
  let mut lock = state.active.lock().map_err(|e| e.to_string())?;
  if let Some((active_id, cancel)) = lock.take() {
    if active_id == id {
      cancel.store(true, Ordering::Relaxed);
    }
  }
  Ok(())
}
