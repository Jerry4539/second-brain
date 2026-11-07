# Second Brain (v0.4.0)

An autonomous, local-first AI desktop studio, infinite ideation canvas, image generation engine, and personal knowledge companion for **macOS (Apple Silicon M1/M2/M3/M4 & Intel)** and **Windows** — built with **Tauri 2**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Rust**.

> **Zero External End-User Dependencies:** The packaged desktop app runs completely standalone. End users never need to install Python, Node.js, Rust, Docker, or CUDA — everything from SQLite to Apple Silicon Metal GPU & AVX2 CPU inference runtimes (`llama-server` and `sd-server`) is bundled and managed directly inside the app.

---

## What's New in v0.4.0

- **Infinite Studio Canvas & Bottom-Right Mascot Co-Pilot (`CanvasPage`)**
  - **Infinite Board & Project Workspace:** Organize work into **Projects → Folders → Multi-Sheet Boards** with dot/cross/heart/sparkle grids, smooth trackpad pan/zoom, custom name-tagged cursor (`Jerry` pointer + grab hand), and one-click **PNG / PDF / Word** export.
  - **Rich Ideation & Wireframing Kits:** Drag-and-drop or AI-generate mobile & desktop **Wireframes** (Nav bars, Tab bars, Cards, Hero sections, Pricing, Stats, Footers), **Flowcharts**, **Journey Maps**, **Sitemaps**, **Mind Maps**, sticky notes, rich docs, tables, checklists, voice memos, video cards, and vector/freehand drawings.
  - **Contextual Selection Bar:** Selecting any element dynamically adapts the bottom bar with alignment, distribution, grouping/ungrouping, section creation, drop shadows, masking, cropping, and color palette extraction.
  - **Bottom-Right Second Brain Mascot & Popup Chat:** Interactive eye-tracking cap mascot (`page-mascot`) pinned to the bottom-right corner. Ask Second Brain to build custom dark/light mobile screens, landing pages, flowcharts, or group and rewrite cards on your board.
  - **In-Canvas AI Image Rendering:** Requesting an image on the Canvas spawns an animated in-canvas generation card right on the board and resolves directly into an editable image card.
- **Sleek 12-Column Bento Control Center (`SettingsPage`)**
  - Responsive Bento-grid settings workspace with category filter pills (*All Bento Cards*, *Image Rendering & Models*, *Canvas & Mascot*, *Knowledge & Web APIs*, *Memory, RLHF & Hardware*).
  - **Configurable Diffusion Rendering Steps:** One-tap preset pills (`4`, `5`, `6`, `7`, `8`, `10`, `12`, `16`, `20` steps) + custom slider (`2–30` steps), default render resolution (`384×384`, `512×512`, `768×768`), CFG guidance scale (`1.0`, `1.8`, `5.0`, `7.0`), and sampling scheduler (`LCM`, `Euler Ancestral`, `DPM++ 2M`) synced across both **Create Studio** and **Canvas**.
- **Practical High-Capability Curated Models (`ModelsPage`)**
  - Upgraded curated catalog with practical, high-reasoning GGUF models (*Qwen 2.5 7B Instruct*, *Meta Llama 3.1 8B Instruct*, *DeepSeek R1 Distill Qwen 7B*, *Qwen 2.5 Coder 7B*, *Gemma 2 9B*, *Qwen 2.5 3B*) and fast Diffusion checkpoints (*LCM DreamShaper v7*, *SDXL-Turbo*, *DreamShaper 8*).
- **Autonomous Hybrid Knowledge Router, RLHF & Memory Vault (`ChatPage`)**
  - **Smart Hybrid Knowledge Router:** Automatically fuses local LLM reasoning with live web context (Wikipedia, DuckDuckGo, Hacker News, Google Custom Search API), TMDB Movies & TV intelligence, and Open-Meteo weather telemetry.
  - **Reinforcement Reward Learning (RLHF) & Episodic Memory Vault:** Learns from explicit (`👍` +10 XP) and implicit rewards to adapt response formatting and remembers permanent facts across conversations.

---

## Core Features

| Module | Highlights |
|---|---|
| **AI Chat & Artifacts** | Multi-turn streaming SSE chat (`llama.cpp`), Claude-style structured reasoning, interactive side-panel code/doc artifacts, inline image generation, and hybrid web search (`/web`, `/tmdb`, `/save`). |
| **Infinite Canvas** | Projects & folders, wireframing & flowchart kits, contextual object toolbar, group/ungroup, masking, PNG/PDF export, and bottom-right **Second Brain** mascot co-pilot. |
| **Create Image Studio** | Local `stable-diffusion.cpp` engine with Metal Flash Attention (`--diffusion-fa`), configurable **4–20 rendering steps** (`6`, `7`, `8` LCM sweet-spot presets), resolution & CFG controls, and gallery history. |
| **Curated Model Hub** | One-click HuggingFace downloader with live byte progress + local `.gguf` / `.safetensors` / `.ckpt` importer with zero-dependency Rust GGUF v2/v3 metadata parsing. |
| **Game Lounge & Add-ons** | Built-in **15×15 Ludo**, **Tic-Tac-Toe** (Minimax AI), **Car Race**, **Dual Snake**, and sandboxed `.zip` add-on runner. |
| **Bento Settings** | Responsive 12-column Bento Control Center for Image Rendering steps, LLM/Diffusion defaults, Canvas physics, RLHF policy weights, API connectors, and Apple Silicon RAM management. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Shell & Backend** | [Tauri 2](https://v2.tauri.app/) (Rust 2021, Tokio, Reqwest, `sysinfo`) |
| **Frontend UI** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, React Router v7 |
| **Infinite Canvas** | Custom HTML5 / SVG / TipTap / WebAudio Infinite Board Engine + `page-mascot` WebGL/2D eye-tracking mascot |
| **Database** | Bundled SQLite via `tauri-plugin-sql` (9 sequential schema migrations) |
| **Text Inference** | `llama.cpp` (`llama-server` Apple Silicon Metal / CPU AVX2 sidecar over local HTTP SSE) |
| **Image Inference** | `stable-diffusion.cpp` (`sd-server` / `sd-cli` with `--diffusion-fa` Metal Flash Attention & `--mmap`) |
| **Decision Engine** | ONNX Runtime (`ort` crate) + `tokenizers` (`Laya` mmBERT-base ONNX + deterministic fallback) |

---

## Quick Start (macOS & Windows)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Jerry4539/second-brain.git
cd second-brain
npm install
```

### 2. Fetch Native Inference Runtimes (One-Time Setup)

#### On macOS (Apple Silicon M1/M2/M3/M4 & Intel):

```bash
npm run setup:mac
```

#### On Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fetch-llama-server.ps1
powershell -ExecutionPolicy Bypass -File scripts/fetch-sd.ps1
powershell -ExecutionPolicy Bypass -File scripts/fetch-onnxruntime.ps1
```

### 3. Run in Development Mode

```bash
npm run tauri dev
```

### 4. Build the Standalone Desktop App

```bash
# Build macOS .app bundle:
npx tauri build --bundles app

# Or build full platform installers (.dmg / .exe):
npm run tauri build
```

#### Built Application Paths (macOS):
- **macOS `.app` Bundle:** `src-tauri/target/release/bundle/macos/Second Brain.app`
- **Release Binary:** `src-tauri/target/release/app`

---

## Project Structure

```text
├── docs/                          # Product spec, architecture handoff, progress & changelog
├── public/
│   ├── mascots/                   # Cap mascot directional & reaction sprite sheets (.webp)
│   └── mochiboard/                # Infinite Canvas engine, wireframe kits, templates & styles
├── scripts/                       # macOS (.sh) & Windows (.ps1) runtime fetchers
├── src/
│   ├── components/                # Chat, Create HUD, Games, Layout, and Bento UI primitives
│   ├── lib/                       # Agent orchestrator, Canvas AI bridge, SQLite CRUD, curated models
│   └── pages/                     # Home, Chat, Create, Canvas, Play, Library, Models, Addons, Settings
└── src-tauri/                     # Rust backend (llama.cpp, stable-diffusion.cpp, GGUF, ONNX, SQLite)
```

---

## Documentation

- **[Product Specification (`docs/ALL-i-want.md`)](./docs/ALL-i-want.md)**
- **[Engineering Handoff & Architecture (`docs/AGENT_HANDOFF.md`)](./docs/AGENT_HANDOFF.md)**
- **[Implementation Progress (`docs/PROGRESS.md`)](./docs/PROGRESS.md)**
- **[Changelog (`docs/CHANGELOG.md`)](./docs/CHANGELOG.md)**
