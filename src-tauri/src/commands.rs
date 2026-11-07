use crate::gguf::{self, GgufImportInfo};
use serde::Serialize;
use std::path::Path;

#[tauri::command]
pub fn import_gguf_model(path: String) -> Result<GgufImportInfo, String> {
  gguf::read_gguf_info(Path::new(&path))
}

#[tauri::command]
pub fn scan_gguf_folder(folder: String) -> Result<Vec<String>, String> {
  let entries = std::fs::read_dir(&folder).map_err(|e| format!("failed to read folder: {e}"))?;
  let mut paths = Vec::new();
  for entry in entries {
    let entry = entry.map_err(|e| format!("failed to read folder entry: {e}"))?;
    let path = entry.path();
    if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("gguf") {
      if let Some(p) = path.to_str() {
        paths.push(p.to_string());
      }
    }
  }
  Ok(paths)
}

#[derive(Serialize)]
pub struct ImageModelImportInfo {
  pub name: String,
  pub size_bytes: u64,
  pub format: String,
  pub architecture: Option<String>,
}

/// Lightweight import for image (stable-diffusion.cpp compatible) model weights.
/// Unlike GGUF text models, these are typically .safetensors/.ckpt (not a format
/// this app parses metadata from) — so we only record file facts and a
/// best-effort architecture guess from the filename, same fallback strategy
/// used for GGUF quantization when metadata is absent.
#[tauri::command]
pub fn import_image_model(path: String) -> Result<ImageModelImportInfo, String> {
  let file_path = Path::new(&path);
  let metadata =
    std::fs::metadata(file_path).map_err(|e| format!("failed to read file: {e}"))?;
  let name = file_path
    .file_stem()
    .and_then(|s| s.to_str())
    .unwrap_or("model")
    .to_string();
  let format = file_path
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("")
    .to_lowercase();
  let lower_name = name.to_lowercase();
  let architecture = if lower_name.contains("xl") {
    Some("SDXL".to_string())
  } else if lower_name.contains("sd3") {
    Some("SD3".to_string())
  } else if lower_name.contains("flux") {
    Some("FLUX".to_string())
  } else if lower_name.contains("turbo") {
    Some("SD-Turbo".to_string())
  } else if lower_name.contains("lcm") {
    Some("LCM".to_string())
  } else if lower_name.contains("sd") || lower_name.contains("1-5") || lower_name.contains("1.5") {
    Some("SD1.x".to_string())
  } else {
    None
  };
  Ok(ImageModelImportInfo {
    name,
    size_bytes: metadata.len(),
    format,
    architecture,
  })
}

#[tauri::command]
pub fn scan_image_model_folder(folder: String) -> Result<Vec<String>, String> {
  let entries = std::fs::read_dir(&folder).map_err(|e| format!("failed to read folder: {e}"))?;
  let valid_ext = ["safetensors", "ckpt", "gguf", "pt", "sft"];
  let mut paths = Vec::new();
  for entry in entries {
    let entry = entry.map_err(|e| format!("failed to read folder entry: {e}"))?;
    let path = entry.path();
    let ext = path
      .extension()
      .and_then(|e| e.to_str())
      .map(|e| e.to_lowercase());
    if path.is_file() && ext.as_deref().is_some_and(|e| valid_ext.contains(&e)) {
      if let Some(p) = path.to_str() {
        paths.push(p.to_string());
      }
    }
  }
  Ok(paths)
}

#[derive(Serialize)]
pub struct TextAttachment {
  pub name: String,
  pub content: String,
  pub size_bytes: u64,
  pub truncated: bool,
}

#[tauri::command]
pub fn read_text_attachment(path: String) -> Result<TextAttachment, String> {
  const MAX_ATTACHMENT_BYTES: usize = 32 * 1024; // 32 KB cap to fit cleanly in 4K context window
  let file_path = Path::new(&path);
  let meta = std::fs::metadata(file_path).map_err(|e| format!("failed to read file: {e}"))?;
  if meta.len() > 2 * 1024 * 1024 {
    return Err("file is too large to attach (max 2 MB)".to_string());
  }
  let name = file_path
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("attachment.txt")
    .to_string();
  let bytes = std::fs::read(file_path).map_err(|e| format!("failed to read file: {e}"))?;
  let truncated = bytes.len() > MAX_ATTACHMENT_BYTES;
  let slice = if truncated {
    &bytes[..MAX_ATTACHMENT_BYTES]
  } else {
    &bytes[..]
  };
  let content = String::from_utf8_lossy(slice).to_string();
  Ok(TextAttachment {
    name,
    content,
    size_bytes: meta.len(),
    truncated,
  })
}

#[tauri::command]
pub async fn agent_fetch_url(
  url: String,
  bearer_token: Option<String>,
) -> Result<String, String> {
  if !url.starts_with("https://") && !url.starts_with("http://") {
    return Err("Only http:// and https:// URLs are supported".to_string());
  }
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(12))
    .user_agent("SecondBrainAgent/0.2 (macOS; Local-First AI Agent)")
    .build()
    .map_err(|e| format!("failed to build HTTP client: {e}"))?;

  let mut req = client.get(&url).header("Accept", "application/json, text/plain, */*");
  if let Some(token) = bearer_token.filter(|t| !t.trim().is_empty()) {
    req = req.header("Authorization", format!("Bearer {}", token.trim()));
  }

  let resp = req
    .send()
    .await
    .map_err(|e| format!("network request failed: {e}"))?;

  if !resp.status().is_success() {
    return Err(format!("HTTP {}", resp.status()));
  }

  let text = resp
    .text()
    .await
    .map_err(|e| format!("failed to read response body: {e}"))?;

  // Cap payload to 64 KB so we never flood memory
  if text.len() > 65_536 {
    Ok(text.chars().take(65_536).collect())
  } else {
    Ok(text)
  }
}

#[tauri::command]
pub fn agent_save_workspace_note(
  app: tauri::AppHandle,
  filename: String,
  content: String,
) -> Result<String, String> {
  use tauri::Manager;
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("failed to resolve app data dir: {e}"))?
    .join("workspace");
  std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create workspace dir: {e}"))?;

  let safe_name: String = filename
    .chars()
    .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '_' })
    .collect();
  let final_name = if safe_name.ends_with(".md") || safe_name.ends_with(".txt") || safe_name.ends_with(".json") {
    safe_name
  } else {
    format!("{safe_name}.md")
  };
  let path = dir.join(&final_name);
  std::fs::write(&path, content.as_bytes()).map_err(|e| format!("failed to write note: {e}"))?;
  Ok(path.to_string_lossy().to_string())
}
