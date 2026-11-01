use serde::Serialize;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::process::Command;
use tokio::sync::Notify;

struct ActiveGeneration {
  request_id: String,
  cancel: Arc<Notify>,
}

struct ServerInstance {
  child: tokio::process::Child,
  model_path: String,
  port: u16,
  last_used: Instant,
}

#[derive(Default)]
pub struct ImageEngineState {
  active: Mutex<Option<ActiveGeneration>>,
  server: tokio::sync::Mutex<Option<ServerInstance>>,
}

#[derive(Serialize, Clone)]
pub struct ImageEngineStatus {
  pub available: bool,
  pub busy: bool,
  pub warm_model: Option<String>,
}

#[derive(Serialize, Clone)]
struct ImageDoneEvent {
  request_id: String,
  file_path: String,
}

#[derive(Serialize, Clone)]
struct ImageErrorEvent {
  request_id: String,
  message: String,
}

fn sd_cli_path(app: &AppHandle) -> Result<PathBuf, String> {
  let exe_name = if cfg!(windows) { "sd-cli.exe" } else { "sd-cli" };
  let sub = format!("sd/{exe_name}");
  crate::paths::resolve_resource(app, &sub)
}

fn sd_server_path(app: &AppHandle) -> Result<PathBuf, String> {
  let exe_name = if cfg!(windows) { "sd-server.exe" } else { "sd-server" };
  let sub = format!("sd/{exe_name}");
  crate::paths::resolve_resource(app, &sub)
}

fn images_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("failed to resolve app data directory: {e}"))?
    .join("images");
  std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create images directory: {e}"))?;
  Ok(dir)
}

fn optimal_thread_count() -> i32 {
  // Clamp thread count to 4 (range 2..=4).
  // On hybrid architectures (Intel Alder Lake / Raptor Lake with P-cores & E-cores,
  // AMD multi-CCX, and Apple Silicon), saturating all logical threads causes severe
  // thermal throttling (dropping clocks from ~4.5GHz to ~1.8GHz) and excessive fan noise.
  // Limiting computation to 4 threads keeps the CPU whisper cool, prevents throttling,
  // and paradoxically finishes generations significantly faster.
  std::thread::available_parallelism()
    .map(|n| (n.get() as i32).clamp(2, 4))
    .unwrap_or(4)
}

fn find_free_port() -> Result<u16, String> {
  let listener = TcpListener::bind("127.0.0.1:0")
    .map_err(|e| format!("failed to find free port for image server: {e}"))?;
  let port = listener
    .local_addr()
    .map_err(|e| format!("failed to read port: {e}"))?
    .port();
  drop(listener);
  Ok(port)
}

#[tauri::command]
pub async fn image_engine_status(
  app: AppHandle,
  state: State<'_, ImageEngineState>,
) -> Result<ImageEngineStatus, String> {
  let available = sd_server_path(&app).map(|p| p.exists()).unwrap_or(false)
    || sd_cli_path(&app).map(|p| p.exists()).unwrap_or(false);
  let busy = state.active.lock().map_err(|e| e.to_string())?.is_some();
  let warm_guard = state.server.lock().await;
  let warm_model = warm_guard.as_ref().map(|s| s.model_path.clone());
  Ok(ImageEngineStatus {
    available,
    busy,
    warm_model,
  })
}

#[tauri::command]
pub async fn stop_image_engine(state: State<'_, ImageEngineState>) -> Result<(), String> {
  let mut guard = state.server.lock().await;
  if let Some(mut inst) = guard.take() {
    let _ = inst.child.start_kill();
    let _ = inst.child.wait().await;
  }
  Ok(())
}

#[tauri::command]
pub fn cancel_image_generation(
  state: State<'_, ImageEngineState>,
  request_id: String,
) -> Result<(), String> {
  let guard = state.active.lock().map_err(|e| e.to_string())?;
  if let Some(active) = guard.as_ref() {
    if active.request_id == request_id {
      active.cancel.notify_one();
    }
  }
  Ok(())
}

#[tauri::command]
pub fn read_image_data_url(app: AppHandle, path: String) -> Result<String, String> {
  let dir = images_dir(&app)?;
  let requested = PathBuf::from(&path);
  let canonical_dir = dir.canonicalize().map_err(|e| e.to_string())?;
  let canonical_file = requested
    .canonicalize()
    .map_err(|_| "image file not found".to_string())?;
  if !canonical_file.starts_with(&canonical_dir) {
    return Err("access denied".to_string());
  }
  let bytes = std::fs::read(&canonical_file).map_err(|e| format!("failed to read image: {e}"))?;
  Ok(format!(
    "data:image/png;base64,{}",
    base64_encode(&bytes)
  ))
}

fn base64_encode(bytes: &[u8]) -> String {
  const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
  for chunk in bytes.chunks(3) {
    let b0 = chunk[0];
    let b1 = *chunk.get(1).unwrap_or(&0);
    let b2 = *chunk.get(2).unwrap_or(&0);
    out.push(CHARS[(b0 >> 2) as usize] as char);
    out.push(CHARS[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
    out.push(if chunk.len() > 1 {
      CHARS[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char
    } else {
      '='
    });
    out.push(if chunk.len() > 2 {
      CHARS[(b2 & 0x3f) as usize] as char
    } else {
      '='
    });
  }
  out
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
  let mut out = Vec::with_capacity(input.len() * 3 / 4);
  let mut buf: u32 = 0;
  let mut bits: u32 = 0;
  for b in input.bytes() {
    let val = match b {
      b'A'..=b'Z' => b - b'A',
      b'a'..=b'z' => b - b'a' + 26,
      b'0'..=b'9' => b - b'0' + 52,
      b'+' => 62,
      b'/' => 63,
      b'=' | b'\r' | b'\n' | b' ' => continue,
      _ => return Err("invalid base64 byte".to_string()),
    };
    buf = (buf << 6) | (val as u32);
    bits += 6;
    if bits >= 8 {
      bits -= 8;
      out.push((buf >> bits) as u8);
      buf &= (1 << bits) - 1;
    }
  }
  Ok(out)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn generate_image(
  app: AppHandle,
  state: State<'_, ImageEngineState>,
  request_id: String,
  model_path: String,
  prompt: String,
  negative_prompt: Option<String>,
  width: i32,
  height: i32,
  steps: i32,
  seed: Option<i64>,
  cfg_scale: Option<f32>,
  sampling_method: Option<String>,
) -> Result<String, String> {
  let cancel = Arc::new(Notify::new());
  {
    let mut guard = state.active.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
      return Err("an image is already generating".to_string());
    }
    *guard = Some(ActiveGeneration {
      request_id: request_id.clone(),
      cancel: cancel.clone(),
    });
  }

  let outcome = generate_with_server_or_cli(
    &app,
    &state,
    &model_path,
    &prompt,
    negative_prompt.as_deref(),
    width,
    height,
    steps,
    seed,
    cfg_scale,
    sampling_method.as_deref(),
    cancel,
  )
  .await;

  *state.active.lock().map_err(|e| e.to_string())? = None;

  match &outcome {
    Ok(file_path) => {
      let _ = app.emit(
        "image-engine:done",
        ImageDoneEvent {
          request_id: request_id.clone(),
          file_path: file_path.clone(),
        },
      );
    }
    Err(message) => {
      let _ = app.emit(
        "image-engine:error",
        ImageErrorEvent {
          request_id: request_id.clone(),
          message: message.clone(),
        },
      );
    }
  }

  outcome
}

#[allow(clippy::too_many_arguments)]
async fn generate_with_server_or_cli(
  app: &AppHandle,
  state: &State<'_, ImageEngineState>,
  model_path: &str,
  prompt: &str,
  negative_prompt: Option<&str>,
  width: i32,
  height: i32,
  steps: i32,
  seed: Option<i64>,
  cfg_scale: Option<f32>,
  sampling_method: Option<&str>,
  cancel: Arc<Notify>,
) -> Result<String, String> {
  let sd_server = sd_server_path(app)?;
  if sd_server.exists() {
    match generate_via_server(
      app,
      state,
      &sd_server,
      model_path,
      prompt,
      negative_prompt,
      width,
      height,
      steps,
      seed,
      cfg_scale,
      sampling_method,
      cancel.clone(),
    )
    .await
    {
      Ok(path) => return Ok(path),
      Err(err) => {
        log::warn!("sd-server failed, falling back to sd-cli: {err}");
      }
    }
  }

  // Fallback to sd-cli
  run_cli_generation(
    app,
    model_path,
    prompt,
    negative_prompt,
    width,
    height,
    steps,
    seed,
    cfg_scale,
    sampling_method,
    cancel,
  )
  .await
}

#[allow(clippy::too_many_arguments)]
async fn generate_via_server(
  app: &AppHandle,
  state: &State<'_, ImageEngineState>,
  sd_server: &PathBuf,
  model_path: &str,
  prompt: &str,
  negative_prompt: Option<&str>,
  width: i32,
  height: i32,
  steps: i32,
  seed: Option<i64>,
  cfg_scale: Option<f32>,
  sampling_method: Option<&str>,
  cancel: Arc<Notify>,
) -> Result<String, String> {
  let port = {
    let mut guard = state.server.lock().await;
    let needs_spawn = match guard.as_mut() {
      Some(inst) => {
        if inst.model_path != model_path || inst.child.try_wait().map(|s| s.is_some()).unwrap_or(true) {
          let _ = inst.child.start_kill();
          let _ = inst.child.wait().await;
          true
        } else {
          inst.last_used = Instant::now();
          false
        }
      }
      None => true,
    };

    if needs_spawn {
      let p = find_free_port()?;
      let threads = optimal_thread_count();
      let mut cmd = Command::new(sd_server);
      if let Some(parent) = sd_server.parent() {
        cmd.current_dir(parent);
      }
      #[cfg(windows)]
      {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
      }
      cmd.args([
        "-m",
        model_path,
        "-l",
        "127.0.0.1",
        "--listen-port",
        &p.to_string(),
        "-t",
        &threads.to_string(),
        "--mmap",
      ]);
      cmd
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

      let child = cmd.spawn().map_err(|e| format!("failed to start sd-server: {e}"))?;
      *guard = Some(ServerInstance {
        child,
        model_path: model_path.to_string(),
        port: p,
        last_used: Instant::now(),
      });

      // Poll until server is ready (up to 45s)
      let client = reqwest::Client::new();
      let mut ready = false;
      let start_poll = Instant::now();
      while start_poll.elapsed() < Duration::from_secs(45) {
        if client.get(format!("http://127.0.0.1:{p}/v1/models")).send().await.is_ok() {
          ready = true;
          break;
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
      }
      if !ready {
        return Err("sd-server timed out waiting to become ready".to_string());
      }
      p
    } else {
      guard.as_ref().unwrap().port
    }
  };

  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(480))
    .build()
    .map_err(|e| e.to_string())?;

  let is_lcm = sampling_method.map(|s| s.eq_ignore_ascii_case("lcm")).unwrap_or(false)
    || model_path.to_lowercase().contains("lcm");

  let default_neg = "deformed, distorted, disfigured, poorly drawn, bad anatomy, mutated, extra limbs, blurry, out of focus, duplicate, low quality";
  let neg = negative_prompt.filter(|s| !s.trim().is_empty()).unwrap_or(default_neg);
  let default_cfg = if is_lcm { 1.8 } else { 7.0 };
  let effective_cfg = cfg_scale.unwrap_or(default_cfg);

  let payload = serde_json::json!({
    "prompt": prompt,
    "negative_prompt": neg,
    "steps": steps,
    "cfg_scale": effective_cfg,
    "sampler_name": sampling_method.unwrap_or(if is_lcm { "lcm" } else { "euler_a" }),
    "schedule": if is_lcm { "lcm" } else { "normal" },
    "width": width,
    "height": height,
    "seed": seed.unwrap_or(-1)
  });

  let req = client
    .post(format!("http://127.0.0.1:{port}/sdapi/v1/txt2img"))
    .json(&payload)
    .send();

  let res = tokio::select! {
    resp = req => resp.map_err(|e| format!("request to sd-server failed: {e}"))?,
    _ = cancel.notified() => {
      return Err("generation cancelled".to_string());
    }
  };

  if !res.status().is_success() {
    return Err(format!("sd-server returned HTTP {}", res.status()));
  }

  let body: serde_json::Value = res
    .json()
    .await
    .map_err(|e| format!("failed to parse sd-server response: {e}"))?;

  let b64 = body["images"][0]
    .as_str()
    .ok_or("no image returned in sd-server response")?;

  let raw_bytes = base64_decode(b64)?;

  let dir = images_dir(app)?;
  let file_name = format!("{}.png", uuid::Uuid::new_v4());
  let output_path = dir.join(&file_name);
  std::fs::write(&output_path, &raw_bytes)
    .map_err(|e| format!("failed to save generated image: {e}"))?;

  // Update last used timestamp
  if let Some(inst) = state.server.lock().await.as_mut() {
    inst.last_used = Instant::now();
  }

  Ok(output_path.to_string_lossy().to_string())
}

#[allow(clippy::too_many_arguments)]
async fn run_cli_generation(
  app: &AppHandle,
  model_path: &str,
  prompt: &str,
  negative_prompt: Option<&str>,
  width: i32,
  height: i32,
  steps: i32,
  seed: Option<i64>,
  cfg_scale: Option<f32>,
  sampling_method: Option<&str>,
  cancel: Arc<Notify>,
) -> Result<String, String> {
  let sd_cli = sd_cli_path(app)?;
  if !sd_cli.exists() {
    return Err(format!("sd-cli binary not found at {}", sd_cli.display()));
  }
  if !PathBuf::from(model_path).exists() {
    return Err(format!("model file not found at {model_path}"));
  }

  let dir = images_dir(app)?;
  let file_name = format!("{}.png", uuid::Uuid::new_v4());
  let output_path = dir.join(&file_name);
  let output_str = output_path
    .to_str()
    .ok_or("invalid output path")?
    .to_string();

  let threads = optimal_thread_count();
  let mut cmd = Command::new(&sd_cli);
  if let Some(parent) = sd_cli.parent() {
    cmd.current_dir(parent);
  }
  #[cfg(windows)]
  {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }
  cmd.args([
    "-m",
    model_path,
    "-p",
    prompt,
    "-o",
    &output_str,
    "-W",
    &width.to_string(),
    "-H",
    &height.to_string(),
    "--steps",
    &steps.to_string(),
    "-t",
    &threads.to_string(),
    "--mmap",
  ]);
  let is_lcm = sampling_method.map(|s| s.eq_ignore_ascii_case("lcm")).unwrap_or(false)
    || model_path.to_lowercase().contains("lcm");

  if let Some(neg) = negative_prompt.filter(|s| !s.is_empty()) {
    cmd.args(["-n", neg]);
  } else {
    cmd.args(["-n", "deformed, distorted, disfigured, poorly drawn, bad anatomy, mutated, extra limbs, blurry, out of focus, duplicate, low quality"]);
  }
  cmd.args(["-s", &seed.unwrap_or(-1).to_string()]);
  if let Some(cfg) = cfg_scale {
    cmd.args(["--cfg-scale", &cfg.to_string()]);
  } else if is_lcm {
    cmd.args(["--cfg-scale", "1.8"]);
  }
  if let Some(method) = sampling_method.filter(|s| !s.is_empty()) {
    cmd.args(["--sampling-method", method]);
  } else if is_lcm {
    cmd.args(["--sampling-method", "lcm"]);
  }
  if is_lcm {
    cmd.args(["--scheduler", "lcm"]);
  }
  cmd
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  let mut child = cmd
    .spawn()
    .map_err(|e| format!("failed to start sd-cli: {e}"))?;

  let status = tokio::select! {
    result = child.wait() => result.map_err(|e| format!("sd-cli process error: {e}"))?,
    _ = cancel.notified() => {
      let _ = child.start_kill();
      let _ = child.wait().await;
      return Err("generation cancelled".to_string());
    }
  };

  if !status.success() {
    return Err(format!(
      "sd-cli exited with status {}",
      status.code().map(|c| c.to_string()).unwrap_or_default()
    ));
  }
  if !output_path.exists() {
    return Err("sd-cli finished but no image was written".to_string());
  }

  Ok(output_str)
}
