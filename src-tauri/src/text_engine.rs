use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

const HEALTH_TIMEOUT_SECS: u64 = 60;

pub struct TextEngineState {
  process: Mutex<Option<Child>>,
  port: Mutex<Option<u16>>,
  model_path: Mutex<Option<String>>,
  cancelled: Mutex<HashSet<String>>,
}

impl Default for TextEngineState {
  fn default() -> Self {
    Self {
      process: Mutex::new(None),
      port: Mutex::new(None),
      model_path: Mutex::new(None),
      cancelled: Mutex::new(HashSet::new()),
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

fn stop_locked(state: &TextEngineState) {
  if let Ok(mut guard) = state.process.lock() {
    if let Some(mut child) = guard.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
  if let Ok(mut port) = state.port.lock() {
    *port = None;
  }
  if let Ok(mut model_path) = state.model_path.lock() {
    *model_path = None;
  }
}

#[tauri::command]
pub async fn start_text_engine(
  app: AppHandle,
  state: State<'_, TextEngineState>,
  model_path: String,
) -> Result<(), String> {
  // Already running the requested model — nothing to do.
  if let Ok(current) = state.model_path.lock() {
    if current.as_deref() == Some(model_path.as_str()) {
      return Ok(());
    }
  }

  stop_locked(&state);

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

  let port = find_free_port()?;

  let mut cmd = Command::new(&server_path);
  if let Some(parent) = server_path.parent() {
    cmd.current_dir(parent);
  }
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }

  let child = cmd
    .args([
      "-m",
      &model_path,
      "--port",
      &port.to_string(),
      "--host",
      "127.0.0.1",
      "-c",
      "4096",
      "-t",
      "4",
      "--no-ui",
    ])
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("failed to start llama-server: {e}"))?;

  *state.process.lock().map_err(|e| e.to_string())? = Some(child);
  *state.port.lock().map_err(|e| e.to_string())? = Some(port);

  // Poll /health until the server has finished loading the model.
  let client = reqwest::Client::new();
  let health_url = format!("http://127.0.0.1:{port}/health");
  let deadline = std::time::Instant::now() + Duration::from_secs(HEALTH_TIMEOUT_SECS);
  loop {
    if std::time::Instant::now() > deadline {
      stop_locked(&state);
      return Err("timed out waiting for the model to load".to_string());
    }
    match client.get(&health_url).send().await {
      Ok(resp) if resp.status().is_success() => break,
      _ => {
        // If the process already exited (e.g. invalid model file), fail fast with stderr details.
        let premature_exit = {
          let mut guard = state.process.lock().map_err(|e| e.to_string())?;
          if let Some(child) = guard.as_mut() {
            if let Ok(Some(status)) = child.try_wait() {
              let mut stderr_msg = String::new();
              if let Some(mut err_pipe) = child.stderr.take() {
                use std::io::Read;
                let _ = err_pipe.read_to_string(&mut stderr_msg);
              }
              *guard = None;
              let details = if stderr_msg.trim().is_empty() {
                format!("process exited with status {status}")
              } else {
                stderr_msg.trim().to_string()
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

        tokio::time::sleep(Duration::from_millis(300)).await;
      }
    }
  }

  *state.model_path.lock().map_err(|e| e.to_string())? = Some(model_path);
  Ok(())
}

#[tauri::command]
pub fn stop_text_engine(state: State<'_, TextEngineState>) -> Result<(), String> {
  stop_locked(&state);
  Ok(())
}

#[tauri::command]
pub fn text_engine_status(state: State<'_, TextEngineState>) -> Result<EngineStatus, String> {
  let model_path = state.model_path.lock().map_err(|e| e.to_string())?.clone();
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
    .port
    .lock()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "text engine is not running".to_string())?;

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
    for msg in history {
      msg_array.push(serde_json::json!({
        "role": msg.role,
        "content": msg.content
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

  let _ = app.emit(
    "text-engine:done",
    DoneEvent {
      request_id: request_id.clone(),
    },
  );
  Ok(())
}
