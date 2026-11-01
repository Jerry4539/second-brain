# Second Brain

A lightweight, portable, offline-first desktop companion for conversation, image creation, games, add-ons, and personal experimentation — built with **Tauri 2**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Rust**.

> **Zero External End-User Dependencies:** The packaged desktop installer runs completely standalone on Windows. End users never need to install Python, Node.js, Rust, Docker, or CUDA — everything from SQLite to CPU inference runtimes is bundled or managed directly inside the app.

---

## Features

- **Local AI Chat (`llama.cpp` Sidecar)**
  - Multi-turn conversational memory with streaming SSE responses, custom system persona, inline image generation (`ChatImageCard`), and per-conversation generation parameters (`temperature`, `top_p`, `max_tokens`).
  - Built-in Markdown renderer with syntax-highlighted code blocks, one-click code copy, roleplay formatting, message regeneration, and auto-titled conversation history.
- **Local Image Generation (`stable-diffusion.cpp` Engine)**
  - CPU-optimized persistent warm-model architecture (`sd-server`) with `--mmap` zero-copy weight loading, interactive HUD (`ImageGenerationHud`), and an automatic 3-minute idle RAM reaper.
  - Automatic detection and tuning for **LCM (Latent Consistency Models)** (`4 steps`, `cfg-scale 1.0`, `lcm` sampler) and **SD-Turbo** alongside standard Stable Diffusion 1.5/SDXL checkpoints.
  - Prompt & negative prompt controls, resolution presets (`384×384` Compact, `512×512` Square), seed control, favorites, and instant gallery history.
- **Interactive Creative Canvas (`CanvasPage`)**
  - Dedicated workspace for drawing, sketching, and visual experimentation.
- **Curated Model Hub & GGUF Manager**
  - **One-Click In-App Downloader:** Download curated, CPU-friendly text models (*Qwen 2.5 3B*, *Llama 3.2 3B*, *Hermes 3 3B*, *Gemma 2 2B*) and fast image models (*SD-Turbo*, *LCM DreamShaper v7*, *DreamShaper 8*) with live progress tracking.
  - **Local Import & Custom GGUF Parser:** Import any `.gguf`, `.safetensors`, or `.ckpt` file from disk or scan a directory. Includes a zero-dependency Rust GGUF v2/v3 header parser that extracts architecture, quantization, and context length metadata.
- **Offline System-1 Decision Layer (`Laya` ONNX + `Surprise Me`)**
  - Powered by a lightweight multilingual ONNX decision model (`convaiinnovations/laya-multilingual` via Microsoft ONNX Runtime `ort` + HuggingFace `tokenizers`) with deterministic offline fallback.
  - Drives the **Surprise Me** action on the Home dashboard to contextually recommend activities.
- **Built-in Game Lounge & Sandboxed Arena**
  - **15×15 Authentic Ludo:** Classic 4-corner yard layout, 52-tile track, 8 safe star squares, 3D animated dice, bonus rolls on 6s and captures, 2-player or 4-player modes, and 3 AI difficulty tiers (*Easy*, *Medium*, *Hard*).
  - **Framed Tic-Tac-Toe:** Clean Bento scoreboard with *Easy*, *Medium*, and unbeatable *Hard* (Minimax with alpha-beta pruning) AI tiers.
  - **Arcade Games (`CarRaceBoard` & `SnakeDualBoard`):** Built-in Car Race and Dual Snake arcade modes with synthesized Web Audio sound effects (`soundEffects.ts`).
  - Full match history and career win/loss/draw stats persisted to SQLite.
- **Sandboxed Add-on System**
  - Install custom games, visualizers, and tools from `.zip` archives with strict path-traversal guards, 100 MB zip-bomb protection, and `manifest.json` verification.
  - Executes add-ons inside an isolated `<iframe sandbox="allow-scripts">` runner with zero filesystem or OS access.
  - Includes 3 one-click starter packs: **Potato vs Mosquito**, **Retro Matrix Rain**, and **Cyber Pong**.
- **Unified Local Library**
  - Browse, search, and filter all saved conversations, generated artwork, game match records, and installed add-ons in one place, backed by bundled SQLite (`tauri-plugin-sql`).
- **Sleek Bento UI**
  - Floating rounded panels, collapsible sidebar, dark/light/system theme tokens, and hardware-friendly CPU thread bounding.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Shell & Backend** | [Tauri 2](https://v2.tauri.app/) (Rust 2021, Tokio, Reqwest) |
| **Frontend UI** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, React Router v7 |
| **Database** | Bundled SQLite via `tauri-plugin-sql` (9 sequential schema migrations) |
| **Text Inference** | `llama.cpp` (`llama-server` CPU/AVX2 sidecar over local HTTP SSE) |
| **Image Inference** | `stable-diffusion.cpp` (`sd-server` / `sd-cli` CPU sidecar) |
| **Decision Engine** | ONNX Runtime (`ort` crate) + `tokenizers` (`Laya` mmBERT-base ONNX) |

---

## Prerequisites (For Building from Source)

To develop or build Second Brain from source on Windows, ensure you have:

1. **[Node.js](https://nodejs.org/)** (v20+ recommended) and `npm`
2. **[Rust Toolchain](https://rustup.rs/)** (`rustup`, `cargo`, `rustc` 1.77.2+) with the MSVC build tools
3. **[Tauri v2 Windows Prerequisites](https://v2.tauri.app/start/prerequisites/)** (Microsoft Visual Studio C++ Build Tools & WebView2, which is pre-installed on Windows 10/11)
4. **PowerShell** (for running the one-time sidecar fetch scripts)
5. *(Optional)* **Python 3.10+** — only needed if you want to re-export the optional `Laya` ONNX decision model from PyTorch (`scripts/export-laya-onnx.py`). The app works out of the box with its built-in deterministic fallback if the ONNX model is omitted.

---

## Getting Started (Step-by-Step Instructions)

### 1. Clone the Repository

```powershell
git clone https://github.com/Jerry4539/second-brain.git
cd second-brain
```

### 2. Install Frontend Dependencies

```powershell
npm install
```

### 3. Fetch Bundled Native Runtimes (One-Time Setup)

Large binary runtimes (~60 MB total) are kept out of Git and fetched directly from official GitHub releases into `src-tauri/resources/` via PowerShell scripts:

```powershell
# 1. Fetch official llama.cpp Windows CPU/AVX2 server binary (~41 MB)
powershell -ExecutionPolicy Bypass -File scripts/fetch-llama-server.ps1

# 2. Fetch official stable-diffusion.cpp Windows CPU binaries (~16 MB)
powershell -ExecutionPolicy Bypass -File scripts/fetch-sd.ps1

# 3. Fetch official Microsoft ONNX Runtime DLL (~15 MB)
powershell -ExecutionPolicy Bypass -File scripts/fetch-onnxruntime.ps1
```

*(Optional)* If you also want to trace and bundle the offline `Laya` ONNX decision weights (`src-tauri/resources/laya/model.onnx`):

```powershell
python -m venv .laya-export-venv
.\.laya-export-venv\Scripts\Activate.ps1
pip install laya torch transformers onnx onnxruntime numpy
python scripts/export-laya-onnx.py
deactivate
```
> **Note:** If you skip the Python ONNX export, create an empty placeholder directory (`New-Item -ItemType Directory -Force -Path src-tauri/resources/laya`) so `tauri build` resource globbing succeeds; the decision engine will automatically use its built-in fallback.

### 4. Run in Development Mode

To launch the full Tauri desktop window with hot-reload:

```powershell
npm run tauri dev
```

Or, to preview UI-only changes in a browser via Vite (note: native Tauri commands/SQLite require the Tauri window):

```powershell
npm run dev
```

### 5. Build the Production Desktop Installer

To compile the optimized release executable and Windows NSIS installer (`.exe`):

```powershell
npm run tauri build
```

Once complete, the standalone installer and binary can be found at:
- **Installer:** `src-tauri/target/release/bundle/nsis/`
- **Executable:** `src-tauri/target/release/app.exe`

---

## Using Second Brain

1. **Download or Import a Model:**
   - Open the **Models** tab in the sidebar.
   - Choose a recommended model from the **Curated Models Hub** and click **Download**, or click **Import Model** to pick an existing `.gguf` / `.safetensors` file from your computer.
2. **Start Chatting:**
   - Head to **Chat**, select your imported text model from the top picker, click **Start Engine**, and start a conversation.
3. **Create Artwork:**
   - Open **Create**, pick an image model (such as *LCM DreamShaper v7* or *SD-Turbo*), type a prompt, and click **Generate**.
4. **Play & Experiment:**
   - Visit **Play** to challenge Second Brain to **Ludo** or **Tic-Tac-Toe**, or open **Add-ons** to install the built-in arcade starter packs or your own `.zip` add-ons.

---

## Project Structure

```text
├── docs/
│   ├── ALL-i-want.md              # Full product specification
│   ├── AGENT_HANDOFF.md           # Engineering architecture & continuity guide
│   ├── PROGRESS.md                # Phase-by-phase verification log
│   └── CHANGELOG.md               # Detailed chronological changelog
├── scripts/
│   ├── fetch-llama-server.ps1     # Downloads prebuilt llama.cpp CPU runtime
│   ├── fetch-sd.ps1               # Downloads prebuilt stable-diffusion.cpp CPU runtime
│   ├── fetch-onnxruntime.ps1      # Downloads Microsoft ONNX Runtime DLL
│   └── export-laya-onnx.py        # Dev-only script to trace Laya decision model to ONNX
├── src/                           # React 19 + TypeScript + Tailwind v4 frontend
│   ├── components/
│   │   ├── chat/                  # Markdown renderer & chat UI components
│   │   ├── games/                 # Sandboxed arena, 15x15 Ludo board, Tic-Tac-Toe board
│   │   ├── layout/                # AppShell, collapsible Sidebar, PageHeader, ThemeToggle
│   │   └── ui/                    # Reusable Bento UI primitives (Dialog, Tabs, Dropdown, etc.)
│   ├── lib/                       # Tauri IPC wrappers, SQLite CRUD, curated models, game engines
│   └── pages/                     # Home, Chat, Create, Play, Library, Models, Addons, Settings
└── src-tauri/                     # Rust backend
    ├── src/
    │   ├── lib.rs                 # Plugin setup, 9 SQLite migrations, command handlers
    │   ├── gguf.rs                # Zero-dependency GGUF v2/v3 binary metadata parser
    │   ├── text_engine.rs         # llama-server lifecycle & SSE token streaming
    │   ├── image_engine.rs        # sd-server / sd-cli warm-model manager & idle reaper
    │   ├── decision_engine.rs     # ONNX Runtime inference for Laya decision model
    │   ├── download.rs            # Streaming HTTP model downloader with progress events
    │   ├── addons.rs              # Safe ZIP extractor, manifest validator & sandboxed loader
    │   ├── commands.rs            # Model file & folder scanning commands
    │   └── paths.rs               # Multi-environment resource path resolution
    └── tauri.conf.json            # Tauri window, security, and bundle configuration
```

---

## Documentation

- **[Product Specification (`docs/ALL-i-want.md`)](./docs/ALL-i-want.md)**
- **[Engineering Handoff & Architecture (`docs/AGENT_HANDOFF.md`)](./docs/AGENT_HANDOFF.md)**
- **[Implementation Progress (`docs/PROGRESS.md`)](./docs/PROGRESS.md)**
- **[Changelog (`docs/CHANGELOG.md`)](./docs/CHANGELOG.md)**
