use tauri_plugin_sql::{Migration, MigrationKind};

mod addons;
mod commands;
mod decision_engine;
mod download;
mod gguf;
mod image_engine;
pub mod paths;
mod text_engine;

fn migrations() -> Vec<Migration> {
  vec![
    Migration {
      version: 1,
      description: "create_settings",
      sql: "CREATE TABLE settings (
              key TEXT PRIMARY KEY,
              value TEXT
            );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "create_models",
      sql: "CREATE TABLE models (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              path TEXT NOT NULL,
              format TEXT NOT NULL DEFAULT 'gguf',
              size_bytes INTEGER,
              quantization TEXT,
              architecture TEXT,
              status TEXT NOT NULL DEFAULT 'available',
              is_default INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "create_conversations_and_messages",
      sql: "CREATE TABLE conversations (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL DEFAULT 'New conversation',
              model_id TEXT REFERENCES models(id) ON DELETE SET NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE messages (
              id TEXT PRIMARY KEY,
              conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
              role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
              content TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 4,
      description: "create_images",
      sql: "CREATE TABLE images (
              id TEXT PRIMARY KEY,
              prompt TEXT NOT NULL,
              negative_prompt TEXT,
              file_path TEXT NOT NULL,
              seed INTEGER,
              steps INTEGER,
              model_id TEXT,
              is_favorite INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 5,
      description: "create_games",
      sql: "CREATE TABLE games (
              id TEXT PRIMARY KEY,
              game_type TEXT NOT NULL,
              difficulty TEXT NOT NULL DEFAULT 'medium',
              result TEXT,
              state_json TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 6,
      description: "create_addons",
      sql: "CREATE TABLE addons (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              version TEXT NOT NULL,
              type TEXT NOT NULL,
              entry TEXT NOT NULL,
              enabled INTEGER NOT NULL DEFAULT 1,
              installed_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 7,
      description: "create_favorites",
      sql: "CREATE TABLE favorites (
              id TEXT PRIMARY KEY,
              item_type TEXT NOT NULL CHECK (item_type IN ('conversation', 'image', 'game', 'addon')),
              item_id TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE (item_type, item_id)
            );",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 8,
      description: "add_conversation_generation_settings",
      sql: "ALTER TABLE conversations ADD COLUMN temperature REAL;
            ALTER TABLE conversations ADD COLUMN top_p REAL;
            ALTER TABLE conversations ADD COLUMN max_tokens INTEGER;",
      kind: MigrationKind::Up,
    },
    Migration {
      version: 9,
      description: "add_model_kind_and_image_dimensions",
      sql: "ALTER TABLE models ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
            ALTER TABLE images ADD COLUMN width INTEGER;
            ALTER TABLE images ADD COLUMN height INTEGER;",
      kind: MigrationKind::Up,
    },
  ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:secondbrain.db", migrations())
        .build(),
    )
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .manage(text_engine::TextEngineState::default())
    .manage(image_engine::ImageEngineState::default())
    .manage(decision_engine::DecisionEngineState::default())
    .manage(download::DownloadState::default())
    .invoke_handler(tauri::generate_handler![
      commands::import_gguf_model,
      commands::scan_gguf_folder,
      commands::import_image_model,
      commands::scan_image_model_folder,
      download::download_model,
      download::cancel_model_download,
      text_engine::start_text_engine,
      text_engine::stop_text_engine,
      text_engine::text_engine_status,
      text_engine::generate_text,
      text_engine::cancel_generation,
      image_engine::image_engine_status,
      image_engine::generate_image,
      image_engine::cancel_image_generation,
      image_engine::stop_image_engine,
      image_engine::read_image_data_url,
      decision_engine::decision_engine_status,
      decision_engine::make_decision,
      addons::install_addon,
      addons::uninstall_addon,
      addons::read_addon_data_url,
      addons::read_addon_content,
      addons::install_starter_addon
    ])
    .setup(|app| {
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .map_err(|e| {
      let msg = format!("Tauri run error: {e}");
      eprintln!("{msg}");
      let _ = std::fs::write("tauri_error.log", &msg);
      msg
    })
    .expect("error while running tauri application");
}
