import { getSetting, setSetting } from './db'

export type CanvasNodeKind =
  | 'sticky'
  | 'card'
  | 'checklist'
  | 'table'
  | 'heading'
  | 'frame'
  | 'image'
  | 'link'
  | 'code'
  | 'swatch'
  | 'wireframe'
  | 'flow'

export type WireframePieceKind =
  | 'screen'
  | 'navbar'
  | 'tabbar'
  | 'button'
  | 'input'
  | 'search'
  | 'uicard'
  | 'listrow'
  | 'toggle'
  | 'checkbox'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface CanvasNode {
  id: string
  kind: CanvasNodeKind
  x: number
  y: number
  width: number
  height: number
  title: string
  content: string
  color: string
  locked?: boolean
  zIndex?: number
  // Optional specialized fields
  checklist?: ChecklistItem[]
  tableRows?: string[][]
  imageUrl?: string
  imageGenerating?: boolean
  imagePrompt?: string
  linkUrl?: string
  codeLanguage?: string
  pieceKind?: WireframePieceKind
  flowShape?: 'pill' | 'diamond' | 'rect'
}

export interface CanvasEdge {
  id: string
  fromId: string
  toId: string
  label?: string
  color?: string
}

export interface CanvasStroke {
  id: string
  points: Array<{ x: number; y: number }>
  color: string
  size: number
}

export interface UnsortedNote {
  id: string
  text: string
  createdAt: string
}

export interface BoardTheme {
  id: string
  name: string
  bg: string
  dot: string
  accent: string
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'obsidian', name: 'Mochi Obsidian', bg: '#16141a', dot: '#322e3a', accent: '#c084fc' },
  { id: 'midnight', name: 'Midnight Slate', bg: '#11141c', dot: '#283044', accent: '#38bdf8' },
  { id: 'espresso', name: 'Warm Espresso', bg: '#191513', dot: '#382e29', accent: '#d97757' },
  { id: 'forest', name: 'Deep Pine', bg: '#111916', dot: '#263831', accent: '#34d399' },
  { id: 'plum', name: 'Velvet Plum', bg: '#1b1320', dot: '#3b2846', accent: '#f472b6' },
  { id: 'paper', name: 'Soft Daylight', bg: '#f4f1ea', dot: '#d5cfc2', accent: '#d97757' },
]

export const NODE_COLORS = [
  { id: 'violet', name: 'Lavender', hex: '#a855f7', surface: 'rgba(168, 85, 247, 0.14)', border: 'rgba(168, 85, 247, 0.38)' },
  { id: 'coral', name: 'Coral', hex: '#f43f5e', surface: 'rgba(244, 63, 94, 0.14)', border: 'rgba(244, 63, 94, 0.38)' },
  { id: 'amber', name: 'Honey', hex: '#f59e0b', surface: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.38)' },
  { id: 'emerald', name: 'Mint', hex: '#10b981', surface: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.38)' },
  { id: 'sky', name: 'Sky', hex: '#0ea5e9', surface: 'rgba(14, 165, 233, 0.14)', border: 'rgba(14, 165, 233, 0.38)' },
  { id: 'terracotta', name: 'Terracotta', hex: '#d97757', surface: 'rgba(217, 119, 87, 0.15)', border: 'rgba(217, 119, 87, 0.4)' },
  { id: 'zinc', name: 'Graphite', hex: '#71717a', surface: 'rgba(39, 39, 42, 0.85)', border: 'rgba(113, 113, 122, 0.38)' },
]

export interface CanvasBoard {
  id: string
  projectId: string
  folderId: string | null
  title: string
  themeId: string
  panX: number
  panY: number
  zoom: number
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  strokes: CanvasStroke[]
  unsorted: UnsortedNote[]
  updatedAt: string
}

export interface CanvasFolder {
  id: string
  projectId: string
  name: string
}

export interface CanvasProject {
  id: string
  name: string
  color: string
}

export interface CanvasWorkspaceState {
  projects: CanvasProject[]
  folders: CanvasFolder[]
  boards: CanvasBoard[]
  activeBoardId: string
}

const STORAGE_KEY = 'sb_mochi_canvas_workspace_v1'

export function createStarterWorkspace(): CanvasWorkspaceState {
  const projId = 'proj-default'
  const folderId = 'folder-default'
  const boardId = 'board-welcome'

  const starterNodes: CanvasNode[] = [
    {
      id: 'frame-ideation',
      kind: 'frame',
      x: 120,
      y: 90,
      width: 560,
      height: 410,
      title: 'Product & AI Brainstorm',
      content: '',
      color: 'violet',
      zIndex: 0,
    },
    {
      id: 'node-welcome-sticky',
      kind: 'sticky',
      x: 150,
      y: 145,
      width: 240,
      height: 175,
      title: 'Welcome to Canvas ✨',
      content:
        '• Double-click anywhere to drop a note\n• Drag from the right dot of any card to connect nodes\n• Click Mochi (bottom-right) to let AI build, organize, or generate art on your board!',
      color: 'amber',
      zIndex: 2,
    },
    {
      id: 'node-checklist',
      kind: 'checklist',
      x: 415,
      y: 145,
      width: 240,
      height: 195,
      title: 'Launch Roadmap',
      content: '',
      color: 'emerald',
      zIndex: 2,
      checklist: [
        { id: 'c1', text: 'Map core user journey', done: true },
        { id: 'c2', text: 'Wireframe mobile screens', done: true },
        { id: 'c3', text: 'Ask Mochi AI to expand ideas', done: false },
        { id: 'c4', text: 'Generate concept art on board', done: false },
      ],
    },
    {
      id: 'node-flow-goal',
      kind: 'flow',
      x: 260,
      y: 380,
      width: 240,
      height: 84,
      title: 'AI-Assisted Second Brain',
      content: 'Visual thinking + Local LLM + Live Web + Image Studio',
      color: 'sky',
      flowShape: 'pill',
      zIndex: 3,
    },
  ]

  const starterEdges: CanvasEdge[] = [
    {
      id: 'edge-1',
      fromId: 'node-welcome-sticky',
      toId: 'node-flow-goal',
      label: 'inspires',
      color: '#a855f7',
    },
    {
      id: 'edge-2',
      fromId: 'node-checklist',
      toId: 'node-flow-goal',
      label: 'ships',
      color: '#10b981',
    },
  ]

  return {
    projects: [{ id: projId, name: 'New Project', color: '#f472b6' }],
    folders: [{ id: folderId, projectId: projId, name: 'New folder' }],
    boards: [
      {
        id: boardId,
        projectId: projId,
        folderId,
        title: 'Untitled board',
        themeId: 'obsidian',
        panX: 80,
        panY: 40,
        zoom: 1,
        nodes: starterNodes,
        edges: starterEdges,
        strokes: [],
        unsorted: [],
        updatedAt: new Date().toISOString(),
      },
    ],
    activeBoardId: boardId,
  }
}

export async function loadCanvasWorkspace(): Promise<CanvasWorkspaceState> {
  try {
    const localRaw = localStorage.getItem(STORAGE_KEY)
    if (localRaw) {
      const parsed = JSON.parse(localRaw) as CanvasWorkspaceState
      if (parsed && Array.isArray(parsed.boards) && parsed.boards.length > 0) {
        return parsed
      }
    }
  } catch {
    // ignore
  }

  try {
    const dbRaw = await getSetting(STORAGE_KEY)
    if (dbRaw) {
      const parsed = JSON.parse(dbRaw) as CanvasWorkspaceState
      if (parsed && Array.isArray(parsed.boards) && parsed.boards.length > 0) {
        localStorage.setItem(STORAGE_KEY, dbRaw)
        return parsed
      }
    }
  } catch {
    // ignore
  }

  const starter = createStarterWorkspace()
  await saveCanvasWorkspace(starter)
  return starter
}

export async function saveCanvasWorkspace(state: CanvasWorkspaceState): Promise<void> {
  try {
    const json = JSON.stringify(state)
    localStorage.setItem(STORAGE_KEY, json)
    await setSetting(STORAGE_KEY, json).catch(() => {})
  } catch {
    // ignore quota errors
  }
}

// ============================================================================
// 1-CLICK IDEATE FLOW TEMPLATES (Wireframing, Flowchart, Journey, Sitemap, Mind map)
// ============================================================================

export type IdeateCategory = 'Wireframing' | 'Flowchart' | 'Journey' | 'Sitemap' | 'Mind map'

export function buildIdeateTemplateNodes(
  category: IdeateCategory,
  originX: number,
  originY: number,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const ts = Date.now().toString(36)

  if (category === 'Wireframing') {
    const s1 = `wf-screen-1-${ts}`
    const s2 = `wf-screen-2-${ts}`
    const s3 = `wf-screen-3-${ts}`
    return {
      nodes: [
        {
          id: s1,
          kind: 'wireframe',
          pieceKind: 'screen',
          x: originX,
          y: originY,
          width: 240,
          height: 340,
          title: '1. Onboarding Screen',
          content: '[Logo & Hero Artwork]\n\n"Welcome to Your Workspace"\n\n[ Continue with Apple ]\n[ Continue with Email ]',
          color: 'violet',
          zIndex: 3,
        },
        {
          id: s2,
          kind: 'wireframe',
          pieceKind: 'screen',
          x: originX + 310,
          y: originY,
          width: 240,
          height: 340,
          title: '2. Home Dashboard',
          content: '[Search Bar ⌘K]\n\n• Active Projects (4)\n• Recent AI Insights\n• Quick Capture Tray\n\n[ + New Board ]',
          color: 'sky',
          zIndex: 3,
        },
        {
          id: s3,
          kind: 'wireframe',
          pieceKind: 'screen',
          x: originX + 620,
          y: originY,
          width: 240,
          height: 340,
          title: '3. AI Studio View',
          content: '[Split Canvas + Mochi Chat]\n\n• Auto-cluster notes\n• Generate concept art\n• Export Markdown spec',
          color: 'emerald',
          zIndex: 3,
        },
      ],
      edges: [
        { id: `e1-${ts}`, fromId: s1, toId: s2, label: 'Sign in', color: '#a855f7' },
        { id: `e2-${ts}`, fromId: s2, toId: s3, label: 'Open board', color: '#0ea5e9' },
      ],
    }
  }

  if (category === 'Flowchart') {
    const n1 = `fc-1-${ts}`
    const n2 = `fc-2-${ts}`
    const n3 = `fc-3-${ts}`
    const n4 = `fc-4-${ts}`
    return {
      nodes: [
        {
          id: n1,
          kind: 'flow',
          flowShape: 'pill',
          x: originX,
          y: originY + 80,
          width: 200,
          height: 78,
          title: 'User Input / Goal',
          content: 'Voice, text, or canvas selection',
          color: 'violet',
          zIndex: 3,
        },
        {
          id: n2,
          kind: 'flow',
          flowShape: 'diamond',
          x: originX + 260,
          y: originY + 70,
          width: 220,
          height: 96,
          title: 'Agent Intent Router',
          content: 'Decide: Local Brain vs Live Tools',
          color: 'amber',
          zIndex: 3,
        },
        {
          id: n3,
          kind: 'flow',
          flowShape: 'rect',
          x: originX + 540,
          y: originY,
          width: 220,
          height: 88,
          title: 'Execute Live Tools',
          content: 'Web Search • TMDB • Local SD Art',
          color: 'sky',
          zIndex: 3,
        },
        {
          id: n4,
          kind: 'flow',
          flowShape: 'pill',
          x: originX + 540,
          y: originY + 140,
          width: 220,
          height: 88,
          title: 'Apply to Canvas & Reply',
          content: 'Update cards, layout & connections',
          color: 'emerald',
          zIndex: 3,
        },
      ],
      edges: [
        { id: `fc-e1-${ts}`, fromId: n1, toId: n2, label: 'parse', color: '#a855f7' },
        { id: `fc-e2-${ts}`, fromId: n2, toId: n3, label: 'needs data', color: '#f59e0b' },
        { id: `fc-e3-${ts}`, fromId: n3, toId: n4, label: 'synthesize', color: '#0ea5e9' },
        { id: `fc-e4-${ts}`, fromId: n2, toId: n4, label: 'direct', color: '#10b981' },
      ],
    }
  }

  if (category === 'Journey') {
    const j1 = `jr-1-${ts}`
    const j2 = `jr-2-${ts}`
    const j3 = `jr-3-${ts}`
    const j4 = `jr-4-${ts}`
    return {
      nodes: [
        {
          id: j1,
          kind: 'card',
          x: originX,
          y: originY,
          width: 220,
          height: 165,
          title: 'Phase 1: Discovery',
          content: '• User has scattered ideas & tabs\n• Emotion: Overwhelmed\n• Goal: Dump everything in one calm place',
          color: 'coral',
          zIndex: 3,
        },
        {
          id: j2,
          kind: 'card',
          x: originX + 260,
          y: originY,
          width: 220,
          height: 165,
          title: 'Phase 2: Capture',
          content: '• Double-clicks board or uses Unsorted tray\n• Drops sticky notes, links & sketches',
          color: 'amber',
          zIndex: 3,
        },
        {
          id: j3,
          kind: 'card',
          x: originX + 520,
          y: originY,
          width: 220,
          height: 165,
          title: 'Phase 3: Co-Create with Mochi',
          content: '• Clicks Mochi AI helper\n• AI clusters notes, generates visuals & fills gaps',
          color: 'violet',
          zIndex: 3,
        },
        {
          id: j4,
          kind: 'card',
          x: originX + 780,
          y: originY,
          width: 220,
          height: 165,
          title: 'Phase 4: Execution',
          content: '• Clear roadmap & checklists\n• Emotion: Focused & in flow',
          color: 'emerald',
          zIndex: 3,
        },
      ],
      edges: [
        { id: `jr-e1-${ts}`, fromId: j1, toId: j2, label: 'step 1', color: '#f43f5e' },
        { id: `jr-e2-${ts}`, fromId: j2, toId: j3, label: 'step 2', color: '#f59e0b' },
        { id: `jr-e3-${ts}`, fromId: j3, toId: j4, label: 'step 3', color: '#a855f7' },
      ],
    }
  }

  if (category === 'Sitemap') {
    const root = `sm-root-${ts}`
    const c1 = `sm-c1-${ts}`
    const c2 = `sm-c2-${ts}`
    const c3 = `sm-c3-${ts}`
    return {
      nodes: [
        {
          id: root,
          kind: 'flow',
          flowShape: 'rect',
          x: originX + 260,
          y: originY,
          width: 220,
          height: 76,
          title: 'App Root / Home',
          content: 'Navigation & Global Search (⌘K)',
          color: 'violet',
          zIndex: 3,
        },
        {
          id: c1,
          kind: 'card',
          x: originX,
          y: originY + 140,
          width: 210,
          height: 140,
          title: '/chat — AI Agent',
          content: '• Multi-tool reasoning\n• Live Web & TMDB\n• Episodic Memory',
          color: 'sky',
          zIndex: 3,
        },
        {
          id: c2,
          kind: 'card',
          x: originX + 265,
          y: originY + 140,
          width: 210,
          height: 140,
          title: '/canvas — Mochi Board',
          content: '• Infinite visual board\n• Wireframes & flows\n• Mochi AI co-pilot',
          color: 'emerald',
          zIndex: 3,
        },
        {
          id: c3,
          kind: 'card',
          x: originX + 530,
          y: originY + 140,
          width: 210,
          height: 140,
          title: '/create — Art Studio',
          content: '• Local SD Metal engine\n• Prompt synthesizer\n• Gallery export',
          color: 'amber',
          zIndex: 3,
        },
      ],
      edges: [
        { id: `sm-e1-${ts}`, fromId: root, toId: c1, color: '#0ea5e9' },
        { id: `sm-e2-${ts}`, fromId: root, toId: c2, color: '#10b981' },
        { id: `sm-e3-${ts}`, fromId: root, toId: c3, color: '#f59e0b' },
      ],
    }
  }

  // Mind map
  const center = `mm-center-${ts}`
  const b1 = `mm-b1-${ts}`
  const b2 = `mm-b2-${ts}`
  const b3 = `mm-b3-${ts}`
  const b4 = `mm-b4-${ts}`
  return {
    nodes: [
      {
        id: center,
        kind: 'flow',
        flowShape: 'pill',
        x: originX + 270,
        y: originY + 120,
        width: 220,
        height: 86,
        title: 'Core Concept / Vision',
        content: 'Central theme of your mind map',
        color: 'violet',
        zIndex: 4,
      },
      {
        id: b1,
        kind: 'sticky',
        x: originX,
        y: originY,
        width: 210,
        height: 125,
        title: 'Target Audience',
        content: 'Who benefits most and what pain point does this solve?',
        color: 'sky',
        zIndex: 3,
      },
      {
        id: b2,
        kind: 'sticky',
        x: originX + 550,
        y: originY,
        width: 210,
        height: 125,
        title: 'Key Differentiators',
        content: 'What makes this 10x better than existing alternatives?',
        color: 'emerald',
        zIndex: 3,
      },
      {
        id: b3,
        kind: 'sticky',
        x: originX,
        y: originY + 210,
        width: 210,
        height: 125,
        title: 'Technical Stack',
        content: 'Local AI models, Rust/Tauri, React, SQLite, Metal GPU',
        color: 'amber',
        zIndex: 3,
      },
      {
        id: b4,
        kind: 'sticky',
        x: originX + 550,
        y: originY + 210,
        width: 210,
        height: 125,
        title: 'Next Action Steps',
        content: 'Prototype → User feedback → Polish → Ship',
        color: 'coral',
        zIndex: 3,
      },
    ],
    edges: [
      { id: `mm-e1-${ts}`, fromId: center, toId: b1, color: '#0ea5e9' },
      { id: `mm-e2-${ts}`, fromId: center, toId: b2, color: '#10b981' },
      { id: `mm-e3-${ts}`, fromId: center, toId: b3, color: '#f59e0b' },
      { id: `mm-e4-${ts}`, fromId: center, toId: b4, color: '#f43f5e' },
    ],
  }
}

