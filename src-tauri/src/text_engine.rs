use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

const HEALTH_TIMEOUT_SECS: u64 = 60;
const IDLE_REAP_SECS: u64 = 300; // Automatically free RAM after 5 minutes of inactivity

pub struct TextEngineInner {
  process: Mutex<Option<Child>>,
  port: Mutex<Option<u16>>,
  model_path: Mutex<Option<String>>,
  cancelled: Mutex<HashSet<String>>,
  last_used: Mutex<Option<Instant>>,
  active_requests: Mutex<usize>,
}

#[derive(Clone)]
pub struct TextEngineState {
  inner: Arc<TextEngineInner>,
}

impl Default for TextEngineState {
  fn default() -> Self {
    Self {
      inner: Arc::new(TextEngineInner {
        process: Mutex::new(None),
        port: Mutex::new(None),
        model_path: Mutex::new(None),
        cancelled: Mutex::new(HashSet::new()),
        last_used: Mutex::new(None),
        active_requests: Mutex::new(0),
      }),
    }
  }
}

#[derive(Serialize, Clone)]
pub struct EngineStatus {
  pub running: bool,
  pub model_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatMessagePayload {
  pub role: String,
  pub content: String,
}

#[derive(Deserialize, Default)]
pub struct GenerationSettings {
  pub temperature: Option<f32>,
  pub top_p: Option<f32>,
  pub top_k: Option<i32>,
  pub max_tokens: Option<i32>,
  pub seed: Option<i64>,
  pub messages: Option<Vec<ChatMessagePayload>>,
  pub system_prompt: Option<String>,
}

#[derive(Serialize, Clone)]
struct TokenEvent {
  request_id: String,
  token: String,
}

#[derive(Serialize, Clone)]
struct DoneEvent {
  request_id: String,
}

#[derive(Serialize, Clone)]
struct ErrorEvent {
  request_id: String,
  message: String,
}

fn find_free_port() -> Result<u16, String> {
  let listener =
    TcpListener::bind("127.0.0.1:0").map_err(|e| format!("failed to find a free port: {e}"))?;
  Ok(listener.local_addr().map_err(|e| e.to_string())?.port())
}

fn llama_server_path(app: &AppHandle) -> Result<PathBuf, String> {
  let exe_name = if cfg!(windows) {
    "llama-server.exe"
  } else {
    "llama-server"
  };
  let sub = format!("llama/{exe_name}");
  crate::paths::resolve_resource(app, &sub)
}

fn stop_locked(inner: &TextEngineInner) {
  if let Ok(mut guard) = inner.process.lock() {
    if let Some(mut child) = guard.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
  if let Ok(mut port) = inner.port.lock() {
    *port = None;
  }
  if let Ok(mut model_path) = inner.model_path.lock() {
    *model_path = None;
  }
  if let Ok(mut last_used) = inner.last_used.lock() {
    *last_used = None;
  }
}

fn spawn_idle_reaper(inner: Arc<TextEngineInner>) {
  tokio::spawn(async move {
    loop {
      tokio::time::sleep(Duration::from_secs(30)).await;
      let should_reap = {
        let has_model = inner
          .model_path
          .lock()
          .map(|m| m.is_some())
          .unwrap_or(false);
        if !has_model {
          break;
        }
        let active = inner.active_requests.lock().map(|c| *c).unwrap_or(0);
        let idle_expired = inner
          .last_used
          .lock()
          .ok()
          .and_then(|t| *t)
          .map(|t| t.elapsed() >= Duration::from_secs(IDLE_REAP_SECS))
          .unwrap_or(false);
        active == 0 && idle_expired
      };
      if should_reap {
        log::info!("Text engine idle for {IDLE_REAP_SECS}s — stopping llama-server to free RAM");
        stop_locked(&inner);
        break;
      }
    }
  });
}

#[tauri::command]
pub async fn start_text_engine(
  app: AppHandle,
  state: State<'_, TextEngineState>,
  model_path: String,
) -> Result<(), String> {
  // Already running the requested model — check process is still alive.
  if let Ok(current) = state.inner.model_path.lock() {
    if current.as_deref() == Some(model_path.as_str()) {
      let alive = state
        .inner
        .process
        .lock()
        .ok()
        .and_then(|mut g| g.as_mut().and_then(|c| c.try_wait().ok()))
        .map(|status| status.is_none())
        .unwrap_or(false);
      if alive {
        if let Ok(mut last) = state.inner.last_used.lock() {
          *last = Some(Instant::now());
        }
        return Ok(());
      }
    }
  }

  stop_locked(&state.inner);

  let server_path = llama_server_path(&app)?;
  if !server_path.exists() {
    return Err(format!(
      "llama-server binary not found at {}",
      server_path.display()
    ));
  }
  if !PathBuf::from(&model_path).exists() {
    return Err(format!("model file not found at {model_path}"));
  }

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(meta) = std::fs::metadata(&server_path) {
      let mut perms = meta.permissions();
      if perms.mode() & 0o111 == 0 {
        perms.set_mode(perms.mode() | 0o755);
        let _ = std::fs::set_permissions(&server_path, perms);
      }
    }
  }

  let port = find_free_port()?;
  let cores = std::thread::available_parallelism()
    .map(|n| n.get())
    .unwrap_or(4);
  let is_apple_silicon = cfg!(all(target_os = "macos", target_arch = "aarch64"));
  let threads = crate::system_info::compute_optimal_threads(cores, is_apple_silicon);

  let mut cmd = Command::new(&server_path);
  if let Some(parent) = server_path.parent() {
    cmd.current_dir(parent);
    #[cfg(target_os = "macos")]
    cmd.env("DYLD_LIBRARY_PATH", parent);
    #[cfg(target_os = "linux")]
    cmd.env("LD_LIBRARY_PATH", parent);
  }
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }

  #[allow(unused_mut)]
  let mut args = vec![
    "-m".to_string(),
    model_path.clone(),
    "--port".to_string(),
    port.to_string(),
    "--host".to_string(),
    "127.0.0.1".to_string(),
    "-c".to_string(),
    "4096".to_string(),
    "-t".to_string(),
    threads.to_string(),
    "--no-webui".to_string(),
  ];

  // Offload all layers to Apple Metal GPU on macOS for ultra-fast, low-CPU inference
  #[cfg(target_os = "macos")]
  {
    args.push("-ngl".to_string());
    args.push("99".to_string());
  }

  let mut child = cmd
    .args(&args)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("failed to start llama-server: {e}"))?;

  // Drain stderr continuously in a background thread so the 64KB OS pipe buffer
  // never fills up and deadlocks llama-server during model load or inference,
  // while keeping the latest stderr lines for diagnostics if startup fails.
  let stderr_log = Arc::new(Mutex::new(String::new()));
  if let Some(err_pipe) = child.stderr.take() {
    let log_clone = stderr_log.clone();
    std::thread::spawn(move || {
      use std::io::{BufRead, BufReader};
      let reader = BufReader::new(err_pipe);
      for line in reader.lines().map_while(Result::ok) {
        if let Ok(mut buf) = log_clone.lock() {
          if buf.len() > 4096 {
            let drain_to = buf.len() - 2048;
            buf.drain(..drain_to);
          }
          if !buf.is_empty() {
            buf.push('\n');
          }
          buf.push_str(&line);
        }
      }
    });
  }

  *state.inner.process.lock().map_err(|e| e.to_string())? = Some(child);
  *state.inner.port.lock().map_err(|e| e.to_string())? = Some(port);

  // Poll /health until the server has finished loading the model.
  let client = reqwest::Client::new();
  let health_url = format!("http://127.0.0.1:{port}/health");
  let deadline = std::time::Instant::now() + Duration::from_secs(HEALTH_TIMEOUT_SECS);
  loop {
    if std::time::Instant::now() > deadline {
      stop_locked(&state.inner);
      return Err("timed out waiting for the model to load".to_string());
    }
    match client.get(&health_url).send().await {
      Ok(resp) if resp.status().is_success() => break,
      _ => {
        // If the process already exited (e.g. invalid model file), fail fast with stderr details.
        let premature_exit = {
          let mut guard = state.inner.process.lock().map_err(|e| e.to_string())?;
          if let Some(child) = guard.as_mut() {
            if let Ok(Some(status)) = child.try_wait() {
              *guard = None;
              let stderr_msg = stderr_log
                .lock()
                .map(|b| b.trim().to_string())
                .unwrap_or_default();
              let details = if stderr_msg.is_empty() {
                format!("process exited with status {status}")
              } else {
                stderr_msg
              };
              Some(details)
            } else {
              None
            }
          } else {
            None
          }
        };

        if let Some(details) = premature_exit {
          return Err(format!("llama-server failed to load model: {details}"));
        }

        tokio::time::sleep(Duration::from_millis(200)).await;
      }
    }
  }

  *state.inner.model_path.lock().map_err(|e| e.to_string())? = Some(model_path);
  *state.inner.last_used.lock().map_err(|e| e.to_string())? = Some(Instant::now());
  spawn_idle_reaper(state.inner.clone());
  Ok(())
}

#[tauri::command]
pub fn stop_text_engine(state: State<'_, TextEngineState>) -> Result<(), String> {
  stop_locked(&state.inner);
  Ok(())
}

#[tauri::command]
pub fn text_engine_status(state: State<'_, TextEngineState>) -> Result<EngineStatus, String> {
  let alive = state
    .inner
    .process
    .lock()
    .ok()
    .and_then(|mut g| g.as_mut().and_then(|c| c.try_wait().ok()))
    .map(|status| status.is_none())
    .unwrap_or(false);
  if !alive {
    stop_locked(&state.inner);
  }
  let model_path = state.inner.model_path.lock().map_err(|e| e.to_string())?.clone();
  Ok(EngineStatus {
    running: model_path.is_some(),
    model_path,
  })
}

#[tauri::command]
pub fn cancel_generation(
  state: State<'_, TextEngineState>,
  request_id: String,
) -> Result<(), String> {
  state
    .inner
    .cancelled
    .lock()
    .map_err(|e| e.to_string())?
    .insert(request_id);
  Ok(())
}

#[tauri::command]
pub async fn generate_text(
  app: AppHandle,
  state: State<'_, TextEngineState>,
  request_id: String,
  prompt: String,
  settings: GenerationSettings,
) -> Result<(), String> {
  let port = state
    .inner
    .port
    .lock()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "text engine is not running".to_string())?;

  if let Ok(mut last) = state.inner.last_used.lock() {
    *last = Some(Instant::now());
  }
  if let Ok(mut active) = state.inner.active_requests.lock() {
    *active += 1;
  }

  let mut msg_array: Vec<serde_json::Value> = Vec::new();

  let system_content = settings.system_prompt.unwrap_or_else(|| {
    "You are Second Brain, a smart, relaxed, and witty AI companion. You talk like an insightful, chill friend — great for day-to-day conversation, humor, creative ideas, and timepass. Keep answers engaging, natural, and concise without sounding robotic, preachy, or corporate.".to_string()
  });

  if !system_content.trim().is_empty() {
    msg_array.push(serde_json::json!({
      "role": "system",
      "content": system_content.trim()
    }));
  }

  if let Some(history) = settings.messages.filter(|m| !m.is_empty()) {
    let len = history.len();
    for (idx, msg) in history.into_iter().enumerate() {
      // Always use the augmented prompt for the final user turn so tool outputs
      // and structured formatting instructions reach llama-server.
      let content = if idx + 1 == len && msg.role == "user" && !prompt.trim().is_empty() {
        prompt.clone()
      } else {
        msg.content
      };
      msg_array.push(serde_json::json!({
        "role": msg.role,
        "content": content
      }));
    }
  } else {
    msg_array.push(serde_json::json!({
      "role": "user",
      "content": prompt
    }));
  }

  let mut body = serde_json::json!({
    "model": "local",
    "messages": msg_array,
    "stream": true,
    "repeat_penalty": 1.15,
    "frequency_penalty": 0.2,
    "presence_penalty": 0.1,
    "repeat_last_n": 256,
    // DRY sampler: strongly discourages verbatim loops of repeated sentences/paragraphs
    "dry_multiplier": 0.8,
    "dry_base": 1.75,
    "dry_allowed_length": 3,
  });
  if let Some(temperature) = settings.temperature {
    body["temperature"] = serde_json::json!(temperature);
  }
  if let Some(top_p) = settings.top_p {
    body["top_p"] = serde_json::json!(top_p);
  }
  if let Some(top_k) = settings.top_k {
    body["top_k"] = serde_json::json!(top_k);
  }
  if let Some(max_tokens) = settings.max_tokens {
    body["max_tokens"] = serde_json::json!(max_tokens);
  }
  if let Some(seed) = settings.seed {
    body["seed"] = serde_json::json!(seed);
  }

  let client = reqwest::Client::new();
  let url = format!("http://127.0.0.1:{port}/v1/chat/completions");

  let response = match client.post(&url).json(&body).send().await {
    Ok(r) => r,
    Err(e) => {
      if let Ok(mut active) = state.inner.active_requests.lock() {
        *active = active.saturating_sub(1);
      }
      let _ = app.emit(
        "text-engine:error",
        ErrorEvent {
          request_id: request_id.clone(),
          message: format!("request failed: {e}"),
        },
      );
      return Err(format!("request failed: {e}"));
    }
  };

  use futures_util::StreamExt;
  let mut stream = response.bytes_stream();
  let mut buffer = String::new();

  'outer: while let Some(chunk) = stream.next().await {
    if state
      .inner
      .cancelled
      .lock()
      .map_err(|e| e.to_string())?
      .remove(&request_id)
    {
      break;
    }

    let bytes = match chunk {
      Ok(b) => b,
      Err(e) => {
        if let Ok(mut active) = state.inner.active_requests.lock() {
          *active = active.saturating_sub(1);
        }
        let _ = app.emit(
          "text-engine:error",
          ErrorEvent {
            request_id: request_id.clone(),
            message: format!("stream error: {e}"),
          },
        );
        return Err(format!("stream error: {e}"));
      }
    };
    buffer.push_str(&String::from_utf8_lossy(&bytes));

    while let Some(pos) = buffer.find("\n\n") {
      let event = buffer[..pos].to_string();
      buffer.drain(..pos + 2);

      let Some(data) = event.strip_prefix("data: ") else {
        continue;
      };
      if data.trim() == "[DONE]" {
        break 'outer;
      }

      if let Ok(value) = serde_json::from_str::<serde_json::Value>(data) {
        if let Some(token) = value["choices"][0]["delta"]["content"].as_str() {
          let _ = app.emit(
            "text-engine:token",
            TokenEvent {
              request_id: request_id.clone(),
              token: token.to_string(),
            },
          );
        }
      }
    }
  }

  if let Ok(mut last) = state.inner.last_used.lock() {
    *last = Some(Instant::now());
  }
  if let Ok(mut active) = state.inner.active_requests.lock() {
    *active = active.saturating_sub(1);
  }

  let _ = app.emit(
    "text-engine:done",
    DoneEvent {
      request_id: request_id.clone(),
    },
  );
  Ok(())
}
