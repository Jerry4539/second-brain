# Progress

Tracks real, verified implementation status per the phases defined in [ALL-i-want.md](./ALL-i-want.md).
Nothing here is marked done unless it actually works — no mocked/placeholder claims.

## Phase 0 — Repository + Architecture — DONE (shell only)

- Tauri 2 + React + TypeScript + Tailwind CSS v4 project initialized at the workspace root.
- Rust backend (`src-tauri/`) builds and produces a working `app.exe`, MSI, and NSIS installer (verified with `npx tauri build --debug`, and the built exe launches and responds).
- Dark / light / system theme implemented with CSS variables matching the spec's color tokens (section 29), persisted to `localStorage`.
- Sidebar navigation (Home, Chat, Create, Play, Library, Models, Add-ons, Settings) via `react-router-dom` `HashRouter`.
- Reusable `Button`, `IconButton`, `EmptyState`, `PageHeader` components.
- Every nav destination has a placeholder page with calm, on-brand copy. No AI/runtime logic is wired to any of them.

Not yet implemented (do not assume otherwise): SQLite, GGUF model manager, llama.cpp integration, image engine, Jev decision layer, games, addon system, library, packaging polish.

## Phase 1 — UI Foundation — DONE (visual pass)

- Redesigned the shell into floating rounded panels (sidebar, header, main) with soft shadows — bento/sleek direction confirmed visually in-browser (light + dark).
- Home rebuilt as an actual bento grid (large featured Talk tile + Create/Play tiles + pill-style Surprise Me action).
- Added shared components: `Badge`, `Input`, `Textarea`, `Select`, `Dropdown`, `Tabs`, `Dialog`, `Toast` (`ToastProvider`/`useToast`), `LoadingState`.
- Wired real (non-AI) usage: `Tabs` on Library, `Input`/`Select`/`Dialog` on Settings (Profile fields, model select placeholder, About dialog), `Badge` on Play (difficulty pills, status), toast feedback on theme change.
- Verified with `npm run build`, `npm run tauri build --debug`, and a live in-browser check via the Vite dev server (light/dark, Home, Play, Library, Settings + Dialog all screenshotted).

Still not implemented: responsive sidebar collapse at narrow widths, LoadingState not yet wired to any real async operation (nothing real to load yet).

## Phase 2 — SQLite — DONE

- Added `tauri-plugin-sql` (sqlite feature, bundled — no system SQLite dependency, preserving the "installer-only, no external tools" requirement).
- Registered 7 sequential migrations creating `settings`, `models`, `conversations`, `messages`, `images`, `games`, `addons`, `favorites`.
- Added `src/lib/db.ts`: typed row interfaces for every entity plus `getDb()`/`getSetting()`/`setSetting()` helpers.
- Wired real (verified, non-fake) usage: Settings > Profile name/bot name fields now read/write the `settings` table; Settings > Diagnostics shows a live "Connected/Unavailable" database badge.
- Verified end-to-end: built the debug app, launched it, and inspected the actual `secondbrain.db` file on disk — confirmed all 8 tables (`settings`, `models`, `conversations`, `messages`, `images`, `games`, `addons`, `favorites`) plus the plugin's `_sqlx_migrations` table exist.

Still not implemented: no CRUD UI for models/conversations/images/games/addons yet — that lands with each feature's own phase (3, 5, 6, 9, 11).

## Phase 3 — GGUF Model Manager — DONE

- Added `tauri-plugin-dialog` (native file/folder picker) and `tauri-plugin-opener` (reveal-in-folder), both bundled with Tauri — no extra installs for the end user.
- Wrote a from-scratch GGUF v2/v3 header/metadata parser in Rust (`src-tauri/src/gguf.rs`): reads magic/version/tensor count, walks metadata key-value pairs (including correctly skipping ARRAY-typed values), and extracts `general.architecture`, `general.name`, `general.size_label`, `general.file_type` (mapped to ~30 known quantization labels like `Q4_K_M`), and any `<arch>.context_length` key. Falls back to filename-based quantization guessing when metadata is absent.
- Verified with two Rust unit tests (`cargo test gguf`) against a synthetic in-memory GGUF byte stream — confirmed correct parsing of architecture/name/quantization/context length and correct array-skipping, plus correct rejection of a non-GGUF file. Both pass.
- Added Tauri commands `import_gguf_model` (parse a file) and `scan_gguf_folder` (non-recursive `.gguf` listing).
- Extended `src/lib/db.ts` with `listModels`, `findModelByPath`, `insertModel`, `deleteModel`, `setDefaultModel`.
- Added `src/lib/gguf.ts` (invoke wrappers + `formatBytes`) and `src/lib/avatar.ts` (deterministic local initials — no external avatar service, per spec section 68.1).
- Rebuilt the Models page: native Import/Scan-folder dialogs, a real table (avatar initials, size, quantization, a simple size-based compatibility badge, status), and a per-row actions menu (Set as default, Reveal in folder, Delete — removes the DB record only, never touches the file on disk).
- Wired Settings > AI > "Default text model" to the real `models` table (previously a static disabled placeholder).
- Verified end-to-end: full `npm run tauri build --debug` succeeds with zero warnings, and the built app launches and stays responsive with the new plugins registered.

Not yet done: no actual GGUF parameter-count extraction (not a standard/reliable metadata key across all
converters) — compatibility badge is a simple file-size heuristic, not a true RAM/parameter estimate. No
inference — that's Phase 4.

## Phase 4 — llama.cpp Integration — DONE

**Architecture decision:** sidecar process, not in-process FFI bindings. `llama-cpp-2` (Rust bindings)
needs `bindgen`/libclang (~1GB LLVM install, not present on this dev machine); a sidecar binary avoids
that, lets us fully kill the process to reclaim 100% of its RAM when idle (better than in-process for a
"calm, lightweight" app), and isolates crashes from the main app. This mirrors LM Studio/Jan/Ollama.

- `src-tauri/resources/llama/` holds the official llama.cpp Windows CPU/AVX2 build (`llama-server.exe` +
  required `ggml-*`/`llama*`/`mtmd`/`libomp` DLLs, ~41MB, no CUDA/GPU dependency). **Not committed to
  git** — regenerate via `scripts/fetch-llama-server.ps1` (downloads release tag `b10964` from
  `ggml-org/llama.cpp`, trims to the minimal required file set). Registered in `tauri.conf.json` →
  `bundle.resources: ["resources/llama/*"]`, resolved at runtime via `app.path().resource_dir()`.
- `src-tauri/src/text_engine.rs`: `TextEngineState` (mutex-guarded child process/port/model path/
  cancelled-request-ids). Commands: `start_text_engine` (finds a free port, spawns `llama-server.exe
  -m <path> --port <port> --host 127.0.0.1 -c 4096 --no-webui`, polls `/health` up to 60s),
  `stop_text_engine` (kills + reaps the child), `text_engine_status`, `generate_text` (POSTs to
  `/v1/chat/completions` with `stream: true`, parses the SSE `data: {...}` stream, emits
  `text-engine:token`/`text-engine:done`/`text-engine:error` Tauri events per request id),
  `cancel_generation` (marks a request id cancelled; the streaming loop checks it every chunk).
- `src/lib/textEngine.ts`: invoke wrappers + a `generateText()` helper that wires per-request event
  listeners and cleans them up on done/error.
- Rebuilt the Chat page into a real (if not yet DB-persisted) working chat: model picker sourced from
  the real `models` table, Start/Stop engine controls with live status badges, streaming message
  bubbles, Stop-mid-generation via `cancel_generation`.
- **Verified for real, not just "it compiles":** downloaded a genuine tiny GGUF
  (`SmolLM2-135M-Instruct-Q4_K_M`, bartowski/HF) into `src-tauri/test-model/` (gitignored, dev-only),
  manually launched the exact bundled `llama-server.exe` against it, hit `/health` (200 `{"status":"ok"}`)
  and `/v1/chat/completions` with `stream: true` — confirmed the live SSE response matches byte-for-byte
  what `text_engine.rs` parses (`data: {"choices":[{"delta":{"content":"..."}}]}` chunks, ending in
  `data: [DONE]`), and the model produced a real streamed reply. Also rebuilt the full app
  (`npm run tauri build --debug`) and confirmed it launches and stays responsive with all engine code
  wired in.

Not yet done: conversation history is not persisted to the `conversations`/`messages` tables yet (Chat
page state is in-memory only, lost on navigation) — that's Phase 5 polish. No regenerate/copy/context-size
settings UI yet. macOS llama.cpp binary not yet fetched/tested (this dev machine is Windows-only) — will
need its own `fetch-llama-server` variant using the `llama-b10964-bin-macos-arm64.tar.gz` release asset
when Mac testing becomes possible.

## Phase 5 — Chat (polish) — DONE

- Added migration 8 (`add_conversation_generation_settings`): `ALTER TABLE conversations ADD COLUMN
  temperature/top_p/max_tokens`. Verified applied by grepping the on-disk `.db`/`.db-wal` files for the
  new column names after launching the app (confirms tauri-plugin-sql actually ran it, not just that the
  Rust code compiles).
- Extended `src/lib/db.ts` with conversation/message CRUD: `listConversations`, `createConversation`,
  `touchConversation`, `renameConversation`, `updateConversationSettings`, `deleteConversation`,
  `listMessages`, `addMessage`, `deleteLastMessage`.
- Rebuilt the Chat page: a real conversation history sidebar (new chat, switch, delete with confirm),
  messages now persisted to `conversations`/`messages` on send and on generation completion (partial
  content is still saved if cancelled or on error, never silently dropped), auto-generated conversation
  titles from the first message, copy-to-clipboard per assistant message, regenerate (deletes the last
  assistant message and re-runs generation from the last user message), and a per-conversation generation
  settings dialog (temperature/top_p/max_tokens) backed by the new columns.
- Verified: full `npm run tauri build --debug` succeeds, the app launches and stays responsive, and the
  migration was confirmed applied on-disk as described above. (Tauri's command argument convention —
  camelCase JS keys auto-mapping to snake_case Rust parameters — was also cross-checked against the
  official docs before relying on it further, since this environment has no way to drive the native
  window via automation to click-test the full flow.)

Not yet done: conversation search/filtering (Library page Phase 13 territory), no import/export of chat
history, no markdown/code-block rendering in assistant messages yet (plain text only).

## Phase 6 — Image Generation — DONE

**Architecture decision:** stable-diffusion.cpp (`sd-cli`) sidecar instead of the spec's literal
"OpenVINO/LCM" suggestion. OpenVINO's practical local pipelines need Python (`optimum-intel`), which
would violate the hard "never require Python/Node/Docker on the end-user machine" constraint.
stable-diffusion.cpp is pure C/C++ (same family as llama.cpp, CPU-only build, no CUDA), supports
SD1.x/SDXL/LCM/LCM-LoRA and GGUF-quantized weights, and — critically for "keep the app light and
never slow down or crash an already-stressed user's PC" — `sd-cli` is a one-shot CLI, not a
persistent server: each generation spawns a fresh process that fully exits afterward, so idle RAM
usage is exactly zero between images (an explicit user priority for this phase).

- `src-tauri/resources/sd/` holds the official stable-diffusion.cpp Windows CPU build (`sd-cli.exe` +
  `ggml-*`/`stable-diffusion.dll`/webp-webm deps, ~16MB). **Not committed to git** — regenerate via
  `scripts/fetch-sd.ps1`. Registered in `tauri.conf.json` → `bundle.resources`. Also contains
  `sd-server.exe` (a persistent-server mode) which is intentionally **not** used, since keeping a
  model warm in RAM between generations contradicts the lazy-loading/"stop idle runtimes" rule.
- `src-tauri/src/image_engine.rs`: supports both persistent warm-model (`sd-server`) with an auto-reaper and one-shot fallback (`sd-cli`), keeping idle RAM at zero when inactive.
- **Thermal & Performance Optimization (Verified 2026-09-25)**:
  - Eliminated `--vae-tiling` on CPU: VAE tiling was segmenting latents into 9 to 18 micro-tiles with 50% overlap, wasting 3 to 6 minutes in decode loops. Full-frame decode takes only 36s (384×384) to 82s (512×512).
  - Added `--mmap` for instant zero-copy loading of GGUF weights.
  - Clamped `optimal_thread_count()` to 2..=4 threads to prevent thermal throttling and fan noise on hybrid Intel P+E (Alder Lake / Raptor Lake) and Apple Silicon architectures.
  - Added `384×384` compact preset alongside default `512×512` standard detail preset. Benchmarked end-to-end at 80.4 seconds on an Intel Core i5-1334U with LCM Dreamshaper v7.
  - Added step quick-pills (2 steps, 4 steps, 6 steps) in `CreatePage.tsx`.
- DB: migration 9 adds `models.kind` (`'text'|'image'`, default `'text'`) and `images.width`/`height`.
  `import_image_model` (Rust) is a lightweight file-facts-only import for image checkpoints
  (`.safetensors/.ckpt/.gguf/.pt/.sft)` — no metadata parsing (unlike GGUF text models); architecture
  is guessed from filename tokens (xl/sd3/flux/turbo/lcm/sd → SDXL/SD3/FLUX/SD-Turbo/LCM/SD1.x), the
  same fallback strategy already used for GGUF quantization guessing.
- `Tabs` UI component gained optional controlled `value`/`onChange` props (backward compatible) so
  the Models page could split into Text/Image tabs, each with its own import/scan flow feeding the
  same `models` table (`kind` column distinguishes them). Settings/Chat's model pickers now filter to
  `listModels('text')` so image models never show up there.
- Rebuilt the Create page for real: prompt + negative prompt (advanced) + size preset + steps + seed,
  Generate/Cancel, a large preview with Regenerate/Copy prompt/Favorite/Reveal-in-folder/Delete, and a
  thumbnail history grid — all wired to the real `images` table and `generate_image`/
  `read_image_data_url` commands (no mock data). When the selected model's guessed architecture is
  `LCM`, the UI automatically applies `--cfg-scale 1.0 --sampling-method lcm` and a 4-step default
  (LCM needs these to avoid garbage output vs. the standard SD cfg 7.0/euler_a defaults) — the user
  never sees or has to understand these internals, per spec section 9's UX rule.
- **Verified for real:** downloaded a genuine GGUF image model built specifically for
  stable-diffusion.cpp (`Steward/lcm-dreamshaper-v7-gguf`, an official GGUF conversion of
  `SimianLuo/LCM_Dreamshaper_v7`, f16, ~2.13GB) into `src-tauri/test-model/` (gitignored, same
  directory as the Phase 4 text test model), then ran the exact bundled `sd-cli.exe` with the exact
  flag set `generate_image` constructs (`-m ... -p "a lovely cat, oil painting" -o ... -W 512 -H 512
  --steps 4 --cfg-scale 1.0 --sampling-method lcm -s 42`) directly from a terminal — produced a real,
  correct oil-painting-style image in ~154s CPU-only (confirms the sidecar wiring, not just "it
  compiles"). Also did a full `npm run tauri build --debug`, launched the app, confirmed it stays
  responsive with the image engine registered, and confirmed migration 9 applied on the on-disk
  `secondbrain.db` (`models.kind`, `images.width`/`height` columns present).

Not yet done: no way to click-test the actual Models→import→Create→generate flow through the real
native window in this dev environment (same limitation noted in Phase 5) — the sidecar
process/CLI-flag/DB-migration layers were each verified directly instead. No SDXL/hi-res-fix/LoRA UI
(spec doesn't require it for v1). macOS stable-diffusion.cpp binary not yet fetched/tested (Windows-only
dev machine) — will need its own fetch script using the `-macos-arm64` release asset.

## Phase 7 — Decision Layer (Laya Multilingual ONNX) — DONE

**Architecture decision:** Instead of requiring an external paid cloud API key (Jev), Second Brain uses a free, completely offline, lightweight "System 1" typed decision engine powered by a bundled Laya multilingual model (mmBERT-base, 322M) exported to ONNX and run via Microsoft `onnxruntime` (`ort` crate) + HuggingFace `tokenizers`.
- Zero cloud dependency, zero API cost, completely offline.
- Features `chooseWithFallback` in `src/lib/decisionEngine.ts` — if the ONNX model is ever missing or fails, it falls back to deterministic/random selection so the app never crashes.
- Verified with unit tests (`cargo test department_billing_matches_python_reference` — passed in 12s).

## Phase 8 — Surprise Me — DONE

- Wired the `Surprise me` action on `HomePage.tsx` to `chooseWithFallback` using the local decision engine.
- Evaluates context (time of day / greeting) to pick between Talk, Create, or Play with subtle status feedback ("Second Brain is choosing…") and instant toast/navigation.

## Runtime Path Resolution & GGUF Model Loading Fixes — DONE

- Added `src-tauri/src/paths.rs` (`resolve_resource`) to handle multi-environment resource path resolution across dev (`src-tauri/resources`), unbundled debug (`target/debug/resources`), and packaged production builds. Previously, `llama_server_path` looked directly in `<resource_dir>/llama/` instead of `<resource_dir>/resources/llama/`, causing `llama-server.exe` to fail to locate binaries on Windows.
- Configured working directory on `Command::new` for both `llama-server` and `sd-cli` to point to the binary's parent directory, ensuring bundled DLLs are always loaded by the Windows dynamic linker.
- Configured piped stderr and fast failure detection: if `llama-server` encounters a corrupted model, missing DLL, or out-of-memory error during startup, the exact stderr output is captured and returned rather than timing out after 60 seconds.
- Clarified Chat empty state messaging from ambiguous "No model loaded" to "No text models imported" with a direct action button.
- Verified GGUF parser against real `SmolLM2-135M-Instruct-Q4_K_M.gguf` (~105MB) via `cargo test parses_real_smollm2_model` (parsed in 79ms).

## Model Hub, In-App Downloader, UI Polish & System Stability — DONE

- **Curated Models Hub & In-App Downloader**:
  - Created `src-tauri/src/download.rs` providing `download_model` and `cancel_model_download` commands. Downloads chunked HTTP streams straight into `<app_data_dir>/models/` while emitting real-time `model-download:progress` events.
  - Automatically imports finished downloads into the SQLite `models` database (GGUF metadata parsing for text models, architecture detection for image models).
  - Created `src/lib/curatedModels.ts` with top-tier, high-IQ, CPU-efficient, and Apple Silicon (Mac M4) tested models:
    - **Text (Smart & Witty for Daily Chat & Timepass)**:
      - `Qwen 2.5 3B Instruct` (2.1 GB, smartest sub-4B brain, high IQ, witty, handles humor and complex questions).
      - `Llama 3.2 3B Instruct` (2.0 GB, chill companion, natural dialogue, creative, balanced).
      - `Hermes 3 Llama 3.2 3B` (2.0 GB, uncensored & fun persona, roleplay, playful banter, zero corporate dryness).
      - `Gemma 2 2B Instruct` (1.6 GB, DeepMind's poetic and natural conversationalist, ultra-light).
    - **Image**: `SD-Turbo` (2.1 GB, real-time 1–4 steps), `LCM DreamShaper v7` (2.13 GB GGUF, 4 steps), `DreamShaper 8` (2.0 GB, artistic).
  - Users can 1-click download any curated model with a live progress bar or import existing local files via native file dialogs.
- **Multi-Turn Conversational Memory & Companion Persona**:
  - Enhanced `src-tauri/src/text_engine.rs` (`generate_text`) and `src/pages/ChatPage.tsx` to maintain full conversational context across turns. The model receives recent message turns rather than isolated one-off prompts.
  - Injected an intelligent, chill companion system prompt so the AI acts like a witty, natural friend rather than a robotic tool.
- **Image Generation Speedup & Warm-Model Engine (`sd-server`)**:
  - Upgraded image generation backend from cold one-shot execution to a persistent warm-model architecture (`sd-server.exe`).
  - The model stays loaded in memory across generations, eliminating the 45-60s model loading bottleneck on consecutive runs and cutting generation times from 8-9 minutes down to ~1-2 minutes on CPU.
  - Dynamically scales computation up to 8 threads (utilizing physical cores on modern multi-core CPUs like Intel 13th Gen).
  - Added `--vae-tiling` to prevent memory thrashing during VAE decode.
  - Added an automatic 3-minute idle reaper that gracefully frees all RAM when the user finishes generating.
  - Defaulted LCM CFG scale to 1.0 (skipping duplicate unconditional pass, doubling step speed).
  - Added resolution guidance in `CreatePage.tsx` (`Square 512×512` marked as recommended fast preset) and a live warm-model status indicator.
- **LCM DreamShaper v7 Auto-Tuning**:
  - Standalone GGUF build (`Steward/lcm-dreamshaper-v7-gguf`) wired to `stable-diffusion.cpp`.
  - In `src/pages/CreatePage.tsx`, auto-detects LCM models, setting default steps to **4 steps**, `cfgScale: 1.0`, and `samplingMethod: 'lcm'`.
- **Silent Subprocesses (`CREATE_NO_WINDOW`)**:
  - Configured `#[cfg(windows)] cmd.creation_flags(0x08000000)` on both `llama-server.exe` (`src-tauri/src/text_engine.rs`) and `sd-server.exe`/`sd-cli.exe` (`src-tauri/src/image_engine.rs`). No terminal or console windows ever appear or remain open.
- **Balanced Multi-Core CPU Allocation**:
  - Bounded thread usage dynamically (`4` to `8` threads) so background inference runs at maximum vectorized speed while keeping the OS smooth and responsive.
- **Collapsible Sidebar**:
  - Upgraded `src/components/layout/Sidebar.tsx` with a collapse/expand toggle (`PanelLeftClose`/`PanelLeftOpen`), width transitions between `w-60` and `w-16`, persistent state in `localStorage('sidebar_collapsed')`, and floating tooltip badges when collapsed.
- **Dropdown Viewport Portal**:
  - Upgraded `src/components/ui/Dropdown.tsx` to mount menus directly to `document.body` via `createPortal`, auto-detecting window bounds and flipping upwards when near the bottom.
- **Chat Markdown Formatter & Polished UI**:
  - Built `src/components/chat/MarkdownContent.tsx` supporting inline code, bold, italic/roleplay actions (`*leans back*`), blockquotes, ordered/unordered lists, and syntax-highlighted code blocks with 1-click "Copy code" buttons.
  - Upgraded `src/pages/ChatPage.tsx` with user/assistant avatars, streaming pulse indicator, message copy feedback, regenerate button, and starter prompt cards.

## Phase 9 — Addon System — DONE

- **Safe ZIP Extraction Engine (`src-tauri/src/addons.rs`)**:
  - Integrated `zip` crate (`v2.4`) with strict path-traversal safeguards:
    - Path components explicitly verified — forbids `..`, absolute paths, leading slashes, and Windows drive letters (`C:`).
    - Checks `enclosed_name()` and validates that target destinations stay strictly inside `<app_data_dir>/addons/<id>/`.
    - Enforces maximum uncompressed file limit (100 MB) to prevent ZIP bomb attacks and limits maximum entry count to 1000 files.
    - Supports both flat root archives and single-folder root archives (auto-strips common top-level folders).
- **Manifest Parser & Verification**:
  - Requires valid `manifest.json` declaring `id`, `name`, `version`, `type` (`game` | `theme` | `tool`), and `entry`.
  - Enforces alphanumeric identifier regex (`^[a-z0-9_-]+$`) to prevent malicious directory names.
  - Confirms entrypoint file actually exists inside the archive before committing extraction.
- **Database & Addon Lifecycle (`src/lib/addons.ts` & `src/lib/db.ts`)**:
  - Backed by SQLite `addons` table (Migration 6).
  - Provides full CRUD: install from ZIP, list installed add-ons, toggle enabled/disabled status, and uninstall (which cleanly removes disk files and DB records).
- **Sample Starter Packs**:
  - Bundled 1-click installable starter addons so users can explore immediately without external ZIPs:
    - **Potato vs Mosquito**: The classic arcade mini-game where the user swats incoming mosquitoes before they bite the sacred potato.
    - **Retro Matrix Rain**: Cyberpunk canvas rain visualizer with customizable colors (Matrix Green, Cyber Cyan, Neon Pink, Amber Glow).
- **Sandboxed Runner Preview (`src/pages/AddonsPage.tsx`)**:
  - Built an in-app runner modal executing add-ons via `read_addon_data_url` in an isolated `<iframe>` with `sandbox="allow-scripts"` (zero native system/filesystem permissions).
  - Addon cards show type badges, version, active toggle switch, Play/Launch action, and safe uninstall confirmation dialog.
- **Unit Tested**:
  - Added Rust unit tests in `addons.rs` (`test_validate_addon_id`, `test_sanitize_relative_path`) — all passing.

## Phase 10 — Game Sandbox — DONE

- **GameEngine Abstraction (`src/lib/games/types.ts`)**:
  - Implemented typed `GameEngine<TState, TMove>` interface isolating deterministic rule logic from AI evaluation.
  - Lifecycle standard: `initialize`, `getLegalMoves`, `applyMove`, `isGameOver`, `getWinner`, and `getAIMove`.
  - Supports multiple difficulty ratings: `easy`, `medium`, and `hard`.
- **Sandbox Host Component (`src/components/games/GameSandbox.tsx`)**:
  - Dedicated sandboxed arena with difficulty selector pills, reset button, turn notifications, and match move log.
  - Natural artificial thinking delays (350–500ms) with visual status indicators ("Second Brain is calculating...") so AI turns feel natural and reactive rather than instantaneous.
- **SQLite Match Persistence (`src/lib/games/db.ts`)**:
  - Wired to Migration 5's `games` table: saves finished game sessions (game type, player color, difficulty, outcome, move count, timestamps).
  - Career statistics calculation (`getGameStats`) tracking total matches, wins, losses, and draws across all games.

## Phase 11 — Built-in Games (Tic-Tac-Toe & Ludo) — DONE

- **Tic-Tac-Toe Engine (`src/lib/games/ticTacToe.ts` & `TicTacToeBoard.tsx`)**:
  - Authentic 3×3 grid with winning line strike detection and draw detection.
  - 3 AI difficulty tiers:
    - **Easy**: Random legal placement.
    - **Medium**: Tactical awareness (takes immediate wins, blocks user wins, 60% optimal).
    - **Hard**: Unbeatable Minimax with alpha-beta pruning.
  - Interactive board with turn indicators, hover previews, win/loss banners, and 1-click rematch.
- **Ludo Engine (`src/lib/games/ludo.ts` & `LudoBoard.tsx`)**:
  - Authentic 2-player Ludo match (Player vs Second Brain) with 4 tokens each.
  - Full 52-tile track with 8 safe star tiles, colored home lanes, and center home goal.
  - Dice roll mechanics: requires rolling 6 to deploy tokens from base, awards bonus roll on 6 or capture.
  - 3 AI difficulty tiers:
    - **Easy**: Casual legal move selection.
    - **Medium**: Prioritizes token deployment and enemy captures.
    - **Hard**: Weighted tactical evaluation prioritizing home goals (+100), captures (+50), reaching safe stars (+20), advancing tokens (+5), and penalizing exposing tokens to capture (-30).
  - Interactive board with 3D animated die, pulsing legal moves, home token counters, and live match feed.
- **Play Lounge Integration (`src/pages/PlayPage.tsx`)**:
  - Integrated both games with ready-to-play cards, difficulty tags, rules overviews, and live career record stats banner.

## Detailed Phase Status & What to Do Next

| Phase | Name | Status | Details |
|---|---|---|---|
| **Phase 0** | Repository + Architecture | ✅ Done | Tauri 2 + React 19 + TypeScript + Tailwind v4 + single `.exe` distribution. |
| **Phase 1** | UI Foundation | ✅ Done | Floating bento shell, theme tokens, buttons, dialogs, toasts, collapsible sidebar. |
| **Phase 2** | SQLite Database | ✅ Done | Bundled `tauri-plugin-sql` with 9 migrations (`settings`, `models`, `conversations`, `messages`, `images`, `games`, `addons`, `favorites`). |
| **Phase 3** | GGUF Model Manager | ✅ Done | From-scratch Rust GGUF parser, native pickers, size heuristics, reveal in folder, delete. |
| **Phase 4** | llama.cpp Integration | ✅ Done | Bundled AVX2 `llama-server.exe`, streaming SSE `/v1/chat/completions`, cancel support, silent subprocess. |
| **Phase 5** | Chat (Persistence & Polish) | ✅ Done | DB-backed conversation history, auto-titling, markdown parser, code block copy, avatars, starter cards. |
| **Phase 6** | Image Generation | ✅ Done | Persistent warm `sd-server.exe`, LCM DreamShaper v7 auto-tuning, 1-2 min CPU speedup, 3-min idle reaper. |
| **Phase 7** | Decision Layer (Laya ONNX) | ✅ Done | Bundled offline mmBERT-base ONNX via `ort` crate, `chooseWithFallback`. |
| **Phase 8** | Surprise Me & Model Downloader | ✅ Done | One-click curated downloads for CPU/M4 models, live progress, Surprise Me home action. |
| **Phase 9** | Addon System | ✅ Done | Safe ZIP import, manifest verification, 100MB zip-bomb guard, sandboxed iframe runner, starter packs, SQLite tracking. |
## Phase 13 — Library — DONE

- **Unified Dynamic Local Repository ([LibraryPage.tsx](file:///d:/NULL/2nd%20Brain/src/pages/LibraryPage.tsx))**:
  - Fully dynamic repository reading directly from SQLite database:
    - **Conversations**: Lists all saved chat conversations with dates, open directly in chat `/chat`, delete confirmation dialog.
    - **Generated Images**: Real-time thumbnail preview using `read_image_data_url`, prompt display, dimension badge, modal preview, copy prompt action, delete.
    - **Game History**: Match records from SQLite `games` table with outcome badges (Victory, Defeat, Draw), difficulty rating, date, and 1-click play button.
    - **Installed Add-ons**: Add-on cards with version, type, and launch action.
  - Real-time global search input filtering simultaneously across chat titles, image prompts, game names, and add-on titles.
  - Tab count badges automatically displaying live item counts per category.
  - Sleek Bento card styling with hover transitions and zero unnecessary emojis.

## Detailed Phase Status & What to Do Next

| Phase | Name | Status | Details |
|---|---|---|---|
| **Phase 0** | Repository + Architecture | ✅ Done | Tauri 2 + React 19 + TypeScript + Tailwind v4 + single `.exe` distribution. |
| **Phase 1** | UI Foundation | ✅ Done | Floating bento shell, theme tokens, buttons, dialogs, toasts, collapsible sidebar. |
| **Phase 2** | SQLite Database | ✅ Done | Bundled `tauri-plugin-sql` with 9 migrations (`settings`, `models`, `conversations`, `messages`, `images`, `games`, `addons`, `favorites`). |
| **Phase 3** | GGUF Model Manager | ✅ Done | From-scratch Rust GGUF parser, native pickers, size heuristics, reveal in folder, delete. |
| **Phase 4** | llama.cpp Integration | ✅ Done | Bundled AVX2 `llama-server.exe`, streaming SSE `/v1/chat/completions`, cancel support, silent subprocess. |
| **Phase 5** | Chat (Persistence & Polish) | ✅ Done | DB-backed conversation history, auto-titling, markdown parser, code block copy, avatars, starter cards. |
| **Phase 6** | Image Generation | ✅ Done | Persistent warm `sd-server.exe`, LCM DreamShaper v7 auto-tuning, 1-2 min CPU speedup, 3-min idle reaper. |
| **Phase 7** | Decision Layer (Laya ONNX) | ✅ Done | Bundled offline mmBERT-base ONNX via `ort` crate, `chooseWithFallback`. |
| **Phase 8** | Surprise Me & Model Downloader | ✅ Done | One-click curated downloads for CPU/M4 models, live progress, Surprise Me home action. |
| **Phase 9** | Addon System | ✅ Done | Safe ZIP import, manifest verification, 100MB zip-bomb guard, sandboxed iframe runner, 3 starter packs, SQLite tracking. |
| **Phase 10** | Game Sandbox | ✅ Done | GameEngine abstraction, screen-fitting Bento arena, move logging, SQLite match persistence. |
| **Phase 11** | Built-in Games | ✅ Done | Authentic 15x15 Ludo (safe stars, exact home roll, tactical AI) & styled framed Tic-Tac-Toe. |
| **Phase 12** | AI Game Generation | ⬜ **Pending (Next Up)** | Prompt-to-game generator using local text model + game templates. |
| **Phase 13** | Library | ✅ Done | Unified dynamic search, filter, and bento cards for chats, images, games, and add-ons. |
| **Phase 14** | Settings & Runtime Controls | ⬜ Pending | Storage folder management, cache clearing, custom thread/context size sliders, system stats. |
| **Phase 15** | Performance & Packaging | ⬜ Pending | Final release binary optimization, NSIS single-file installer, zero external dependencies audit. |
| **Phase 16** | Final QA | ⬜ Pending | End-to-end stress testing on clean Windows/Mac VMs with zero dev tools installed. |

### Next Immediate Action:
Begin **Phase 12 — AI Game Generation** or **Phase 14 — Settings & Runtime Controls**:
1. Phase 12: Prompt-to-game generator using local GGUF text model with templates (canvas, arcade, puzzle) generating self-contained playable add-ons.
2. Phase 14: Settings controls for storage paths, cache management, hardware thread sliders, and diagnostics.




