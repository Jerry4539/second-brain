# Second Brain — Master Project Context & Coding-Agent Specification

> **Purpose:** This document is the single source of truth for building **Second Brain**, a lightweight, portable, offline-first desktop companion for relaxation, conversation, creativity, games, coding challenges, and experimentation.
>
> **Important:** Any coding agent (GitHub Copilot, Claude Code, Cursor, etc.) should read this entire file before making project changes.

---

## 1. Product Vision

**Second Brain** is a calm desktop application for moments when the user is tired, stressed, bored, or simply wants something interesting to do.

The app should let the user:

- Talk to a local AI.
- Import and run GGUF text models.
- Generate weird/fun images locally.
- Play games against an AI.
- Generate small games with AI.
- Do coding challenges.
- Browse a personal local library.
- Install optional addons.
- Use a “Surprise Me” experience where AI decides what would be fun.
- Work primarily offline.
- Optionally use cloud AI such as **Jev** when configured.

The product must feel like a **premium, lightweight desktop utility**, not a gamer dashboard.

### Core philosophy

> **Local-first, modular, calm, fast, portable, and replaceable.**

The user should never be locked into one AI provider or one inference runtime.

---

# 2. Target Platforms

## Windows

Target machine:

- Windows 11
- Intel i5 13th Gen
- 16 GB RAM
- CPU-first
- No dedicated GPU dependency

Primary text inference:

- `llama.cpp`
- GGUF
- CPU / AVX2 where supported

Primary image path:

- OpenVINO-compatible pipeline
- LCM DreamShaper v7 or another lightweight OpenVINO-compatible image model
- Keep image backend abstract so it can be replaced later

## macOS

Target machine:

- Mac Mini M4
- Apple Silicon

Text:

- `llama.cpp`
- Metal acceleration where available

Images:

- Do not force OpenVINO.
- Keep an `ImageEngine` abstraction so an Apple-native backend can be added/selected later.

---

# 3. Core Technology Stack

## Desktop

- Tauri 2

## Frontend

- React
- TypeScript
- Tailwind CSS

## Native/backend orchestration

- Rust

## Local text AI

- llama.cpp
- GGUF models

## Local image AI

- OpenVINO/LCM path on supported Intel/Windows hardware
- Abstract backend for macOS and future engines

## Optional cloud decision AI

- Jev API
- Optional only
- Never required for offline operation

## Database

- SQLite

## Icons

- Lucide

## Addons

- ZIP packages
- JSON manifest
- Sandboxed execution for games

## Packaging

- Native Tauri application
- Portable Windows build where practical
- macOS `.app`

---

# 4. Critical Architecture Rule

The React frontend must **never directly depend on AI runtimes**.

Use:

```text
React UI
   ↓
Tauri Commands
   ↓
Rust Core
   ↓
Engine Abstractions
   ├── TextEngine
   │     └── llama.cpp
   │
   ├── ImageEngine
   │     ├── OpenVINO / LCM
   │     └── future Mac backend
   │
   └── DecisionEngine
         ├── Jev API
         └── local deterministic fallback

The UI should request capabilities, not implementation details.

Examples:

generateText()
generateImage()
makeDecision()
installAddon()
startGame()

The UI should not know whether the implementation uses llama.cpp, OpenVINO, Jev, or a fallback.

5. Runtime Loading Strategy

AI runtimes must be lazy-loaded.

Do NOT start all AI systems when the application launches.

Examples:

Opening Home → no llama.cpp process.
Opening Play → no image runtime.
Opening Create → start image runtime only when generation is requested.
Opening Chat → start text runtime when a model is actually needed.
Jev → connect only when an action requires it.

When possible:

Stop idle runtimes.
Release unused resources.
Avoid keeping large models in RAM unnecessarily.

The app must remain responsive even when AI runtimes are unavailable.

6. AI System Design
6.1 Text Engine

Define a replaceable interface similar to:

interface TextEngine {
  start(modelId: string): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
  generate(request: TextGenerationRequest): AsyncIterable<TextChunk>;
  cancel(requestId: string): Promise<void>;
}

Responsibilities:

Load GGUF.
Generate text.
Stream output.
Stop generation.
Report status.
Handle errors.
Support configurable inference settings.

Possible settings:

Temperature
Top P
Top K
Context size
Max tokens
Threads
GPU/Metal layers where supported
Seed where useful

Keep defaults simple.

7. GGUF Model Support

Second Brain must make importing local GGUF models easy.

User flow
Models
  ↓
Import GGUF
  ↓
Select .gguf file
  ↓
Read metadata
  ↓
Estimate memory
  ↓
Register model
  ↓
Ready

Model metadata should include:

id
name
path
format
sizeBytes
quantization
architecture
status

Possible statuses:

available
missing
loading
running
error

The app should show:

File size
Architecture if available
Quantization if available
Estimated RAM requirement
Compatibility
Recommended / warning status
Model recommendation logic

For a Windows 16 GB CPU machine:

3B–4B Q4 models should be treated as a practical default range.
7B/8B Q4 models can be supported but may be slower/heavier.

Do not hard-code one specific model.

The user must be able to import any compatible GGUF.

8. Portable Directory Structure

The application should use centralized OS-independent path management.

Conceptually:

SecondBrain/
├── SecondBrain.exe
├── runtime/
│   ├── llama/
│   └── image/
├── models/
│   ├── text/
│   └── image/
├── addons/
├── library/
├── data/
└── config/

On macOS the actual paths can follow the appropriate application/data conventions.

Never:
C:\Users\Akash\...
Always:

Use Tauri/Rust path APIs and a centralized path service.

9. Image Generation

Image generation is a core feature, not an afterthought.

The user wants to create unusual, funny, relaxing, surreal, beautiful, or experimental images.

Windows / Intel

Prefer a lightweight local pipeline based on:

OpenVINO
LCM
DreamShaper v7 or another compatible lightweight image model

The exact backend must remain replaceable.

macOS

Use an appropriate Apple Silicon-compatible backend later.

Do not make OpenVINO mandatory across every platform.

Image Engine abstraction

Conceptually:

interface ImageEngine {
  start(modelId: string): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<ImageEngineStatus>;
  generate(request: ImageGenerationRequest): Promise<ImageResult>;
  cancel(requestId: string): Promise<void>;
}

Features:

Prompt
Optional negative prompt
Model selection
Size/preset
Steps
Seed
Cancel
Save
Favorite
History
UX rule

The user should not need to understand OpenVINO, LCM, pipelines, schedulers, or runtime internals.

Default UI:

Model: Auto
Prompt: [.................................]
[ Generate ]

Advanced settings can expose technical controls.

10. Jev Decision Layer

Jev is a decision/orchestration service, not a required local model.

Important:

Jev currently requires API access/key.
Jev must NOT be a hard dependency.
Second Brain must work without Jev.
Never pretend Jev is running locally when it is not.

Use Jev for decisions where reasoning/orchestration is useful.

Examples:

Surprise Me
Game strategy selection
Choosing an activity
Selecting a generated experience
Deciding which tool should run
Future multi-step agent actions

Do not send every simple operation through Jev.

11. Local Decision Fallback

When Jev is unavailable:

DecisionEngine
   ↓
Jev available?
   ├── yes → Jev
   └── no  → local deterministic fallback

Fallback must be:

Fast
Offline
Predictable
Deterministic where appropriate
Good enough to keep the feature functional

Example:

Surprise Me
→ random weighted activity selection

No feature should unnecessarily break because Jev is offline.

12. Main Application Areas
Home

Home should be calm and inviting.

Suggested copy:

Good evening. What do you want to do?

Primary actions:

Talk
Create
Play

Secondary:

✦ Surprise me

Show a small recent library section.

Do NOT make Home:
A metrics dashboard
A system-monitoring dashboard
A huge AI orb
A gamer launcher
A wall of cards
13. Chat

Features:

Import/select GGUF
Model status
Conversation history
Streaming responses
Stop generation
Regenerate
Copy
Code blocks
Temperature/context settings
Model manager access
Offline state
Error/recovery state

Chat layout should resemble a polished AI desktop app.

Avoid giant message cards.

Keep readable line lengths.

Show a subtle streaming cursor.

14. Create

Purpose:

Turn imagination into images.

UI should be prompt-first.

Example:

Create something strange...

[ prompt textarea                         ]

Model: Auto
[ Generate ]

Generated image should dominate the page.

Actions:

Save
Favorite
Regenerate
Copy prompt
Delete

History should be accessible without overwhelming the screen.

15. Play

Initial built-in games:

Ludo
Tic-Tac-Toe

These are the only built-in games required for the first version.

Future games can include:

Chess
Snake
2048
Minesweeper
etc.

But do not expand the initial scope unnecessarily.

16. Game AI Architecture

The game engine and AI decision-maker must be separate.

Important rule

Do NOT use a GGUF model to reason about every individual game move.

That would add unnecessary latency and resource usage.

Instead:

Game State
    ↓
Game Engine
    ↓
Legal Moves
    ↓
Decision Layer
    ├── Jev
    └── local fallback
    ↓
Selected Move
    ↓
Game Engine
    ↓
New Game State
    ↓
UI

The deterministic game engine owns the rules.

The AI decides among legal moves.

17. Common Game Engine Interface

Use a common architecture:

interface GameEngine {
  id: string;
  name: string;

  initialize(config: GameConfig): GameState;

  getLegalMoves(state: GameState): Move[];

  applyMove(state: GameState, move: Move): GameState;

  isGameOver(state: GameState): boolean;

  getWinner(state: GameState): Player | null;
}

This makes future games pluggable.

18. Tic-Tac-Toe

The engine handles:

Board
Turns
Legal moves
Win detection
Draw detection
State serialization

AI difficulty:

Easy
Legal move selection
Intentionally imperfect
Some randomness
Medium
Basic tactical awareness
Blocking immediate threats
Taking obvious wins
Hard
Strong tactical play
Winning moves
Blocking threats
Strategic evaluation

Jev may select among evaluated legal moves.

If Jev is unavailable, use a local algorithm.

For Tic-Tac-Toe, the local fallback can be effectively optimal without using an LLM.

19. Ludo

The Ludo engine must own:

Board state
Pieces
Dice
Turn order
Legal movement
Safe positions
Captures
Home/finish rules
Win conditions

The AI must not invent Ludo rules.

Flow:

Roll dice
→ Determine legal moves
→ Evaluate legal moves
→ Decision engine chooses move
→ Apply move
→ Continue

Difficulty levels:

Easy
Random-ish legal choices
Less strategic capture/protection behavior
Medium
Prefer useful movement
Consider captures
Some risk awareness
Basic progress toward home
Hard
Prefer winning/progressing moves
Evaluate captures
Consider safety
Consider piece distribution
Consider future risk
Select strategically among legal moves

Jev can make the higher-level decision.

Local fallback should remain instant.

20. Game Player UX

The UI must clearly communicate who is playing.

Example:

You
vs
Second Brain

Show:

Difficulty: Hard

Your turn

or:

Second Brain is choosing...

After AI movement:

Second Brain moved Red piece 12 → 17

Do not expose hidden chain-of-thought.

Only show safe action/status information.

Example:

“Second Brain is choosing…”
“Second Brain selected the blue piece.”
“Second Brain captured a piece.”

Do not show private internal reasoning.

21. AI Game Difficulty Must Feel Different

Difficulty should not merely change a label.

It should change the decision behavior.

Conceptually:

Easy
→ weaker scoring / randomness

Medium
→ tactical scoring

Hard
→ stronger strategic scoring

Jev should receive only the relevant structured game state and legal moves.

Do not send unnecessary raw application data.

22. Future AI-Generated Games

Later feature:

User prompt
    ↓
Jev decides/guides generation
    ↓
GGUF generates HTML/CSS/JS
    ↓
Validate
    ↓
Sandbox
    ↓
Preview
    ↓
Play
    ↓
Optional Save as Addon

Generated games must NEVER immediately execute as trusted native code.

They must be sandboxed.

23. Game Sandbox Security

Generated/installed games are untrusted.

They must not directly access:

File system
Shell
Credentials
OS commands
Arbitrary native APIs
User private data

Unless a future explicitly designed safe API grants access.

Prefer a restricted webview/sandbox model.

24. Addon System

Addon format:

addon.zip
└── addon/
    ├── manifest.json
    ├── index.html
    ├── assets/
    └── optional files

Example:

{
  "id": "potato-vs-mosquito",
  "name": "Potato vs Mosquito",
  "version": "1.0.0",
  "type": "game",
  "entry": "index.html"
}

Validation must include:

Required fields
Valid ID
Version
Supported type
Entry file exists
Safe paths
No path traversal
Duplicate ID detection

Never blindly extract ZIP files.

25. Library

Library contains:

Conversations
Generated images
Games
Addons
Favorites

Suggested organization:

All
Conversations
Images
Games
Favorites

Everything should remain local.

26. Models Screen

Models screen should be a clean list/table rather than large cards.

Example:

Model              Size     Quant       Status
------------------------------------------------
Tiny Model         2.4 GB   Q4_K_M      Ready
Medium Model       5.1 GB   Q4_K_M      Ready

Actions:

Import
Scan folder
Set default
Delete
Show details
Reveal location
27. Settings

Sections:

Appearance
Dark
Light
System
AI
Default text model
Text generation defaults
Image engine
Image defaults
Jev
API endpoint
API key
Enable/disable
Connection test
Storage
Models location
Library location
Addons location
Diagnostics
Runtime status
Logs
Clear temporary data

Technical settings should be hidden behind an Advanced section where possible.

28. UI/UX Direction

Primary inspiration:

OpenLLM Studio

But Second Brain should be calmer and more personal.

Desired:

Clean
Premium
Lightweight
Modern
Subtle sci-fi
Calm
Desktop-native feeling

Avoid:

Cyberpunk
Neon
Gamer styling
Excessive glow
Huge gradients
Childish UI
Excessive rounded cards
Constant animation
Huge AI orb
Visual noise
29. Color System
Dark
--bg: #111111;
--surface: #171717;
--surface-elevated: #1D1D1D;
--border: #2A2A2A;

--text: #F5F3EE;
--muted: #A6A19A;

--accent: #D97757;
--accent-hover: #E58A69;
Light
--bg: #F7F4EE;
--surface: #FFFDF8;
--surface-elevated: #FFFFFF;
--border: #E7E1D8;

--text: #262421;
--muted: #746F68;

--accent: #C96545;

Orange is an accent.

Do not make the entire interface orange.

30. Spacing System

Use a consistent spacing scale:

4
8
12
16
20
24
32
40
48
64

Prefer 8px-based rhythm.

Do not randomly introduce spacing values.

31. Typography

Use one primary system/UI font.

Avoid:

Futuristic display fonts
Decorative fonts
Multiple unrelated font families

Text should feel readable and professional.

32. Components

Create reusable components such as:

Button
IconButton
Input
Textarea
Select
Dialog
Dropdown
Tabs
Badge
Toast
EmptyState
LoadingState
ModelStatus
PageHeader
Sidebar

Do not create a new style for every page.

33. Layout Rules

Use:

CSS Grid
Flexbox
Normal document flow

Avoid absolute positioning for ordinary layout.

Minimum comfortable desktop target:

1000 × 650

At smaller widths:

Collapse sidebar where appropriate.
Avoid horizontal scrolling.
34. Animation

Animations should be subtle.

Target:

120–220ms

Use:

Opacity
Small translate
Subtle scale

Avoid:

Constant movement
Large transitions
Heavy particle systems
Excessive bouncing
35. Accessibility

Must support:

Keyboard navigation
Visible focus states
Semantic buttons
Tooltips for icon-only controls
Adequate contrast
State communicated with more than color alone

Do not rely exclusively on orange/gray to communicate status.

36. Home Interaction Model

Primary navigation:

Home
Chat
Create
Play
Library
Models
Add-ons
Settings

Optional:

Surprise Me

can be a prominent action without becoming a full navigation page.

37. Surprise Me

This is one of the defining personality features.

Example actions:

Talk
Create image
Play game
Coding challenge
Puzzle
Story
Creative prompt

Flow:

User clicks Surprise Me
       ↓
DecisionEngine
       ↓
Jev if available
       ↓
Local fallback if unavailable
       ↓
Selected experience

The user should be able to immediately start the selected activity.

38. Coding Challenges

Future/initial lightweight feature:

Small programming challenge
Prompt
Code editor
Run
Output
Basic validation

Do not turn this into a full IDE.

Keep it quick and fun.

Potential languages can be added later.

39. Offline-First Requirement

Core features must work without internet:

App launch
UI
Settings
SQLite
GGUF model management
Local chat
Local image generation where the local runtime/model is installed
Built-in games
Local game AI fallback
Library
Addons

Cloud-dependent:

Jev
Optional future cloud services

The UI should clearly distinguish:

Offline
Online
Jev unavailable
Model unavailable
Runtime unavailable

40. Error Handling

Every major AI feature needs:

Loading state
Error state
Cancel
Retry/recovery
Offline behavior

Examples:

Model missing
→ Show model manager action

Runtime unavailable
→ Explain + recovery option

Jev unavailable
→ Automatically use fallback where possible

Image generation failed
→ Show retry

Game AI unavailable
→ Use local fallback

Never silently fail.

41. Database

Use SQLite for local persistent state.

Likely entities:

models
conversations
messages
images
games
addons
favorites
settings

Keep database schema modular.

Do not store huge image/model binaries inside SQLite.

Store file references and metadata.

42. Security Principles

Treat these as untrusted:

GGUF imports
ZIP addons
Generated code
User-provided files
AI-generated content
External API responses

Validate all input.

Never trust:

ZIP paths
addon IDs
generated file paths
API data
AI-generated commands

No arbitrary shell execution.

43. Performance Rules

Target:

Fast startup
Low idle RAM
No unnecessary runtime startup
No unnecessary polling
No unnecessary React rerenders
Streaming updates only for the active message
Lazy loading where appropriate

Do not continuously poll AI runtimes if event-driven status is possible.

44. Rust Rules

Use typed errors.

Avoid production code like:

unwrap()
expect()

unless there is a clearly justified invariant.

Prefer:

Result
typed error enums
explicit recovery paths
45. React Rules

Use:

TypeScript types
Small components
Hooks where appropriate
Stable state boundaries
Avoid unnecessary rerenders
Keep AI streaming isolated to the active conversation/message

Do not create giant monolithic components.

46. Dependency Rules

Prefer lightweight dependencies.

Before adding a package, ask:

Is it actually required?
Can the existing stack solve it?
Does it materially increase application size?
Does it introduce another runtime?
Does it reduce portability?

Avoid unnecessary:

Python runtime dependencies
Node runtime requirements for end users
Docker requirements
Heavy UI frameworks
Multiple overlapping libraries

End users should not need to install:

Python
Node.js
Docker

for normal operation.

47. Development Environment

The developer machine can use normal development tools.

The final application should package required runtime binaries/assets so users do not need a development environment.

48. Build Phases

Build incrementally.

Never ask a coding agent to build the entire application in one giant task.

Phase 0 — Repository + Architecture

Tasks:

Initialize Tauri 2
React
TypeScript
Tailwind
Rust structure
Theme
Navigation shell
Basic architecture
Verify build

Exit criteria:

App launches
Frontend renders
Rust/Tauri commands work
Theme works
Repository structure is stable
Phase 1 — UI Foundation

Build:

Sidebar
Header
Buttons
Inputs
Dialogs
Toasts
Empty states
Loading states
Theme system
Responsive desktop layout

Do not implement real AI yet.

Phase 2 — SQLite

Build:

Database initialization
Migrations
Models
Conversations
Messages
Images
Games
Addons
Settings
Phase 3 — GGUF Model Manager

Build:

Import
Scan
Metadata
Memory estimate
Status
Delete
Default model
Phase 4 — llama.cpp Integration

Build:

Runtime abstraction
Start/stop
Model loading
Generation
Streaming
Cancellation
Error handling
Phase 5 — Chat

Build:

Conversation list
Chat screen
Streaming
Stop
Regenerate
Copy
Settings
Offline handling
Phase 6 — Image Generation

Build:

ImageEngine abstraction
Windows OpenVINO/LCM path
Model management
Prompt UI
Generation
Cancel
History
Save/favorite
Phase 7 — Jev Decision Layer

Build:

DecisionEngine
Jev configuration
API client
Secure key handling
Connection status
Local fallback
Phase 8 — Surprise Me

Connect:

Jev
+
local fallback
+
Chat
+
Create
+
Play
+
Challenges
Phase 9 — Addon System

Build:

ZIP import
Manifest parser
Validation
Safe extraction
Enable/disable
Uninstall
Metadata
Phase 10 — Game Sandbox

Build:

GameEngine abstraction
Game host
Sandbox
Player configuration
AI integration layer
Phase 11 — Built-in Games

Build only:

Tic-Tac-Toe
Easy
Medium
Hard
Ludo
Easy
Medium
Hard

Both must:

Clearly identify player
Clearly identify AI
Show whose turn it is
Show difficulty
Show AI thinking/selection status
Use deterministic game rules
Use Jev where useful
Have local fallback
Phase 12 — AI Game Generation

Build:

Prompt
→ Jev/GGUF
→ Generate
→ Validate
→ Sandbox
→ Preview
→ Save addon
Phase 13 — Library

Build:

Conversations
Images
Games
Favorites
Search/filter
Phase 14 — Settings + Runtime Management

Build:

Paths
Models
AI settings
Image settings
Jev
Runtime controls
Diagnostics
Phase 15 — Performance + Packaging

Test:

Windows CPU
16 GB RAM
Mac M4
Startup
Memory
Model loading
Image generation
Game responsiveness

Package:

Windows
macOS
Phase 16 — Final QA

Test:

Offline
Missing model
Corrupt model
Failed image runtime
Jev unavailable
Bad addon
Malicious ZIP paths
Generated game failure
Database migration
App restart
Runtime crash
Cancel operations
Long chat
Large image history
49. Project Documentation

Maintain these documents if the repository uses separate docs:

PROJECT_CONTEXT.md
docs/BUILD_PLAN.md
docs/ARCHITECTURE.md
docs/UI_UX.md
docs/CODING_RULES.md
docs/PROGRESS.md
docs/CHANGELOG.md
README.md

This master document can be treated as the source of truth if a single-file workflow is preferred.

50. Coding-Agent Instructions

Before coding:

Read this document.
Inspect current repository state.
Inspect existing implementation.
Check current phase.
Do not assume unfinished work is complete.

Then:

Make one logical feature at a time.
Keep the repository buildable.
Run appropriate checks.
Update progress.
Update changelog after meaningful work.
51. Never Fake Completion

If something is:

Mocked
Placeholder
Stubbed
Simulated
Not wired to a real runtime

say so clearly in project progress.

Never write:

Completed llama.cpp integration

if the app only contains a fake response generator.

Use:

Chat UI implemented.
llama.cpp integration pending.
52. No Unrelated Refactors

When implementing a feature:

Do not rewrite unrelated components.
Do not replace working libraries without reason.
Do not change the architecture casually.
Do not change visual tokens without checking the design system.
53. Design-System Protection

Before adding a new:

Button style
Radius
Font
Orange shade
Spacing value
Shadow
Border style

check whether an existing token/component already solves it.

Consistency is more important than novelty.

54. Suggested Repository Structure

A conceptual structure:

second-brain/
├── src/
│   ├── components/
│   ├── pages/
│   ├── features/
│   │   ├── chat/
│   │   ├── create/
│   │   ├── play/
│   │   ├── library/
│   │   ├── models/
│   │   └── addons/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── styles/
│
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   ├── engines/
│   │   │   ├── text/
│   │   │   ├── image/
│   │   │   └── decision/
│   │   ├── games/
│   │   │   ├── ludo/
│   │   │   └── tic_tac_toe/
│   │   ├── addons/
│   │   ├── database/
│   │   ├── paths/
│   │   └── errors/
│   └── Cargo.toml
│
├── models/
├── runtime/
├── addons/
├── library/
├── data/
├── config/
│
├── docs/
│
├── PROJECT_CONTEXT.md
└── README.md

The exact structure may change, but the separation of concerns should remain.

55. Recommended Engine Boundaries
Text
TextEngine
└── LlamaCppTextEngine

Future:

└── AnotherLocalTextEngine
Image
ImageEngine
├── OpenVinoImageEngine
└── MacImageEngine
Decision
DecisionEngine
├── JevDecisionEngine
└── LocalDecisionEngine
Games
GameEngine
├── TicTacToeEngine
└── LudoEngine

This allows future replacement without rewriting the UI.

56. Game Decision Data

Do not send giant prompts.

Send structured data.

Example:

{
  "game": "tic-tac-toe",
  "difficulty": "hard",
  "player": "second-brain",
  "state": {
    "board": [
      "X", null, "O",
      null, "X", null,
      null, null, "O"
    ]
  },
  "legalMoves": [1, 3, 5, 6, 7]
}

For Ludo, send only:

Current player
Dice result
Piece positions
Legal moves
Relevant board state
Difficulty

The engine remains the source of truth.

57. AI Decision Output

The AI should return structured output whenever possible.

Example:

{
  "selectedMoveId": "move_3"
}

Not:

I think the best thing to do is...

The game engine validates that the returned move is legal.

If the AI returns an invalid move:

validate
→ reject
→ retry or local fallback

Never blindly execute AI output.

58. Game Performance

AI gameplay should feel immediate.

The player should not wait for a large GGUF model to generate a paragraph before every move.

Preferred priority:

Jev structured decision
or
local deterministic decision

Use GGUF for game generation or conversational features, not mandatory per-move reasoning.

59. AI Personality

Second Brain should feel intelligent without becoming annoying.

Avoid:

Constant jokes
Constant emojis
Overly enthusiastic messages
Fake emotional dependency
Excessive roleplay

The tone should be:

Calm
Friendly
Smart
Slightly playful when appropriate
Respectful
60. No Unnecessary Internet Dependency

Do not make:

login
cloud database
mandatory API

requirements for the basic application.

A fresh installation with a compatible GGUF should be able to work offline.

61. Future Extensibility

Possible future features:

More games
More local model runtimes
Better Mac image generation
Voice input/output
Local speech recognition
Music
Journaling
More creative tools
MCP integrations
Optional cloud providers
Multiplayer
Plugin marketplace

Do not implement these during the initial build unless explicitly requested.

62. Current Project Status

At the beginning of implementation:

Current phase:
Phase 0 — Repository + Architecture

Completed:
Project concept
Architecture decisions
UI/UX direction
AI/runtime strategy
Game architecture
Addon security model
Build plan

Not yet completed:
Tauri repository initialization
React shell
Rust core
SQLite
GGUF manager
llama.cpp integration
Image engine
Jev integration
Games
Addon system
Library
Packaging
63. Immediate Next Task

The first coding-agent task should be:

Initialize a clean Tauri 2 + React + TypeScript + Tailwind + Rust project for Second Brain and implement only the Phase 0 application shell.

The shell should include:

Tauri app
React app
TypeScript
Tailwind
Dark/light theme
Sidebar
Navigation routes/pages
Placeholder Home
Placeholder Chat
Placeholder Create
Placeholder Play
Placeholder Library
Placeholder Models
Placeholder Add-ons
Placeholder Settings

Do not implement real AI yet.

Do not add llama.cpp yet.

Do not add OpenVINO yet.

Do not add Jev yet.

Do not add games yet.

First establish a clean foundation.

64. Phase 0 Agent Prompt

Use this prompt for the first coding agent:

Read PROJECT_CONTEXT.md completely before coding.

We are building Second Brain, a lightweight, portable, offline-first Tauri 2 desktop application using React + TypeScript + Tailwind + Rust.

Current phase:
Phase 0 — Repository + Architecture.

Implement ONLY the Phase 0 shell.

Requirements:
- Initialize Tauri 2.
- React + TypeScript.
- Tailwind CSS.
- Rust backend.
- Clean project structure.
- Centralized theme tokens.
- Dark and light modes.
- Warm orange accent.
- Desktop-first polished UI inspired by OpenLLM Studio.
- Calm, premium, subtle sci-fi.
- No cyberpunk/neon/gamer styling.
- Lucide icons.
- Sidebar navigation.
- Pages/placeholders for:
  Home
  Chat
  Create
  Play
  Library
  Models
  Add-ons
  Settings
- Home should not be a metrics dashboard.
- Use reusable UI components.
- Do not implement AI engines.
- Do not implement llama.cpp.
- Do not implement image generation.
- Do not implement Jev.
- Do not implement games.
- Do not add unnecessary dependencies.
- Do not hard-code OS-specific paths.

Before changing architecture, inspect the repository.

After implementation:
- Run frontend checks.
- Run Rust checks.
- Run the Tauri build if practical.
- Fix errors.
- Update project progress/changelog if those files exist.

Do not claim any runtime integration is complete unless it actually works.
65. Handoff Format

At the end of every coding-agent session, report:

Current phase:

Completed:

Files changed:

Tests/checks:

Known issues:

Next task:

Important decisions:

This makes the project easy to continue with another AI.

66. Definition of Done

Second Brain is not considered complete merely because the UI looks good.

The finished application should provide:

✓ Portable desktop app
✓ Offline-first operation
✓ GGUF model import
✓ Local text chat
✓ Local image generation where supported
✓ Optional Jev decision layer
✓ Local fallback when Jev is unavailable
✓ Tic-Tac-Toe
✓ Ludo
✓ Easy/Medium/Hard AI gameplay
✓ Clear player/AI status
✓ Addon system
✓ Sandboxed games
✓ AI-generated games
✓ Local library
✓ Settings
✓ Good error handling
✓ Runtime lifecycle management
✓ Windows support
✓ macOS support
✓ Low unnecessary resource usage
67. Final Product Principle

The most important rule for Second Brain:

It should feel like a small, intelligent personal space that happens to contain powerful local AI — not like an AI engineering dashboard.

Technical complexity belongs behind the scenes.

The user should see:

Talk
Create
Play
Surprise Me

The application should handle:

GGUF
llama.cpp
OpenVINO
Jev
SQLite
Rust
Tauri
sandboxes
runtime management
model paths

without making the user think about them unless they open advanced settings.

# 68. Model Metadata, Icons & Profile Images

## 68.1 Model Information / Initials

Second Brain must not depend on manually entering model information.

When a user imports a `.gguf` model, the application should automatically read available GGUF metadata.

Possible information to detect:

```text
Model name
Architecture
Quantization
Parameter count
Context length
File size
Author / creator if available
Model family if available
```

If metadata is incomplete, use sensible fallback values.

Example:

```text
Model:
Llama 3.2 3B

Architecture:
Llama

Quantization:
Q4_K_M

Size:
2.0 GB
```

### Model initials / avatar

If the model does not have an image, automatically generate a simple avatar from its name.

Examples:

```text
Llama 3.2 → LL
Qwen 3 → Q3
Gemma 3 → G3
Mistral → MI
```

Rules:

* Use 1–2 readable characters.
* Use the existing application accent/design system.
* Do not download random images from the internet.
* The initials should be deterministic.
* The generated avatar should be lightweight and local.

The user may optionally assign a custom model image in the future, but this is not required for the first version.

---

# 68.2 Application Icons

Use **Lucide** for normal application/interface icons.

Examples:

```text
Home
Message
Image
Gamepad
Library
Settings
Folder
Download
Upload
Trash
Search
Play
Pause
Stop
Plus
More
```

Do not download random icon images from the internet.

Use one consistent icon system throughout the application.

For branded/model-specific icons, use an explicit local asset only when legally/technically appropriate.

---

# 68.3 User Profile Image

Second Brain should support an optional local profile image for the user.

The user can configure it from:

```text
Settings
→ Profile
→ Profile Image
```

Available actions:

```text
Choose Image
Replace
Remove
```

Supported common formats:

```text
PNG
JPG/JPEG
WEBP
```

The image should be copied into the application's managed local data/library area rather than relying permanently on the original external file path.

Example conceptual storage:

```text
data/
└── profile/
    ├── user-avatar.webp
    └── bot-avatar.webp
```

The exact OS path must be handled through the centralized application path service.

If the user has not selected an image:

```text
Generate a simple initials avatar automatically.
```

Example:

```text
Akash → A
Jerry → J
```

Do not require the user to upload a profile image.

---

# 68.4 AI / Bot Profile Image

The AI/bot should also have a profile image.

Default behavior:

* Use a built-in local Second Brain avatar.
* Do not download an avatar from an external website.
* Do not require an internet connection.

The default bot avatar can be a simple branded/local asset that matches the Second Brain design.

Example:

```text
Second Brain
[local bot avatar]
```

The bot avatar should not be an oversized glowing AI orb.

Keep it simple, premium, and recognizable.

---

# 68.5 Manual Profile Image Settings

The user must be able to manually change profile images.

Settings should include:

```text
Profile
────────────────────────

Your Profile Image
[ Current Avatar ]

[ Choose Image ]
[ Remove ]

AI Profile Image
[ Current Bot Avatar ]

[ Choose Image ]
[ Reset to Default ]
```

This should apply to:

* User avatar in Chat
* User identity in games where applicable
* AI/bot avatar
* Other areas that display the corresponding identity

Do not create separate avatar settings for every page.

There should be one central profile configuration.

---

# 68.6 Profile Configuration

Store only metadata/reference information in SQLite.

Conceptually:

```text
profile
├── userName
├── userImagePath
├── botName
└── botImagePath
```

The actual image files should remain in managed application storage.

The UI should access profile information through a central profile service rather than reading files directly.

---

# 68.7 Default Identity

On first launch:

```text
User:
User

AI:
Second Brain
```

The user can later change the displayed names.

Example:

```text
User:
Akash

AI:
Second Brain
```

The AI/bot name should be configurable separately from the AI model name.

For example:

```text
Bot name:
Second Brain

Model:
Qwen 3 4B
```

These are different concepts and must not be tied together.

---

# 68.8 Missing / Invalid Images

If a configured image is:

* Deleted
* Corrupted
* Unsupported
* Unavailable

the application must automatically fall back to:

```text
Initials avatar
```

or, for the bot:

```text
Default Second Brain avatar
```

The application must never show a broken-image UI.

---

# 68.9 Privacy / Offline Requirement

Profile images are personal local data.

Therefore:

* Store them locally.
* Do not upload them automatically.
* Do not send them to Jev.
* Do not send them to cloud AI.
* Do not require an internet connection.
* Do not use an external avatar service.

The profile system should work completely offline.

---

# 68.10 Implementation Principle

Profile and avatar handling should be centralized:

```text
ProfileService
├── getUserProfile()
├── updateUserName()
├── setUserImage()
├── removeUserImage()
├── getBotProfile()
├── setBotImage()
└── resetBotImage()
```

Other features should consume profile information through this service.

For example:

```text
Chat
Game
Library
Settings
```

should not each implement their own avatar-storage logic.

---

# 68.11 Important Rule

Do not make external image services a required dependency for:

* Model avatars
* User avatars
* Bot avatars
* Application icons

Everything required for the default experience should be available locally.

The application should remain fully usable without internet access.

