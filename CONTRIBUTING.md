# Contributing to Second Brain 🧠

First off, thank you for considering contributing to **Second Brain (`2nd Brain`)**! Whether you are fixing a bug, adding a new wireframe kit to the Infinite Canvas, building an offline arcade game, or tuning CPU/Metal inference, your collaboration is hugely appreciated.

---

## 🎯 Core Philosophy (The Golden Rule)

Before building a new feature, please keep our #1 product rule in mind:

> **Zero External End-User Dependencies:** The packaged desktop installer (`.exe` on Windows, `.dmg` / `.app` on macOS) must work out of the box on a clean consumer machine. End users should **never** be asked to install Python, Node.js, Rust, Docker, or system SQLite. Any native runtime must be bundled inside `src-tauri/resources/` or statically linked.

---

## 🛠️ Local Development Setup

1. **Fork & Clone the Repo**
   ```bash
   git clone https://github.com/<your-username>/second-brain.git
   cd second-brain
   npm install
   ```

2. **Fetch Native Inference Runtimes**
   - **macOS (Apple Silicon & Intel):**
     ```bash
     npm run setup:mac
     ```
   - **Windows (PowerShell):**
     ```powershell
     powershell -ExecutionPolicy Bypass -File scripts/fetch-llama-server.ps1
     powershell -ExecutionPolicy Bypass -File scripts/fetch-sd.ps1
     powershell -ExecutionPolicy Bypass -File scripts/fetch-onnxruntime.ps1
     ```

3. **Run in Dev Mode**
   ```bash
   npm run tauri dev
   ```

4. **Run Verification Checks Before Opening a PR**
   ```bash
   npm run lint
   npm run build
   cargo test --manifest-path src-tauri/Cargo.toml
   ```

---

## 🤝 High-Impact Areas for Collaborators

Looking for a great first contribution? Check out these areas:

1. **Infinite Canvas & Mascot Co-Pilot (`public/mochiboard/` & `src/pages/CanvasPage.tsx`):**
   - Add new wireframe widgets, flowchart templates, export formats, or mascot co-pilot builders.
2. **Local Inference & GPU Profiles (`src-tauri/src/` & `scripts/`):**
   - Add optional Vulkan / CUDA sidecar detection on Windows & Linux while preserving the zero-dependency CPU/Metal fallback.
3. **Arcade Games & Sandboxed Add-ons (`src/components/games/` & `src-tauri/src/addons.rs`):**
   - Build self-contained offline games with 60 FPS canvas physics and Web Audio synthesizer effects.
4. **Curated Models & Hybrid Knowledge (`src/lib/curatedModels.ts`):**
   - Test and benchmark new high-reasoning GGUF text models or fast distilled Stable Diffusion weights.

---

## 📬 Submitting Changes

1. Create a descriptive branch (`feat/canvas-diagram-kit`, `fix/windows-path`, `game/chess-engine`).
2. Keep PRs focused and include screenshots or a short clip if you modified the UI, Canvas, or Games.
3. Reference any relevant issue number in your PR description.
