use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Resolves a resource file or directory across development, unbundled debug,
/// and packaged production builds on Windows/macOS.
pub fn resolve_resource(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
  // 1. Try Tauri's resource_dir directly and under resources/
  if let Ok(base) = app.path().resource_dir() {
    let direct = base.join(relative);
    if direct.exists() {
      return Ok(direct);
    }
    let with_res = base.join("resources").join(relative);
    if with_res.exists() {
      return Ok(with_res);
    }
  }

  // 2. Try relative to current executable directory
  if let Ok(exe) = std::env::current_exe() {
    if let Some(exe_dir) = exe.parent() {
      let direct = exe_dir.join(relative);
      if direct.exists() {
        return Ok(direct);
      }
      let with_res = exe_dir.join("resources").join(relative);
      if with_res.exists() {
        return Ok(with_res);
      }
    }
  }

  // 3. Try dev mode paths relative to working directory
  let dev_path = PathBuf::from("src-tauri").join("resources").join(relative);
  if dev_path.exists() {
    return Ok(dev_path);
  }
  let dev_path2 = PathBuf::from("resources").join(relative);
  if dev_path2.exists() {
    return Ok(dev_path2);
  }

  // 4. Try manifest directory (for cargo test / cargo run in subfolder)
  let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join(relative);
  if manifest.exists() {
    return Ok(manifest);
  }

  // Default fallback for descriptive error reporting
  let base = app.path().resource_dir().map_err(|e| e.to_string())?;
  Ok(base.join("resources").join(relative))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn resolves_all_bundled_binaries_in_manifest() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
    let llama_exe = if cfg!(windows) { "llama/llama-server.exe" } else { "llama/llama-server" };
    let sd_exe = if cfg!(windows) { "sd/sd-cli.exe" } else { "sd/sd-cli" };
    let ort_dll = if cfg!(windows) { "onnxruntime/onnxruntime.dll" } else { "onnxruntime/libonnxruntime.so" };

    assert!(manifest.join(llama_exe).exists(), "llama-server must exist at {:?}", manifest.join(llama_exe));
    assert!(manifest.join(sd_exe).exists(), "sd-cli must exist at {:?}", manifest.join(sd_exe));
    assert!(manifest.join(ort_dll).exists(), "onnxruntime must exist at {:?}", manifest.join(ort_dll));
    assert!(manifest.join("laya").join("model.onnx").exists(), "laya model must exist at {:?}", manifest.join("laya").join("model.onnx"));
  }
}
