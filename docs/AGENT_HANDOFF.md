# Agent Handoff — Second Brain

> **Read this file FIRST, then [ALL-i-want.md](./ALL-i-want.md) (the full product spec), then
> [docs/PROGRESS.md](./PROGRESS.md) and [docs/CHANGELOG.md](./CHANGELOG.md) before touching any code.**
>
> This file exists so a brand-new chat session (no prior history) can pick up this project and
> continue it correctly. It is a snapshot of everything an agent has learned so far: what's built,
> what conventions are locked in, what gotchas exist, and what's left to do. Keep it updated after
> every phase — treat it as more important than any individual chat's memory.

---

## 1. What this project is

**Second Brain** — a calm, offline-first desktop app (Tauri 2 + React + Rust) for chatting with a
local GGUF model, generating images locally, playing games against a local AI, and general
"personal space" experimentation. Full spec lives in [ALL-i-want.md](./ALL-i-want.md) (docs
folder) — that file is the single source of truth for product decisions. This file is the
**engineering continuity layer** on top of it.

## 2. The one constraint that overrides everything else

The user has explicitly and repeatedly emphasized this final goal:

> The finished product must install via a single **.exe** (Windows) or **.dmg** (macOS) installer,
> install and run properly, and **never** ask the end user to install Node.js, Python, Docker,
> Rust, or any other dev tool/programming language. The **only** thing the user should ever have
> to provide is a `.gguf` model file (imported inside the app). Everything else must just work.

Practical implications for every future phase:

- Prefer crates/packages with **bundled native deps** (e.g. we used `tauri-plugin-sql` with the
  `sqlite` feature, which statically bundles SQLite — no system SQLite required).
- When llama.cpp / OpenVINO integration happens (Phases 4 & 6), their runtime binaries must be
  **shipped inside the app bundle** (via Tauri's `bundle.resources` or sidecar binaries), never
  assumed to be pre-installed on the user's machine.
- Rust, Node, and the Tauri CLI are **dev-machine-only** tools used to *build* the installer. They
  are never required on the end-user's machine — this is inherent to how Tauri works; just don't
  break it by requiring an external runtime at execution time.
- Before adding any dependency, ask: "Will this force the end user to install something extra?" If
  yes, find a bundled/embeddable alternative or ship the binary ourselves.

## 3. Current status (as of this writing)

| Phase | Name | Status |
|---|---|---|
| 0 | Repository + Architecture | ✅ Done |
| 1 | UI Foundation | ✅ Done (visual/bento redesign pass + collapsible sidebar) |
| 2 | SQLite | ✅ Done |
| 3 | GGUF Model Manager | ✅ Done |
| 4 | llama.cpp Integration | ✅ Done (silent subprocess + CPU guard) |
| 5 | Chat | ✅ Done (markdown formatter, code copy, persistence) |
| 6 | Image Generation | ✅ Done (SD-Turbo, LCM DreamShaper v7 4-step auto-tune) |
| 7 | Decision Layer (Laya ONNX) | ✅ Done (offline mmBERT-base) |
| 8 | Surprise Me & Model Downloader | ✅ Done (curated 1-click downloads for CPU/M4) |
| 9 | Addon System | ⬜ Not started — **next up** |
| 10 | Game Sandbox | ⬜ Not started |
| 11 | Built-in Games (Tic-Tac-Toe, Ludo) | ⬜ Not started |
| 12 | AI Game Generation | ⬜ Not started |
| 13 | Library | ⬜ Not started (placeholder UI only) |
| 14 | Settings + Runtime Management | ⬜ Partially started (theme, profile fields, DB status live in Settings; storage/runtime paths not yet) |
| 15 | Performance + Packaging | ⬜ Not started |
| 16 | Final QA | ⬜ Not started |

**Never claim a phase is done unless it was actually built and verified.** See section 7 (how to
verify) below — several things (like Tauri plugin APis) cannot be verified from a browser preview.

Detailed, dated log of exactly what was done in each phase: [docs/PROGRESS.md](./PROGRESS.md) and
[docs/CHANGELOG.md](./CHANGELOG.md). Read those for specifics; this file is the summary + context.

## 4. Stack & conventions (locked in — don't relitigate without reason)

- **Tauri 2** (`src-tauri/`, Rust 2021 edition) + **React 19 + TypeScript** + **Vite** + **Tailwind
  CSS v4** (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed, uses
  `@import "tailwindcss";` in `src/index.css`).
- **Icons:** `lucide-react` only. Do not add another icon library.
- **Routing:** `react-router-dom` with `HashRouter` (not `BrowserRouter` — safer for a Tauri
  webview/file-based production build).
- **Bundle identifier:** `com.secondbrain.desktop` (must NOT end in `.app` — Tauri warns about a
  macOS bundle-extension conflict if it does).
- **Window size:** 1200×780 default, 1000×650 minimum (per spec section 2/33).
- **Database:** `tauri-plugin-sql` with `features = ["sqlite"]` (bundled, no system SQLite). DB
  file is `secondbrain.db`, created at the OS app-data dir (Windows:
  `%APPDATA%\com.secondbrain.desktop\secondbrain.db`). Frontend access via `src/lib/db.ts`.
- **State/UI primitives:** all in `src/components/ui/` — `Button`, `IconButton`, `EmptyState`,
  `Badge`, `Input`, `Textarea`, `Select`, `Dropdown`, `Tabs`, `Dialog`, `LoadingState`. Reuse these;
  don't invent new one-off styles (see spec section 32/53 — design-system protection).
- **Layout shell:** `src/components/layout/` — `AppShell`, `Sidebar`, `PageHeader`, `ThemeToggle`.
- **Theme:** `src/lib/theme.tsx` (`ThemeProvider`/`useTheme`) — dark/light/system via
  `data-theme` attribute + CSS variables in `src/index.css`, persisted to `localStorage` under key
  `second-brain:theme`. Tokens: `--bg`, `--surface`, `--surface-elevated`, `--border`, `--text`,
  `--muted`, `--accent`, `--accent-hover`, `--shadow-sm`, `--shadow-card`, `--shadow-lifted`.
- **Toasts:** `src/lib/toast.tsx` (`ToastProvider`/`useToast`), mounted once in `main.tsx`.
- **Visual direction (explicitly requested by user):** "bento style, sleek, curved radius,
  polished." Concretely: floating rounded panels (`rounded-2xl`/`rounded-3xl`), soft shadow tokens
  (never flat/bordered edge-to-edge), generous internal padding, subtle hover lift
  (`hover:-translate-y-0.5`), active press scale (`active:scale-[0.98]`). Home page is a real bento
  grid (large featured tile + smaller tiles), not a plain equal-width card row. Apply this same
  visual language to any new page/feature.
- **Never fake completion.** If something is a placeholder/mock/stub, say so explicitly in
  `docs/PROGRESS.md`. Don't claim an integration "works" unless it was actually run and verified.
- **GGUF parsing:** hand-written parser in `src-tauri/src/gguf.rs` (no third-party GGUF crate
  needed) — reads magic/version/tensor+kv counts, walks metadata key-value pairs including
  correctly skipping ARRAY-typed values, extracts architecture/name/quantization (via a ~30-entry
  `general.file_type` lookup table, falling back to filename token matching)/context length. Has
  Rust unit tests (`cargo test gguf`) using a synthetic in-memory GGUF byte stream — use this same
  synthetic-file approach to test future binary-format parsing since real multi-GB model files
  aren't available in this dev environment.
- **File dialogs / reveal-in-folder:** use `@tauri-apps/plugin-dialog` (`open()`) and
  `@tauri-apps/plugin-opener` (`revealItemInDir()`) directly from the frontend — no custom Rust
  command needed for either, they're plugin-provided JS APIs. Only write custom Rust `#[tauri::command]`s
  for logic that must run natively (parsing, DB-adjacent work, filesystem scanning).
- **llama.cpp integration is a sidecar process, not in-process FFI.** `llama-server.exe` (official
  llama.cpp build) runs as a child process; Rust talks to it over local HTTP
  (`127.0.0.1:<random free port>`), never a fixed port. This was a deliberate choice over the
  `llama-cpp-2` Rust bindings crate, which needs bindgen/libclang (~1GB LLVM install not present on
  this dev machine) — see `docs/PROGRESS.md` Phase 4 for the full reasoning. Killing the process
  fully reclaims its RAM, which matters for a "calm, lightweight, don't slow down the user's PC" app.
- **The llama.cpp binaries are NOT committed to git.** Run `powershell -File
  scripts/fetch-llama-server.ps1` once after cloning (or whenever the pinned release tag changes) to
  populate `src-tauri/resources/llama/` before building. This is a Windows-only script right now
  (fetches `llama-b10964-bin-win-cpu-x64.zip`); macOS needs its own script fetching
  `llama-b10964-bin-macos-arm64.tar.gz` from the same GitHub release when Mac work starts.
- **Testing binary/native-process features:** this dev environment has no real multi-GB GGUF model
  and can't drive the native Tauri window via automation. The pattern that worked well: (1) for pure
  parsing logic, write Rust unit tests against a synthetic in-memory byte buffer (see `gguf.rs`); (2)
  for the llama-server subprocess/HTTP protocol, download a tiny real GGUF (e.g.
  `bartowski/SmolLM2-135M-Instruct-GGUF` Q4_K_M, ~100MB) into `src-tauri/test-model/` (gitignored),
  launch the bundled `llama-server.exe` directly from a terminal, and curl its `/health` and
  `/v1/chat/completions` (`stream: true`) endpoints to confirm the exact wire format matches what the
  Rust code parses. Then separately confirm the full app still builds and launches without crashing.
- **Image backend is stable-diffusion.cpp (`sd-cli`), not OpenVINO** — a deliberate deviation from
  the spec's literal suggestion. OpenVINO's practical local pipelines need Python (`optimum-intel`),
  which breaks the "no Python/Node/Docker for the end user" hard constraint. `sd-cli` is pure C/C++
  (same family as llama.cpp), CPU-only build, no CUDA — and crucially it's a **one-shot CLI**, not a
  persistent server: every generation spawns a fresh process that fully exits afterward, so idle RAM
  usage between images is exactly zero. The bundled zip also contains `sd-server.exe`
  (persistent-server mode), intentionally unused since keeping a model warm in RAM between
  generations contradicts the lazy-loading/"stop idle runtimes" rule (spec section 5).
- `src-tauri/resources/sd/` (gitignored) holds the official Windows CPU build, fetched via
  `scripts/fetch-sd.ps1`. Release asset filenames only include the short commit hash, NOT the build
  number that appears in the git tag (tag `master-890-74988b2` → asset
  `sd-master-74988b2-bin-win-cpu-x64.zip`) — always check
  `api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest` for both before hardcoding.
- `src-tauri/src/image_engine.rs`: `generate_image` spawns `sd-cli` fresh per request (no
  shared/reused process). Cancellation uses `Arc<Notify>` + `tokio::select!{ child.wait() vs
  cancel.notified() }` — do NOT hold a shared `Mutex<Child>` locked across an `.await` on
  `child.wait()`, it deadlocks any concurrent command (e.g. cancel) trying to lock the same mutex.
  CLI flags were verified against the upstream `examples/common/common.cpp` source (not guessed):
  `-m -p -n -o -W -H --steps --cfg-scale -s --sampling-method`. LCM checkpoints need `--cfg-scale 1.0
  --sampling-method lcm` and ~4 steps (the default cfg 7.0/euler_a produces garbage for them) —
  auto-applied by the frontend when the model's guessed `architecture` is `'LCM'`, so the user never
  has to understand what LCM is (spec section 9 UX rule).
- `read_image_data_url` (Rust command) returns a `data:image/png;base64,...` string (hand-rolled
  base64, no new crate) instead of configuring Tauri's asset-protocol/`convertFileSrc` scope —
  simpler, and access is restricted to the app's own `images/` directory via a canonicalized
  path-traversal check since this command is reachable from the frontend.
- DB: migration 9 adds `models.kind` (`'text'|'image'`, default `'text'`) and `images.width`/`height`.
  `import_image_model` is a lightweight file-facts-only import (no metadata parsing, unlike GGUF) —
  architecture is guessed from filename tokens (xl/sd3/flux/turbo/lcm/sd → SDXL/SD3/FLUX/SD-Turbo/
  LCM/SD1.x), same fallback pattern as GGUF quantization guessing.
- `Tabs` UI component gained optional controlled `value`/`onChange` props (backward compatible) so
  the Models page could split into Text/Image tabs, each with its own import/scan flow, sharing the
  `models` table (`kind` distinguishes them). Chat/Settings model pickers now call
  `listModels('text')` so image models never leak into those UIs.
- Image verification used the same pattern as Phase 4: downloaded a real GGUF image model built
  specifically for stable-diffusion.cpp (`Steward/lcm-dreamshaper-v7-gguf`, LCM DreamShaper v7,
  ~2.13GB) into `src-tauri/test-model/` (gitignored), ran the bundled `sd-cli.exe` directly with the
  exact flags `image_engine.rs` constructs, and confirmed a correct real image was produced — then
  separately confirmed the full app still builds/launches/stays responsive and that migration 9
  applied on-disk.

## 5. File map (as of Phase 6)

```
docs/
  ALL-i-want.md             ← full product spec (source of truth for product decisions)
  AGENT_HANDOFF.md          ← this file
  PROGRESS.md               ← detailed phase-by-phase implementation log
  CHANGELOG.md              ← chronological change log
scripts/
  fetch-llama-server.ps1     ← downloads + trims the llama.cpp Windows CPU build into src-tauri/resources/llama/
  fetch-sd.ps1                ← downloads the stable-diffusion.cpp Windows CPU build into src-tauri/resources/sd/
README.md
package.json                ← scripts: dev, build, lint, preview, tauri
vite.config.ts               ← port 1420 fixed, tailwindcss() plugin, src-tauri watch ignored
src/
  main.tsx                   ← mounts ThemeProvider > ToastProvider > HashRouter > App
  App.tsx                     ← route table, all routes nested under <AppShell>
  index.css                   ← Tailwind import + theme CSS variable tokens
  lib/
    theme.tsx                 ← ThemeProvider/useTheme
    toast.tsx                  ← ToastProvider/useToast
    navigation.ts               ← sidebar nav item list (icon+label+route)
    db.ts                        ← getDb()/getSetting()/setSetting() + model + conversation/message + image CRUD + typed *Record interfaces
    gguf.ts                       ← invoke wrappers for import_gguf_model/scan_gguf_folder + formatBytes
    imageEngine.ts                  ← invoke wrappers for image model import/scan + generate/cancel/read-data-url
    avatar.ts                      ← getInitials() deterministic local avatar text
    textEngine.ts                   ← invoke/event wrappers for start/stop/status/generate/cancel
  components/
    layout/{AppShell,Sidebar,PageHeader,ThemeToggle}.tsx
    ui/{Button,IconButton,EmptyState,Badge,Input,Textarea,Select,Dropdown,Tabs,Dialog,LoadingState}.tsx
      (Tabs now also supports optional controlled value/onChange props)
  pages/
    {Home,Play,Library,Addons,Settings}Page.tsx
    ChatPage.tsx                ← real chat, fully persisted: conversation sidebar, streaming, regenerate, copy, per-conversation settings
    ModelsPage.tsx               ← Text/Image model tabs, native import/scan dialogs per tab
    CreatePage.tsx                ← real image generation: prompt/negative/size/steps/seed, preview, history grid
src-tauri/
  Cargo.toml                   ← tauri, tauri-plugin-log, tauri-plugin-sql (sqlite), tauri-plugin-dialog,
                                  tauri-plugin-opener, uuid, reqwest (rustls), futures-util, tokio (incl. sync)
  tauri.conf.json               ← identifier, window config, dev/build commands, bundle.resources (llama, sd)
  capabilities/default.json      ← "core:default", "sql:default", "dialog:default", "opener:default"
  resources/llama/                ← gitignored, populated by scripts/fetch-llama-server.ps1
  resources/sd/                     ← gitignored, populated by scripts/fetch-sd.ps1
  test-model/                       ← gitignored, dev-only tiny GGUF text + image models for manual verification
  src/lib.rs                     ← plugin registration + migrations() Vec<Migration> + invoke_handler
  src/gguf.rs                     ← GGUF binary parser (+ unit tests)
  src/commands.rs                  ← #[tauri::command] import_gguf_model, scan_gguf_folder, import_image_model, scan_image_model_folder
  src/text_engine.rs                 ← TextEngineState + start/stop/status/generate/cancel commands
  src/image_engine.rs                  ← per-request sd-cli spawn + cancel + read_image_data_url commands
```

## 6. Database schema (as of Phase 6)

Migrations are defined inline in `src-tauri/src/lib.rs` as a `Vec<Migration>` (sequential,
never edit an already-applied migration — add a new one instead). Current tables:

- `settings (key TEXT PRIMARY KEY, value TEXT)`
- `models (id, name, path, format, size_bytes, quantization, architecture, status, is_default, created_at, kind CHECK(text|image) DEFAULT 'text')`
- `conversations (id, title, model_id → models.id, created_at, updated_at, temperature, top_p, max_tokens)`
- `messages (id, conversation_id → conversations.id CASCADE, role CHECK(user|assistant|system), content, created_at)`
- `images (id, prompt, negative_prompt, file_path, seed, steps, model_id, is_favorite, created_at, width, height)`
- `games (id, game_type, difficulty, result, state_json, created_at, updated_at)`
- `addons (id, name, version, type, entry, enabled, installed_at)`
- `favorites (id, item_type CHECK(conversation|image|game|addon), item_id, created_at, UNIQUE(item_type,item_id))`

No CRUD UI exists yet for `games`/`addons` (`settings`, `models`, `conversations`/`messages`, and
`images` are all fully wired for real). Build CRUD for the rest alongside each feature's own phase —
don't build it early "just in case."

## 7. How to verify changes (important gotchas)

- **Frontend-only changes** (styling, layout, new pages that don't touch Tauri APIs): run
  `npm run build` to typecheck+bundle. For visual verification, run `npm run dev` (Vite dev server
  on port 1420) and use the browser tools (`open_browser_page` + `screenshot_page`) — much faster
  than a full Tauri rebuild.
- **Tauri-API-dependent changes** (SQL plugin, filesystem, dialogs, future llama.cpp commands):
  **these do NOT work in the plain Vite dev-server browser preview** — there's no Tauri IPC bridge
  outside the actual webview. You must build and launch the real app to test them:
  ```powershell
  npm run tauri build -- --debug
  Start-Process ".\src-tauri\target\debug\app.exe"
  ```
  Then verify via `Get-Process -Name app` (confirms it launched and didn't crash) and, for DB
  changes, inspect the on-disk file directly (no sqlite3/python needed on this machine):
  ```powershell
  Select-String -Path "$env:APPDATA\com.secondbrain.desktop\secondbrain.db" -Pattern "CREATE TABLE (\w+)" -AllMatches |
    ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
  ```
  Always `Stop-Process -Name app -Force` afterward to clean up.
- **`npx tauri build --debug 2>&1 | Select-Object -Last 80`** in PowerShell buffers ALL output
  until the process exits before printing anything — looks stalled for minutes during a first/cold
  Rust compile. Don't pipe long builds through `Select-Object`; run plain, or redirect to a log
  file and tail it, or just wait (first cold build: minutes; incremental builds: ~15–20s).
- Tailwind v4 lint may suggest `bg-(--accent)` shorthand instead of `bg-[var(--accent)]` —
  cosmetic only, not a real error, safe to ignore.

## 8. What's next: remaining phases (from ALL-i-want.md, summarized)

Read the full spec sections for details before implementing — this is just a memory jogger.

- **Phase 3 — GGUF Model Manager** (next): file picker for `.gguf`, parse GGUF metadata
  (architecture, quantization, param count, context length) if feasible without a heavy
  dependency, estimate RAM requirement, register in the `models` table, list/delete/set-default UI
  on the Models page. Still no inference — just import/manage.
- **Phase 4 — llama.cpp Integration:** `TextEngine` abstraction (start/stop/generate/cancel),
  actual llama.cpp process management from Rust, streaming tokens back to the frontend. This is
  where the "bundle the runtime binary, don't require the user to install anything" constraint
  matters most — plan the llama.cpp binary/library packaging carefully (sidecar binary per platform
  via Tauri's `bundle.externalBin`, or statically link via a Rust binding crate like
  `llama-cpp-2`/`llama_cpp_rs` if it can build fully self-contained).
- **Phase 5 — Chat:** conversation list, streaming UI, stop/regenerate/copy, wired to real
  TextEngine + `conversations`/`messages` tables.
- **Phase 6 — Image Generation:** `ImageEngine` abstraction, Windows OpenVINO/LCM path (keep
  replaceable for a future Mac-native backend), prompt UI, history, wired to `images` table.
- **Phase 7 — Jev Decision Layer:** `DecisionEngine` abstraction, Jev API client (optional, never
  required), local deterministic fallback.
- **Phase 8 — Surprise Me:** wire DecisionEngine (Jev or fallback) to pick an activity and launch
  it directly.
- **Phase 9 — Addon System (DONE):** ZIP import, manifest validation (no path traversal, safe extraction),
  100 MB zip-bomb limits, enable/disable/uninstall, starter packs (Potato vs Mosquito, Retro Matrix Rain),
  sandboxed iframe runner preview, `addons` table.
- **Phase 10 — Game Sandbox (Next):** `GameEngine` abstraction, sandboxed game host (restricted
  webview — games never get filesystem/shell/native API access).
- **Phase 11 — Built-in Games:** Tic-Tac-Toe and Ludo only, each with Easy/Medium/Hard AI
  (deterministic engine owns rules; AI only picks among legal moves — never invents rules, never
  uses a GGUF model for per-move reasoning).
- **Phase 12 — AI Game Generation:** prompt → Jev/GGUF generates HTML/CSS/JS → validate → sandbox
  → preview → optional save as addon.
- **Phase 13 — Library:** real data wired into the existing Tabs UI (conversations/images/
  games/favorites), search/filter.
- **Phase 14 — Settings + Runtime Management:** storage path configuration, runtime status/
  diagnostics expansion, AI defaults, Jev config UI.
- **Phase 15 — Performance + Packaging:** test on real target hardware (Windows Intel i5 13th
  gen/16GB CPU-only, Mac Mini M4), then produce the actual signed/distributable `.exe` (NSIS/MSI)
  and `.dmg` installers. **This is where the "no external tools required" constraint gets
  hard-verified** — test on a clean machine/VM with none of Node/Rust/Python installed.
- **Phase 16 — Final QA:** offline mode, missing/corrupt model, failed image runtime, Jev
  unavailable, bad/malicious addon ZIP, generated game failure, DB migration, app restart, runtime
  crash, cancel operations, long chat, large image history — see spec section 48 Phase 16 for the
  full checklist.

## 9. Design/product rules that are easy to forget

- Home page must never become a metrics dashboard — stay calm/inviting (spec section 12).
- No hidden chain-of-thought shown for game AI — only safe status strings like "Second Brain is
  choosing…" (spec section 20).
- Game engines are the source of truth for rules; AI only selects among engine-provided legal
  moves, and the engine must validate/reject any illegal AI output (spec sections 17, 57).
- Never require Jev — always have a local deterministic fallback (spec sections 10, 11, 21).
- Runtimes are lazy-loaded — don't start llama.cpp/image engine at app launch, only when needed
  (spec section 5).
- Treat all external input as untrusted: GGUF files, addon ZIPs, generated code, API responses
  (spec section 42). No arbitrary shell execution, no blind ZIP extraction, validate addon
  manifests and paths.
- Don't store big binaries (models, images) in SQLite — store file paths + metadata only (spec
  section 41).

## 10. Updating this file

After finishing each phase (or any significant chunk of work), update:
1. [docs/PROGRESS.md](./PROGRESS.md) — detailed what-was-built entry for that phase.
2. [docs/CHANGELOG.md](./CHANGELOG.md) — chronological bullet list.
3. **This file** — bump the status table in section 3, and append any new conventions/gotchas
   discovered to sections 4/7/9 so the next fresh session doesn't rediscover them the hard way.

If you are a fresh agent session starting from this file: read `ALL-i-want.md` in full, skim
`docs/PROGRESS.md` for the detailed history, then continue with the next unchecked phase in
section 3 above.
