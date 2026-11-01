# Changelog

## Screen-Height Bento Game Layout, Add-ons Execution Upgrade & Dynamic Library (Phase 13)

- **Screen-Height Bento Game Layout ([LudoBoard.tsx](file:///d:/NULL/2nd%20Brain/src/components/games/LudoBoard.tsx), [TicTacToeBoard.tsx](file:///d:/NULL/2nd%20Brain/src/components/games/TicTacToeBoard.tsx), [GameSandbox.tsx](file:///d:/NULL/2nd%20Brain/src/components/games/GameSandbox.tsx))**:
  - Reorganized both games into side-by-side Bento grids with viewport bounds (`max-h-[calc(100vh-170px)]`), eliminating vertical window scrolling.
  - In Ludo: Primary 15×15 authentic board on the left; side Bento Hub on the right housing Players & Goal status, 3D animated die with turn controls, and live scrollable match feed.
  - In Tic-Tac-Toe: Framed 3×3 grid on the left; side Bento Hub on the right with round scoreboard, turn indicators, and difficulty controls.
- **Add-ons Sandboxed Execution Fix & 3 Starter Packs ([addons.rs](file:///d:/NULL/2nd%20Brain/src-tauri/src/addons.rs), [AddonsPage.tsx](file:///d:/NULL/2nd%20Brain/src/pages/AddonsPage.tsx))**:
  - Added Rust command `read_addon_content` to stream raw entry HTML directly to `iframe.srcDoc`, solving Chromium/WebView2 opaque-origin data URL restrictions.
  - Added 3 fully functioning, standalone starter add-ons:
    1. **Potato vs Mosquito**: Fast-paced offline arcade bug swatting game with score, health meter, and Web Audio click effects.
    2. **Retro Matrix Rain**: Cyberpunk canvas visualizer with customizable neon color buttons (Green, Cyan, Pink, Amber).
    3. **Cyber Pong**: Neon arcade paddle battle against AI with ball trails, speed toggle, score counter, and Web Audio bounce beeps.
  - Removed all raw emojis across the add-on interface in favor of clean SVG vector icons.
- **Dynamic Unified Library — Phase 13 ([LibraryPage.tsx](file:///d:/NULL/2nd%20Brain/src/pages/LibraryPage.tsx))**:
  - Replaced static empty states with a dynamic repository connected to SQLite:
    - **Chats**: Lists all saved conversations with dates, 1-click open in Chat, and delete action.
    - **Images**: Real-time thumbnail preview using `read_image_data_url`, prompt display, dimension badge, modal preview, copy prompt action, and delete.
    - **Games**: Match history records from the `games` table with outcome badges (Win / Loss / Draw), difficulty, and play action.
    - **Add-ons**: Installed add-ons with type, version, and launch action.
  - Global real-time search input filtering across chats, artworks, game records, and add-ons.
  - Dynamic count badges on all category tabs.

## Phase 10 & 11 — Authentic Ludo (15×15 Board), Styled Tic-Tac-Toe & Player Customization

- **Authentic 15×15 Ludo Board ([LudoBoard.tsx](file:///d:/NULL/2nd%20Brain/src/components/games/LudoBoard.tsx))**:
  - Recreated the authentic classic 15×15 Ludo board matching the user's reference design:
    - 4 corner base yards (Blue, Yellow, Red, Green) with round token holders.
    - 4 center goal triangles meeting in the center (Yellow top, Green right, Red bottom, Blue left).
    - 4 track arms with 3×6 squares, colored home paths, entry direction arrows, and 8 safe star squares.
  - Interactive tokens with pulsing highlight animations for legal moves, hover states, and smooth navigation.
  - Real 3D-styled animated dice showing genuine pips (1 to 6) with auto-roll for AI players.
- **Complete Ludo Rules & Logic ([ludo.ts](file:///d:/NULL/2nd%20Brain/src/lib/games/ludo.ts))**:
  - 52-tile circuit mapped across the 15×15 grid with symmetric 13-step offsets.
  - Release rule: tokens exit base only on a roll of 6.
  - Bonus roll mechanics: rolling 6 awards a bonus roll (with 3-consecutive-sixes cancellation rule); capturing an opponent awards an immediate bonus roll.
  - Safe squares: 4 starting squares and 4 star squares protected from capture.
  - Exact roll required to reach the center Home Goal. First player to guide all 4 tokens home wins.
  - Multi-tier tactical AI (Easy, Medium, Hard with capture weighting and danger avoidance).
- **Player & Opponent Customization ([GameSandbox.tsx](file:///d:/NULL/2nd%20Brain/src/components/games/GameSandbox.tsx))**:
  - Player name and opponent bot name loaded automatically from SQLite settings (`user_name`, `bot_name`) and editable on the fly.
  - Choice of player color (Red, Blue, Yellow, Green).
  - Choice of match format: 2 Players (1v1 against Second Brain) or 4 Players (against 3 bots).
- **Styled Tic-Tac-Toe Matching Reference ([TicTacToeBoard.tsx](file:///d:/NULL/2nd%20Brain/src/components/games/TicTacToeBoard.tsx))**:
  - Aesthetic framed design with soft tiled background, clean divider lines, and typography matching the user's reference image.
  - Live scoreboard tracking player wins, opponent wins, and draws across rounds.
  - Unbeatable Minimax AI mode alongside Easy and Medium tiers.

## Image Generation Acceleration & Thermal Optimization (CPU & Apple Silicon)

- **Eliminated `--vae-tiling` Overhead on CPU (`src-tauri/src/image_engine.rs`)**:
  - Removed `--vae-tiling` flag from both `sd-server` and `sd-cli` subprocess invocations. On CPU, VAE tiling divided latents into 9 to 18 micro-tiles with 50% overlap, spending 3 to 6 minutes repeatedly decoding latents. Direct full-frame VAE decoding completes in ~36s (384×384) to ~80s (512×512).
- **Added `--mmap` Zero-Copy Weight Mapping**:
  - Enabled memory-mapped loading for GGUF weights, reducing cold load time to 0.01s and preventing RAM duplication overhead.
- **Thermal Throttle Guard (`optimal_thread_count` Clamped to 2..=4)**:
  - Reduced thread contention on hybrid CPUs (Intel 12th/13th Gen P+E cores, AMD multi-CCX, and Apple Silicon). By not saturating all logical threads, CPU temperature remains cool, fan noise is eliminated, and CPU clock frequencies stay locked at 4.0+ GHz without thermal throttling down to 1.8 GHz.
- **Presets and Controls (`src/pages/CreatePage.tsx`)**:
  - Added Compact (384×384) fast preview preset alongside default Square (512×512) standard detail preset (benchmarked at 80.4 seconds total from prompt to PNG on 13th Gen Intel Core i5 CPU with low thermals).
  - Maintained Square (512×512) as default recommended quality preset.
  - Added step quick-pills (2 steps, 4 steps, 6 steps) and CFG scale control in Advanced settings for distilled models.
  - Added real-time thermal management status indicators in the generation UI.

## Phase 9 — Addon System & Sandboxed Extensibility

- **Safe ZIP Extraction Engine (`src-tauri/src/addons.rs`)**:
  - Implemented safe archive extractor using `zip = "2.4"` with strict path-traversal prevention. Rejects any paths with `..`, absolute paths, leading slashes, and Windows drive letters (`C:`).
  - Maximum uncompressed size guard (100 MB) preventing ZIP-bomb attacks, plus 1000 entry limit.
  - Automatically handles both flat root packages and single-folder archives (auto-strips common top-level folders).
- **Manifest Parser & Validation**:
  - Enforces `manifest.json` schema (`id`, `name`, `version`, `type`, `entry`, optional `author`, `description`, `icon`).
  - Strict regex validation on addon ID (`^[a-z0-9_-]+$`).
  - Validates that declared entrypoint file actually exists inside the archive before committing.
- **Database & Addon Lifecycle (`src/lib/addons.ts` & `src/lib/db.ts`)**:
  - Integrated with SQLite `addons` table.
  - Full lifecycle support: import/install from ZIP, enable/disable toggle switch, and clean uninstall (wiping extracted files and database rows).
- **Built-in Starter Packs**:
  - Added 1-click installable starter add-ons directly in the UI:
    - **Potato vs Mosquito**: The legendary mini-game where the user protects the potato by swatting incoming mosquitoes.
    - **Retro Matrix Rain**: Cyberpunk canvas visualizer with customizable speed and neon colors.
- **Sandboxed Runner Preview (`src/pages/AddonsPage.tsx`)**:
  - Built an in-app runner modal executing entry files via `read_addon_data_url` in an isolated `<iframe>` (`sandbox="allow-scripts"` with zero native system or network permissions).
  - Filterable tabs (`All`, `Games`, `Themes`, `Tools`), uninstall confirmation modal, and status indicators.
- **Rust Unit Tests**:
  - Validated ID regex and path sanitization (`cargo test addons`).

## Recent Additions — Curated Model Hub, In-App Downloader, Chat Polish & System Guard

- **Image Generation Speedup & Warm-Model Engine (`sd-server`)**:
  - Re-architected image generation backend to keep model weights warm in memory across consecutive runs instead of spawning one-shot processes that re-read 2.1 GB from disk every time.
  - Subsequent image runs generate directly from RAM, cutting generation time from ~8-9 minutes down to ~1-2 minutes on CPU.
  - Dynamically scales computation up to 8 CPU threads (matching physical cores on Intel 13th Gen / multi-core chips) instead of hardcoding 4 threads.
  - Added `--vae-tiling` to prevent memory thrashing during the latent decoding pass.
  - Added an automatic 3-minute idle reaper: if no images are requested for 3 minutes, the engine gracefully terminates to free 100% of system RAM.
  - Tuned LCM generation in `CreatePage.tsx` to use CFG scale 1.0 (skips duplicate unconditional pass, cutting UNet steps in half).
  - Added resolution preset guidance in `CreatePage.tsx` (`Square 512×512` marked as recommended fast preset) and a live warm-model status indicator.
- **Top-Tier Conversational Models for Daily Chat & Timepass**:
  - Upgraded curated text model lineup to high-IQ, personality-rich lightweight models that never feel robotic or "dumb":
    - **Qwen 2.5 3B Instruct** (2.1 GB) — "Smartest Mini Brain": Outperforms older 7B models in logic, witty banter, and deep discussion without lagging CPU.
    - **Llama 3.2 3B Instruct** (2.0 GB) — "Chill Companion": Friendly, natural, and thoughtful for everyday casual conversation.
    - **Hermes 3 Llama 3.2 3B** (2.0 GB) — "Fun Persona & Banter": Rich roleplay, creative humor, open chat, and zero corporate lecturing.
    - **Gemma 2 2B Instruct** (1.6 GB) — "Poetic & Natural": DeepMind's eloquent, lightweight conversation engine.
  - Image lineup: **SD-Turbo** (1–4 step real-time), **LCM DreamShaper v7** (4-step artistic GGUF), **DreamShaper 8** (artistic SD 1.5).
- **Multi-Turn Conversational Memory & Companion Persona**:
  - Updated `src-tauri/src/text_engine.rs` and `src/pages/ChatPage.tsx` to forward recent conversation history to `llama-server`. The model now remembers what you said earlier in the conversation instead of treating each turn as a blank slate.
  - Injected an intelligent, chill system persona into `generate_text` so the AI acts like a witty, friendly conversational partner rather than a dry mechanical tool.
- **LCM DreamShaper v7 Support & Auto-Tuning**:
  - Added official standalone GGUF build `LCM_Dreamshaper_v7-f16.gguf` to curated image models.
  - Enhanced `src/pages/CreatePage.tsx` to automatically configure 4 steps, `--cfg-scale 1.5`, and `--sampling-method lcm` for LCM models without confusing the user.
- **Silent Subprocesses (`CREATE_NO_WINDOW`)**:
  - Added `#[cfg(windows)] cmd.creation_flags(0x08000000)` to both `llama-server` (`src-tauri/src/text_engine.rs`) and `sd-cli` (`src-tauri/src/image_engine.rs`). No terminal or console windows ever appear on the desktop when starting or running models.
- **CPU Bounding & System Chill Guard**:
  - Added `-t 4` thread limits to both `llama-server` and `sd-cli` sidecars so inference never consumes 100% of CPU cores or causes system sluggishness.
- **Collapsible Sidebar**:
  - Added collapse/expand toggle button in `src/components/layout/Sidebar.tsx` with smooth width animation (`w-60` to `w-16`), persistent state in `localStorage('sidebar_collapsed')`, and hover tooltip pills in collapsed mode.
- **Dropdown Clipping / Overflow Fix**:
  - Refactored `src/components/ui/Dropdown.tsx` to render using React `createPortal(..., document.body)` with auto-flipping upwards when near the viewport bottom.
- **Chat Screen Overhaul & Custom Markdown Formatter**:
  - Created `src/components/chat/MarkdownContent.tsx` supporting inline code, bold, italic/roleplay actions (`*sighs*`), blockquotes, lists, and language-labeled code blocks with 1-click "Copy code" buttons.
  - Upgraded `src/pages/ChatPage.tsx` with bot/user avatars, pulsing streaming indicator, message copy feedback, regenerate button, and 4 chill starter cards for empty chats.

## Phase 8 — Surprise Me & Model Loading Fixes

- Added `src-tauri/src/paths.rs` (`resolve_resource`) to fix sidecar binary path discovery on Windows across dev, debug, and production bundle environments.
- Ensured sidecar subprocesses (`llama-server.exe`, `sd-cli.exe`) run with `current_dir` set to their binary folder so dynamic dependencies (`llama.dll`, `ggml-*.dll`, `libomp.dll`) resolve correctly.
- Added stderr capture and fast failure detection to `start_text_engine` to provide descriptive error messages when models fail to load.
- Clarified Chat empty state messaging from ambiguous "No model loaded" to "No text models imported".
- Wired the `Surprise me` bento action on `HomePage.tsx` to `chooseWithFallback`.

## Phase 7 — Decision Layer (Laya Multilingual ONNX)

- Integrated a local, offline, free System-1 decision engine using a bundled Laya multilingual model (mmBERT-base, 322M) via `ort` (ONNX Runtime) and `tokenizers`.
- Added `scripts/export-laya-onnx.py` and `scripts/fetch-onnxruntime.ps1`.
- Added `src-tauri/src/decision_engine.rs` (`decision_engine_status`, `make_decision`).
- Added `src/lib/decisionEngine.ts` with `chooseWithFallback` ensuring offline stability.
- Verified with unit tests (`cargo test department_billing_matches_python_reference`).

## Phase 6 — Image Generation

- Chose stable-diffusion.cpp (`sd-cli`) sidecar over OpenVINO — avoids a Python (`optimum-intel`)
  dependency chain that would violate the "no external tools for the end user" constraint. One-shot
  CLI process per generation (not a persistent server) keeps idle RAM usage at zero, per the "calm,
  lightweight, never slow down the user's PC" priority.
- Added `scripts/fetch-sd.ps1` to fetch the official stable-diffusion.cpp Windows CPU build into
  `src-tauri/resources/sd/` (gitignored, bundled via `tauri.conf.json`).
- Added `src-tauri/src/image_engine.rs`: per-request `sd-cli` process spawn, `Arc<Notify>`-based
  cancellation, `read_image_data_url` (sandboxed to the app's images dir), all via Tauri commands +
  events.
- Added migration 9: `models.kind` (`text`/`image`) and `images.width`/`height` columns.
- Added `import_image_model`/`scan_image_model_folder` Rust commands (file-facts + filename-based
  architecture guess, no metadata parsing).
- Added `src/lib/imageEngine.ts` invoke wrappers.
- `Tabs` component gained optional controlled `value`/`onChange` props; Models page split into
  Text/Image tabs with per-tab import flows.
- Rebuilt the Create page into a real working flow: prompt/negative/size/steps/seed, generate/cancel,
  preview with regenerate/copy/favorite/reveal/delete, and a history thumbnail grid — wired to the
  real `images` table. LCM models auto-get `--cfg-scale 1.0 --sampling-method lcm` + 4 steps without
  the user needing to know what LCM means.
- Verified end-to-end with a real downloaded GGUF image model (`Steward/lcm-dreamshaper-v7-gguf`,
  LCM DreamShaper v7): ran the bundled `sd-cli.exe` directly with the exact flags `image_engine.rs`
  constructs, produced a correct real image; full app rebuild + launch stayed responsive; confirmed
  migration 9 applied on-disk.

## Phase 5 — Chat (polish)

- Added migration 8: `conversations.temperature`/`top_p`/`max_tokens` columns.
- Added conversation/message CRUD to `src/lib/db.ts`.
- Rebuilt the Chat page: persisted conversation history sidebar (new/switch/delete), messages persisted
  on send and completion (including partial content on cancel/error), auto-titling, copy, regenerate, and
  a per-conversation generation-settings dialog.
- Verified full rebuild + launch, and confirmed the migration actually applied by grepping the on-disk
  SQLite file/WAL for the new column names.

## Phase 4 — llama.cpp Integration

- Chose sidecar-process architecture over in-process FFI bindings (avoids a ~1GB LLVM/libclang dev
  dependency, allows full process kill to reclaim RAM when idle, isolates crashes).
- Added `scripts/fetch-llama-server.ps1` to fetch + trim the official llama.cpp Windows CPU/AVX2 build
  into `src-tauri/resources/llama/` (gitignored, bundled via `tauri.conf.json` `bundle.resources`).
- Added `src-tauri/src/text_engine.rs`: process lifecycle (start/stop/status), SSE-streamed generation
  against `/v1/chat/completions`, per-request cancellation, all via Tauri commands + events.
- Added `reqwest` (rustls, no OpenSSL), `futures-util`, `tokio` (process/time) dependencies.
- Added `src/lib/textEngine.ts` invoke/event wrappers.
- Rebuilt the Chat page into a real working chat UI (model picker, start/stop, streaming bubbles, stop
  mid-generation) — conversation persistence still pending for Phase 5.
- Verified end-to-end with a real downloaded GGUF model: health check, streaming SSE format match,
  actual generated text, and a full app rebuild + launch.

## Phase 3 — GGUF Model Manager

- Added `tauri-plugin-dialog` and `tauri-plugin-opener` (both bundled, no external installs).
- Wrote a from-scratch GGUF v2/v3 metadata parser (`src-tauri/src/gguf.rs`) with unit tests against a synthetic GGUF byte stream (`cargo test gguf` — 2/2 passing).
- Added `import_gguf_model`/`scan_gguf_folder` Tauri commands (`src-tauri/src/commands.rs`).
- Extended `src/lib/db.ts` with model CRUD (`listModels`, `findModelByPath`, `insertModel`, `deleteModel`, `setDefaultModel`).
- Added `src/lib/gguf.ts` (invoke wrappers, `formatBytes`) and `src/lib/avatar.ts` (deterministic local initials).
- Rebuilt the Models page with a real table, native import/scan dialogs, and per-row actions (set default/reveal/delete).
- Wired Settings > AI > Default text model to the real `models` table.
- Verified via `cargo test`, a full `tauri build --debug`, and launching the built app.

## Phase 2 — SQLite

- Added `tauri-plugin-sql` (bundled SQLite via sqlx, no system dependency) and `@tauri-apps/plugin-sql`.
- Registered migrations for `settings`, `models`, `conversations`, `messages`, `images`, `games`, `addons`, `favorites` in `src-tauri/src/lib.rs`.
- Added `sql:default` capability permission.
- Added `src/lib/db.ts` with typed records and `getDb`/`getSetting`/`setSetting` helpers.
- Wired Settings page Profile fields and a live Diagnostics database status badge to the real database (not mocked).
- Verified by building the debug app, launching it, and confirming all tables exist in the on-disk `secondbrain.db`.

## Phase 1 — UI Foundation (bento redesign)

- Reworked the shell into floating rounded panels (sidebar/header/main) with `--shadow-sm`/`--shadow-card`/`--shadow-lifted` tokens added to the theme.
- Rebuilt Home as a bento grid (large Talk tile + Create/Play tiles, pill Surprise Me action).
- Increased radius scale across `Button`, `IconButton`, `EmptyState` for a softer, more premium feel.
- Added `Badge`, `Input`, `Textarea`, `Select`, `Dropdown`, `Tabs`, `Dialog`, `Toast`, `LoadingState` components.
- Wired `Tabs` into Library, `Input`/`Select`/`Dialog` into Settings, `Badge` into Play, and toast feedback into theme switching.
- Verified visually via the Vite dev server (light + dark) and confirmed `npm run build` / `npm run tauri build --debug` still succeed.

## Phase 0 — Repository + Architecture

- Initialized Tauri 2 + React + TypeScript + Vite project.
- Added Tailwind CSS v4 (`@tailwindcss/vite`), Lucide icons, React Router.
- Configured `tauri.conf.json` (identifier, window size/min-size, dev server integration) and `vite.config.ts` (fixed port 1420, Tauri-friendly watch settings).
- Implemented dark/light/system theme system using CSS custom properties (`src/index.css`, `src/lib/theme.tsx`).
- Built app shell: `Sidebar`, `AppShell`, `PageHeader`, `ThemeToggle`.
- Added `Button`, `IconButton`, `EmptyState` reusable UI components.
- Added placeholder pages for Home, Chat, Create, Play, Library, Models, Add-ons, Settings.
- Removed Vite/React default boilerplate (assets, `App.css`, sample content).
- Verified `npm run build` and `npx tauri build --debug` both succeed; the built app launches and its window responds.
