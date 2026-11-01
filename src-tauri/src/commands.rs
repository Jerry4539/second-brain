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
