use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const MAX_UNCOMPRESSED_SIZE: u64 = 100 * 1024 * 1024; // 100 MB limit
const MAX_FILE_ENTRIES: usize = 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddonManifest {
  pub id: String,
  pub name: String,
  pub version: String,
  #[serde(rename = "type")]
  pub addon_type: String, // "game" | "theme" | "tool" | "extension"
  pub entry: String,
  pub description: Option<String>,
  pub author: Option<String>,
  pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddonInfo {
  pub id: String,
  pub name: String,
  pub version: String,
  pub addon_type: String,
  pub entry: String,
  pub description: Option<String>,
  pub author: Option<String>,
  pub icon: Option<String>,
  pub enabled: bool,
  pub installed_at: String,
  pub path: String,
}

fn validate_addon_id(id: &str) -> Result<(), String> {
  if id.is_empty() || id.len() > 64 {
    return Err("Add-on ID must be between 1 and 64 characters long".to_string());
  }
  for c in id.chars() {
    if !c.is_ascii_lowercase() && !c.is_ascii_digit() && c != '-' && c != '_' {
      return Err(format!(
        "Invalid character '{c}' in add-on ID. Only lowercase letters, numbers, hyphens, and underscores are allowed."
      ));
    }
  }
  Ok(())
}

fn sanitize_relative_path(path: &str) -> Result<PathBuf, String> {
  if path.is_empty() {
    return Err("Path cannot be empty".to_string());
  }
  if path.starts_with('/') || path.starts_with('\\') || path.contains(':') {
    return Err("Absolute paths and drive prefixes are forbidden".to_string());
  }
  let path_buf = PathBuf::from(path);
  for comp in path_buf.components() {
    match comp {
      Component::Normal(_) => {}
      _ => {
        return Err(format!(
          "Path component '{:?}' is forbidden for security (no parent directory '..' allowed)",
          comp
        ));
      }
    }
  }
  Ok(path_buf)
}

#[tauri::command]
pub fn install_addon(app: AppHandle, zip_path: String) -> Result<AddonInfo, String> {
  let file_path = Path::new(&zip_path);
  if !file_path.exists() {
    return Err(format!("Add-on archive not found at: {zip_path}"));
  }

  let file = File::open(file_path).map_err(|e| format!("Failed to open zip file: {e}"))?;
  let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {e}"))?;

  let total_entries = archive.len();
  if total_entries == 0 {
    return Err("Zip archive is empty".to_string());
  }
  if total_entries > MAX_FILE_ENTRIES {
    return Err(format!(
      "Zip archive exceeds maximum entry limit ({total_entries} > {MAX_FILE_ENTRIES})"
    ));
  }

  // 1. Locate manifest.json (either at root or inside a single top-level directory)
  let mut manifest_entry_idx: Option<usize> = None;
  let mut prefix_to_strip: Option<String> = None;

  for i in 0..total_entries {
    let zip_file = archive
      .by_index(i)
      .map_err(|e| format!("Failed to read zip entry {i}: {e}"))?;
    let name = zip_file.name().replace('\\', "/");

    if name == "manifest.json" {
      manifest_entry_idx = Some(i);
      prefix_to_strip = Some("".to_string());
      break;
    } else if name.ends_with("/manifest.json") {
      let parts: Vec<&str> = name.split('/').collect();
      if parts.len() == 2 && !parts[0].is_empty() {
        manifest_entry_idx = Some(i);
        prefix_to_strip = Some(format!("{}/", parts[0]));
      }
    }
  }

  let manifest_idx = manifest_entry_idx
    .ok_or_else(|| "Add-on archive must contain 'manifest.json'".to_string())?;
  let prefix = prefix_to_strip.unwrap_or_default();

  // 2. Parse and validate manifest.json
  let manifest: AddonManifest = {
    let mut manifest_file = archive
      .by_index(manifest_idx)
      .map_err(|e| format!("Failed to read manifest entry: {e}"))?;
    let mut content = String::new();
    manifest_file
      .read_to_string(&mut content)
      .map_err(|e| format!("Failed to read manifest content: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse manifest.json: {e}"))?
  };

  validate_addon_id(&manifest.id)?;
  if manifest.name.trim().is_empty() || manifest.name.len() > 100 {
    return Err("Add-on name must be between 1 and 100 characters".to_string());
  }
  if manifest.version.trim().is_empty() || manifest.version.len() > 32 {
    return Err("Add-on version must be between 1 and 32 characters".to_string());
  }
  sanitize_relative_path(&manifest.entry)?;

  // 3. Prepare target directory: <app_data_dir>/addons/<id>
  let addons_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("addons");
  fs::create_dir_all(&addons_dir)
    .map_err(|e| format!("Failed to create addons directory: {e}"))?;

  let target_dir = addons_dir.join(&manifest.id);
  if target_dir.exists() {
    fs::remove_dir_all(&target_dir)
      .map_err(|e| format!("Failed to clean existing add-on directory: {e}"))?;
  }
  fs::create_dir_all(&target_dir)
    .map_err(|e| format!("Failed to create add-on directory: {e}"))?;

  // 4. Safe extraction with path traversal and size checks
  let mut total_uncompressed_bytes: u64 = 0;

  for i in 0..total_entries {
    let mut zip_file = archive
      .by_index(i)
      .map_err(|e| format!("Failed to read entry {i}: {e}"))?;

    let raw_name = zip_file.name().replace('\\', "/");
    if !prefix.is_empty() && !raw_name.starts_with(&prefix) {
      continue; // Skip files outside the top-level addon directory
    }

    let stripped_name = if !prefix.is_empty() {
      match raw_name.strip_prefix(&prefix) {
        Some(s) => s,
        None => continue,
      }
    } else {
      raw_name.as_str()
    };

    if stripped_name.is_empty() {
      continue;
    }

    let rel_path = match sanitize_relative_path(stripped_name) {
      Ok(p) => p,
      Err(e) => {
        let _ = fs::remove_dir_all(&target_dir);
        return Err(format!("Security check failed on entry '{stripped_name}': {e}"));
      }
    };

    let dest_path = target_dir.join(&rel_path);

    // Verify destination doesn't escape target_dir
    if !dest_path.starts_with(&target_dir) {
      let _ = fs::remove_dir_all(&target_dir);
      return Err(format!("Entry '{stripped_name}' attempts path traversal"));
    }

    if zip_file.is_dir() {
      fs::create_dir_all(&dest_path).map_err(|e| {
        let _ = fs::remove_dir_all(&target_dir);
        format!("Failed to create directory {:?}: {e}", dest_path)
      })?;
    } else {
      if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
          let _ = fs::remove_dir_all(&target_dir);
          format!("Failed to create parent directory {:?}: {e}", parent)
        })?;
      }

      let mut out_file = File::create(&dest_path).map_err(|e| {
        let _ = fs::remove_dir_all(&target_dir);
        format!("Failed to create file {:?}: {e}", dest_path)
      })?;

      let mut buffer = [0u8; 8192];
      loop {
        let bytes_read = zip_file.read(&mut buffer).map_err(|e| {
          let _ = fs::remove_dir_all(&target_dir);
          format!("Failed to extract {:?}: {e}", dest_path)
        })?;
        if bytes_read == 0 {
          break;
        }

        total_uncompressed_bytes += bytes_read as u64;
        if total_uncompressed_bytes > MAX_UNCOMPRESSED_SIZE {
          let _ = fs::remove_dir_all(&target_dir);
          return Err(format!(
            "Add-on extraction aborted: exceeded maximum uncompressed size of 100 MB"
          ));
        }

        out_file.write_all(&buffer[..bytes_read]).map_err(|e| {
          let _ = fs::remove_dir_all(&target_dir);
          format!("Failed to write to {:?}: {e}", dest_path)
        })?;
      }
    }
  }

  // 5. Verify entry file exists
  let entry_path = target_dir.join(&manifest.entry);
  if !entry_path.exists() || !entry_path.is_file() {
    let _ = fs::remove_dir_all(&target_dir);
    return Err(format!(
      "Entry file '{}' declared in manifest was not found in add-on archive",
      manifest.entry
    ));
  }

  let installed_at = chrono_iso_now();

  Ok(AddonInfo {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    addon_type: manifest.addon_type,
    entry: manifest.entry,
    description: manifest.description,
    author: manifest.author,
    icon: manifest.icon,
    enabled: true,
    installed_at,
    path: target_dir.to_string_lossy().to_string(),
  })
}

#[tauri::command]
pub fn uninstall_addon(app: AppHandle, id: String) -> Result<(), String> {
  validate_addon_id(&id)?;
  let addons_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("addons");
  let target_dir = addons_dir.join(&id);

  if target_dir.exists() {
    fs::remove_dir_all(&target_dir)
      .map_err(|e| format!("Failed to delete add-on directory: {e}"))?;
  }
  Ok(())
}

#[tauri::command]
pub fn read_addon_data_url(app: AppHandle, id: String, relative_path: String) -> Result<String, String> {
  validate_addon_id(&id)?;
  let sanitized = sanitize_relative_path(&relative_path)?;

  let addons_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("addons");
  let file_path = addons_dir.join(&id).join(&sanitized);

  if !file_path.exists() || !file_path.is_file() {
    return Err(format!("Add-on file not found: {relative_path}"));
  }

  let mut file = File::open(&file_path).map_err(|e| format!("Failed to open file: {e}"))?;
  let mut bytes = Vec::new();
  file
    .read_to_end(&mut bytes)
    .map_err(|e| format!("Failed to read file: {e}"))?;

  let ext = file_path
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("")
    .to_lowercase();

  let mime = match ext.as_str() {
    "html" | "htm" => "text/html",
    "js" | "mjs" => "application/javascript",
    "css" => "text/css",
    "json" => "application/json",
    "png" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "svg" => "image/svg+xml",
    "webp" => "image/webp",
    "gif" => "image/gif",
    "woff" | "woff2" => "font/woff2",
    "ttf" => "font/ttf",
    "mp3" => "audio/mpeg",
    "wav" => "audio/wav",
    _ => "application/octet-stream",
  };

  let b64 = encode_base64(&bytes);
  Ok(format!("data:{mime};base64,{b64}"))
}

#[tauri::command]
pub fn read_addon_content(app: AppHandle, id: String, relative_path: String) -> Result<String, String> {
  validate_addon_id(&id)?;
  let sanitized = sanitize_relative_path(&relative_path)?;

  let addons_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("addons");
  let file_path = addons_dir.join(&id).join(&sanitized);

  if !file_path.exists() || !file_path.is_file() {
    return Err(format!("Add-on file not found: {relative_path}"));
  }

  let mut file = File::open(&file_path).map_err(|e| format!("Failed to open file: {e}"))?;
  let mut content = String::new();
  file
    .read_to_string(&mut content)
    .map_err(|e| format!("Failed to read file: {e}"))?;

  Ok(content)
}

#[tauri::command]
pub fn install_starter_addon(app: AppHandle, starter_id: String) -> Result<AddonInfo, String> {
  let addons_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("addons");
  fs::create_dir_all(&addons_dir).map_err(|e| format!("Failed to create addons dir: {e}"))?;

  match starter_id.as_str() {
    "potato-vs-mosquito" => {
      let id = "potato-vs-mosquito";
      let target_dir = addons_dir.join(id);
      if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
      }
      fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create add-on directory: {e}"))?;

      let manifest_json = r#"{
  "id": "potato-vs-mosquito",
  "name": "Potato vs Mosquito",
  "version": "1.0.0",
  "type": "game",
  "description": "Swat pesky mosquitoes before they take a bite of the sacred potato!",
  "author": "Second Brain Labs",
  "entry": "index.html"
}"#;

      let index_html = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Potato vs Mosquito</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background: linear-gradient(135deg, #1e1e24 0%, #2b1e2a 100%);
      color: #f3f4f6;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    #game-container {
      position: relative;
      width: 600px;
      height: 480px;
      background: radial-gradient(circle at center, #2e263a 0%, #15131c 100%);
      border: 2px solid #583d72;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    #hud {
      position: absolute;
      top: 16px;
      left: 20px;
      right: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 18px;
      font-weight: 700;
      z-index: 10;
      color: #f9a826;
      text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    }
    #potato {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 64px;
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    #potato:hover {
      transform: translateX(-50%) scale(1.1);
    }
    .mosquito {
      position: absolute;
      font-size: 32px;
      cursor: crosshair;
      transition: top 0.05s linear, left 0.05s linear;
    }
    #overlay {
      position: absolute;
      inset: 0;
      background: rgba(18, 16, 26, 0.88);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 20;
    }
    button {
      background: #f9a826;
      color: #1a1a24;
      border: none;
      padding: 12px 28px;
      font-size: 16px;
      font-weight: 700;
      border-radius: 9999px;
      cursor: pointer;
      margin-top: 16px;
      transition: all 0.2s ease;
    }
    button:hover {
      background: #ffbe44;
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div id="game-container">
    <div id="hud">
      <div>Score: <span id="score">0</span></div>
      <div>Health: <span id="health">100%</span></div>
    </div>
    <div id="potato">🥔</div>
    <div id="overlay">
      <h2 style="font-size: 32px; margin-bottom: 8px;">🥔 Potato vs Mosquito 🦟</h2>
      <p style="color: #9ca3af; max-width: 400px; text-align: center;">Click and swat incoming mosquitoes before they bite the Potato!</p>
      <button id="start-btn" onclick="startGame()">Play Now</button>
    </div>
  </div>

  <script>
    let score = 0;
    let health = 100;
    let gameLoop = null;
    let spawnLoop = null;
    let isPlaying = false;
    const container = document.getElementById('game-container');
    const scoreEl = document.getElementById('score');
    const healthEl = document.getElementById('health');
    const overlay = document.getElementById('overlay');
    const mosquitoes = [];

    function startGame() {
      score = 0;
      health = 100;
      scoreEl.textContent = '0';
      healthEl.textContent = '100%';
      overlay.style.display = 'none';
      isPlaying = true;

      // Remove existing mosquitoes
      document.querySelectorAll('.mosquito').forEach(m => m.remove());
      mosquitoes.length = 0;

      if (spawnLoop) clearInterval(spawnLoop);
      if (gameLoop) clearInterval(gameLoop);

      spawnLoop = setInterval(spawnMosquito, 900);
      gameLoop = setInterval(updateGame, 30);
    }

    function spawnMosquito() {
      if (!isPlaying) return;
      const m = document.createElement('div');
      m.className = 'mosquito';
      m.textContent = '🦟';
      const x = Math.random() * 540 + 20;
      m.style.left = x + 'px';
      m.style.top = '-40px';

      const obj = { el: m, x: x, y: -40, speed: Math.random() * 2 + 2 };
      m.onmousedown = () => {
        score += 10;
        scoreEl.textContent = score;
        m.remove();
        const idx = mosquitoes.indexOf(obj);
        if (idx !== -1) mosquitoes.splice(idx, 1);
      };
      container.appendChild(m);
      mosquitoes.push(obj);
    }

    function updateGame() {
      if (!isPlaying) return;
      const potatoY = 380;
      for (let i = mosquitoes.length - 1; i >= 0; i--) {
        const m = mosquitoes[i];
        m.y += m.speed;
        m.el.style.top = m.y + 'px';

        if (m.y >= potatoY) {
          health -= 15;
          if (health < 0) health = 0;
          healthEl.textContent = health + '%';
          m.el.remove();
          mosquitoes.splice(i, 1);

          if (health <= 0) {
            endGame();
            break;
          }
        }
      }
    }

    function endGame() {
      isPlaying = false;
      clearInterval(spawnLoop);
      clearInterval(gameLoop);
      overlay.innerHTML = `
        <h2 style="font-size: 32px; color: #ef4444; margin-bottom: 8px;">Game Over!</h2>
        <p style="color: #d1d5db; font-size: 18px;">Your potato survived with <strong>${score}</strong> points!</p>
        <button onclick="startGame()">Play Again</button>
      `;
      overlay.style.display = 'flex';
    }
  </script>
</body>
</html>"#;

      fs::write(target_dir.join("manifest.json"), manifest_json)
        .map_err(|e| format!("Failed to write manifest: {e}"))?;
      fs::write(target_dir.join("index.html"), index_html)
        .map_err(|e| format!("Failed to write index.html: {e}"))?;

      Ok(AddonInfo {
        id: id.to_string(),
        name: "Potato vs Mosquito".to_string(),
        version: "1.0.0".to_string(),
        addon_type: "game".to_string(),
        entry: "index.html".to_string(),
        description: Some("Swat pesky mosquitoes before they take a bite of the sacred potato!".to_string()),
        author: Some("Second Brain Labs".to_string()),
        icon: None,
        enabled: true,
        installed_at: chrono_iso_now(),
        path: target_dir.to_string_lossy().to_string(),
      })
    }
    "retro-matrix-rain" => {
      let id = "retro-matrix-rain";
      let target_dir = addons_dir.join(id);
      if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
      }
      fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create add-on directory: {e}"))?;

      let manifest_json = r#"{
  "id": "retro-matrix-rain",
  "name": "Retro Matrix Rain",
  "version": "1.0.0",
  "type": "theme",
  "description": "Hypnotic cyberpunk digital rain visualizer with ambient controls.",
  "author": "Second Brain Labs",
  "entry": "index.html"
}"#;

      let index_html = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Retro Matrix Rain</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; font-family: monospace; }
    canvas { display: block; position: absolute; inset: 0; }
    #controls {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 12px;
      background: rgba(0, 20, 0, 0.75);
      border: 1px solid #00ff66;
      border-radius: 9999px;
      padding: 8px 18px;
      backdrop-filter: blur(8px);
      z-index: 10;
    }
    button {
      background: transparent;
      color: #00ff66;
      border: 1px solid #00ff66;
      padding: 4px 12px;
      border-radius: 9999px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    button:hover {
      background: #00ff66;
      color: #000;
    }
  </style>
</head>
<body>
  <canvas id="c"></canvas>
  <div id="controls">
    <button onclick="setColor('#00ff66')">Matrix Green</button>
    <button onclick="setColor('#00ffff')">Cyber Cyan</button>
    <button onclick="setColor('#ff007f')">Neon Pink</button>
    <button onclick="setColor('#ffaa00')">Amber Glow</button>
  </div>
  <script>
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    let color = '#00ff66';

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF!@#$%^&*';
    const fontSize = 16;
    let columns = Math.floor(canvas.width / fontSize);
    let drops = Array(columns).fill(1);

    function setColor(c) { color = c; }

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = color;
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }
    setInterval(draw, 33);
  </script>
</body>
</html>"#;

      fs::write(target_dir.join("manifest.json"), manifest_json)
        .map_err(|e| format!("Failed to write manifest: {e}"))?;
      fs::write(target_dir.join("index.html"), index_html)
        .map_err(|e| format!("Failed to write index.html: {e}"))?;

      Ok(AddonInfo {
        id: id.to_string(),
        name: "Retro Matrix Rain".to_string(),
        version: "1.0.0".to_string(),
        addon_type: "theme".to_string(),
        entry: "index.html".to_string(),
        description: Some("Hypnotic cyberpunk digital rain visualizer with ambient controls.".to_string()),
        author: Some("Second Brain Labs".to_string()),
        icon: None,
        enabled: true,
        installed_at: chrono_iso_now(),
        path: target_dir.to_string_lossy().to_string(),
      })
    }
    "cyber-pong" => {
      let id = "cyber-pong";
      let target_dir = addons_dir.join(id);
      if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
      }
      fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create add-on directory: {e}"))?;

      let manifest_json = r#"{
  "id": "cyber-pong",
  "name": "Cyber Pong",
  "version": "1.0.0",
  "type": "game",
  "description": "Fast-paced neon arcade paddle battle against AI with responsive physics.",
  "author": "Second Brain Labs",
  "entry": "index.html"
}"#;

      let index_html = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cyber Pong</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; }
    body {
      background: #09090f;
      color: #e2e8f0;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    #game-card {
      position: relative;
      background: #11111b;
      border: 1px solid #1e1e2e;
      border-radius: 20px;
      padding: 16px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    #score-bar {
      display: flex;
      justify-content: space-between;
      width: 600px;
      padding: 4px 16px;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .score-box {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .p-score { color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.5); }
    .ai-score { color: #ff007f; text-shadow: 0 0 10px rgba(255, 0, 127, 0.5); }
    canvas {
      background: #050508;
      border: 1px solid #27273a;
      border-radius: 12px;
      display: block;
      cursor: none;
    }
    #controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    button {
      background: #1f1f2e;
      color: #e2e8f0;
      border: 1px solid #333348;
      padding: 6px 16px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    button:hover {
      background: #2d2d42;
      border-color: #00ffff;
      color: #00ffff;
    }
  </style>
</head>
<body>
  <div id="game-card">
    <div id="score-bar">
      <div class="score-box"><span style="color:#94a3b8;font-size:12px">YOU:</span> <span id="pScore" class="p-score">0</span></div>
      <div style="color:#64748b;font-size:12px">CYBER PONG</div>
      <div class="score-box"><span id="aiScore" class="ai-score">0</span> <span style="color:#94a3b8;font-size:12px">:AI</span></div>
    </div>
    <canvas id="c" width="600" height="400"></canvas>
    <div id="controls">
      <button onclick="resetScores()">Reset Score</button>
      <button onclick="toggleDifficulty()" id="diffBtn">Speed: Normal</button>
      <span style="color:#64748b;font-size:11px">Move mouse over canvas to control left paddle</span>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const pScoreEl = document.getElementById('pScore');
    const aiScoreEl = document.getElementById('aiScore');

    let pScore = 0;
    let aiScore = 0;
    let speedMult = 1.0;

    const p = { w: 12, h: 70, y: 165 };
    const ai = { w: 12, h: 70, y: 165, speed: 4.0 };
    const ball = { x: 300, y: 200, r: 7, vx: 5, vy: 3, trail: [] };

    // Audio synthesizer
    let audioCtx = null;
    function playBeep(freq, type = 'square', duration = 0.08) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch(e) {}
    }

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      p.y = Math.max(10, Math.min(canvas.height - p.h - 10, mouseY - p.h / 2));
    });

    function resetBall(servingPlayer) {
      ball.x = 300;
      ball.y = 200;
      ball.trail = [];
      const dir = servingPlayer ? 1 : -1;
      ball.vx = dir * (4.5 * speedMult);
      ball.vy = (Math.random() * 4 - 2) * speedMult;
    }

    function resetScores() {
      pScore = 0;
      aiScore = 0;
      pScoreEl.textContent = '0';
      aiScoreEl.textContent = '0';
      resetBall(true);
    }

    function toggleDifficulty() {
      if (speedMult === 1.0) {
        speedMult = 1.35;
        ai.speed = 5.2;
        document.getElementById('diffBtn').textContent = 'Speed: Fast';
      } else {
        speedMult = 1.0;
        ai.speed = 4.0;
        document.getElementById('diffBtn').textContent = 'Speed: Normal';
      }
    }

    function loop() {
      // AI movement
      const aiTarget = ball.y - ai.h / 2;
      ai.y += (aiTarget - ai.y) * 0.1;
      ai.y = Math.max(10, Math.min(canvas.height - ai.h - 10, ai.y));

      // Ball movement
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 8) ball.trail.shift();

      ball.x += ball.vx;
      ball.y += ball.vy;

      // Top/bottom bounce
      if (ball.y - ball.r <= 0 || ball.y + ball.r >= canvas.height) {
        ball.vy = -ball.vy;
        playBeep(220, 'sine', 0.05);
      }

      // Player paddle collision (x = 24)
      if (ball.x - ball.r <= 32 && ball.x + ball.r >= 20 && ball.y >= p.y && ball.y <= p.y + p.h) {
        const offset = (ball.y - (p.y + p.h / 2)) / (p.h / 2);
        ball.vx = Math.abs(ball.vx) * 1.05;
        ball.vy = offset * 5;
        playBeep(440, 'triangle', 0.08);
      }

      // AI paddle collision (x = 568)
      if (ball.x + ball.r >= 568 && ball.x - ball.r <= 580 && ball.y >= ai.y && ball.y <= ai.y + ai.h) {
        const offset = (ball.y - (ai.y + ai.h / 2)) / (ai.h / 2);
        ball.vx = -Math.abs(ball.vx) * 1.05;
        ball.vy = offset * 5;
        playBeep(330, 'triangle', 0.08);
      }

      // Score check
      if (ball.x < 0) {
        aiScore++;
        aiScoreEl.textContent = aiScore;
        playBeep(160, 'sawtooth', 0.2);
        resetBall(true);
      } else if (ball.x > canvas.width) {
        pScore++;
        pScoreEl.textContent = pScore;
        playBeep(660, 'triangle', 0.2);
        resetBall(false);
      }

      // Render
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Center net
      ctx.strokeStyle = '#1e1e2e';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(300, 0);
      ctx.lineTo(300, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ball trail
      ball.trail.forEach((pt, i) => {
        ctx.fillStyle = `rgba(0, 255, 255, ${ (i + 1) / 16 })`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ball.r * (i / 8), 0, Math.PI * 2);
        ctx.fill();
      });

      // Ball
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Player paddle
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.fillRect(20, p.y, p.w, p.h);

      // AI paddle
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 10;
      ctx.fillRect(568, ai.y, ai.w, ai.h);
      ctx.shadowBlur = 0;

      requestAnimationFrame(loop);
    }

    resetBall(true);
    requestAnimationFrame(loop);
  </script>
</body>
</html>"#;

      fs::write(target_dir.join("manifest.json"), manifest_json)
        .map_err(|e| format!("Failed to write manifest: {e}"))?;
      fs::write(target_dir.join("index.html"), index_html)
        .map_err(|e| format!("Failed to write index.html: {e}"))?;

      Ok(AddonInfo {
        id: id.to_string(),
        name: "Cyber Pong".to_string(),
        version: "1.0.0".to_string(),
        addon_type: "game".to_string(),
        entry: "index.html".to_string(),
        description: Some("Fast-paced neon arcade paddle battle against AI with responsive physics.".to_string()),
        author: Some("Second Brain Labs".to_string()),
        icon: None,
        enabled: true,
        installed_at: chrono_iso_now(),
        path: target_dir.to_string_lossy().to_string(),
      })
    }
    _ => Err(format!("Unknown starter add-on: {starter_id}")),
  }
}

fn chrono_iso_now() -> String {
  // Simple ISO-8601 formatting without heavy external crates
  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs();

  // Basic seconds calculation into YYYY-MM-DD HH:MM:SS format
  let days = now / 86400;
  let time_in_day = now % 86400;
  let hours = time_in_day / 3600;
  let minutes = (time_in_day % 3600) / 60;
  let seconds = time_in_day % 60;

  // Approximate Gregorian calendar calculation
  let mut y = 1970;
  let mut d = days;
  loop {
    let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
    let days_in_year = if leap { 366 } else { 365 };
    if d < days_in_year {
      break;
    }
    d -= days_in_year;
    y += 1;
  }
  let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
  let days_in_months = [
    31,
    if leap { 29 } else { 28 },
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let mut m = 1;
  for &dim in days_in_months.iter() {
    if d < dim {
      break;
    }
    d -= dim;
    m += 1;
  }
  let day = d + 1;

  format!("{y:04}-{m:02}-{day:02} {hours:02}:{minutes:02}:{seconds:02}")
}

fn encode_base64(bytes: &[u8]) -> String {
  const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
  for chunk in bytes.chunks(3) {
    let b0 = chunk[0] as u32;
    let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
    let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
    let triple = (b0 << 16) | (b1 << 8) | b2;

    out.push(CHARS[((triple >> 18) & 63) as usize] as char);
    out.push(CHARS[((triple >> 12) & 63) as usize] as char);
    if chunk.len() > 1 {
      out.push(CHARS[((triple >> 6) & 63) as usize] as char);
    } else {
      out.push('=');
    }
    if chunk.len() > 2 {
      out.push(CHARS[(triple & 63) as usize] as char);
    } else {
      out.push('=');
    }
  }
  out
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_validate_addon_id() {
    assert!(validate_addon_id("potato-vs-mosquito").is_ok());
    assert!(validate_addon_id("game_123").is_ok());
    assert!(validate_addon_id("theme-dark").is_ok());

    assert!(validate_addon_id("").is_err());
    assert!(validate_addon_id("PotatoGame").is_err()); // No uppercase
    assert!(validate_addon_id("game..escape").is_err()); // No dots
    assert!(validate_addon_id("game/sub").is_err()); // No slashes
    assert!(validate_addon_id("game name").is_err()); // No spaces
    assert!(validate_addon_id(&"a".repeat(65)).is_err()); // Max 64 chars
  }

  #[test]
  fn test_sanitize_relative_path() {
    assert!(sanitize_relative_path("index.html").is_ok());
    assert!(sanitize_relative_path("assets/style.css").is_ok());
    assert!(sanitize_relative_path("js/game.js").is_ok());

    assert!(sanitize_relative_path("").is_err());
    assert!(sanitize_relative_path("../escape.html").is_err());
    assert!(sanitize_relative_path("assets/../../secret.txt").is_err());
    assert!(sanitize_relative_path("/root/index.html").is_err());
    assert!(sanitize_relative_path("\\windows\\system32").is_err());
    assert!(sanitize_relative_path("C:\\index.html").is_err());
  }
}

