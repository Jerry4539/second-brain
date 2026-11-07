export type HardwareTier = 'nano' | 'compact' | 'pro'

export interface CuratedModel {
  id: string
  name: string
  kind: 'text' | 'image'
  tier: HardwareTier
  badge: string
  badgeTone: 'success' | 'accent' | 'neutral'
  sizeLabel: string
  sizeMb: number
  minRamGb: number
  description: string
  filename: string
  downloadUrl: string
  idealFor: string
  ramEstimate: string
  metalSpeed: string
  cpuSpeed: string
  recommendedFor: HardwareTier[]
}

export const CURATED_MODELS: CuratedModel[] = [
  // ===========================================================================
  // HIGH-INTELLIGENCE FLAGSHIP BRAINS (4.6 GB – 4.9 GB — Best Smartness & Depth)
  // ===========================================================================
  {
    id: 'qwen-2.5-7b-q4',
    name: 'Qwen 2.5 7B Instruct',
    kind: 'text',
    tier: 'pro',
    badge: '★ #1 Smartest All-Rounder • 4.68 GB',
    badgeTone: 'success',
    sizeLabel: '4.68 GB',
    sizeMb: 4792,
    minRamGb: 8,
    ramEstimate: '~5.2 GB RAM',
    metalSpeed: '~38 tok/s (Metal)',
    cpuSpeed: '~9 tok/s (CPU)',
    recommendedFor: ['compact', 'pro'],
    idealFor: 'Deep reasoning, agentic tool synthesis, Hinglish/multilingual understanding & rich tables',
    description:
      'True desktop-grade intelligence. Understands subtle user intent, synthesizes live web & TMDB data with critical depth, and writes with human clarity.',
    filename: 'qwen2.5-7b-instruct-q4_k_m.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'llama-3.1-8b-q4',
    name: 'Meta Llama 3.1 8B Instruct',
    kind: 'text',
    tier: 'pro',
    badge: 'Best Human Reasoning • 4.92 GB',
    badgeTone: 'success',
    sizeLabel: '4.92 GB',
    sizeMb: 5038,
    minRamGb: 8,
    ramEstimate: '~5.4 GB RAM',
    metalSpeed: '~35 tok/s (Metal)',
    cpuSpeed: '~8 tok/s (CPU)',
    recommendedFor: ['compact', 'pro'],
    idealFor: 'Nuanced conversation, critical analysis, brainstorming, and natural writing',
    description:
      'Meta’s gold-standard 8B flagship. Thinks critically through multi-layered questions, avoids robotic clichés, and handles long conversations reliably.',
    filename: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'deepseek-r1-7b-q4',
    name: 'DeepSeek R1 Distill Qwen 7B',
    kind: 'text',
    tier: 'pro',
    badge: 'Deep Chain-of-Thought • 4.68 GB',
    badgeTone: 'accent',
    sizeLabel: '4.68 GB',
    sizeMb: 4792,
    minRamGb: 8,
    ramEstimate: '~5.2 GB RAM',
    metalSpeed: '~36 tok/s (Metal)',
    cpuSpeed: '~9 tok/s (CPU)',
    recommendedFor: ['pro'],
    idealFor: 'Hard logic, math, system architecture, and step-by-step analytical problem solving',
    description:
      'Takes extra time to think step-by-step inside a reasoning trace (<think>) before delivering thoroughly verified, high-IQ conclusions.',
    filename: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
  },
  {
    id: 'qwen-2.5-coder-7b-q4',
    name: 'Qwen 2.5 Coder 7B Instruct',
    kind: 'text',
    tier: 'pro',
    badge: 'Pro Code & Apps • 4.68 GB',
    badgeTone: 'accent',
    sizeLabel: '4.68 GB',
    sizeMb: 4792,
    minRamGb: 8,
    ramEstimate: '~5.2 GB RAM',
    metalSpeed: '~38 tok/s (Metal)',
    cpuSpeed: '~9 tok/s (CPU)',
    recommendedFor: ['pro'],
    idealFor: 'Production code, debugging, full-stack architecture & interactive HTML/JS Canvas apps',
    description:
      'Matches top cloud models on coding benchmarks. Builds complete interactive HTML/CSS/JS widgets and clean TypeScript, Python, and Rust code.',
    filename: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
  },

  // ===========================================================================
  // BALANCED SMART 3B – 4B MODELS (2.0 GB – 2.4 GB — Smart & Fast on 8 GB Macs)
  // ===========================================================================
  {
    id: 'qwen-2.5-3b-q4',
    name: 'Qwen 2.5 3B Instruct',
    kind: 'text',
    tier: 'compact',
    badge: 'Best 2 GB Smart Brain • 2.1 GB',
    badgeTone: 'success',
    sizeLabel: '2.1 GB',
    sizeMb: 2150,
    minRamGb: 6,
    ramEstimate: '~2.4 GB RAM',
    metalSpeed: '~60 tok/s (Metal)',
    cpuSpeed: '~15 tok/s (CPU)',
    recommendedFor: ['nano', 'compact', 'pro'],
    idealFor: 'Smart everyday agent — accurate web synthesis, comparison tables, coding & emails',
    description:
      'The sweet spot of smart reasoning and low memory. Outperforms older 7B models on instruction adherence and tool synthesis in just 2.1 GB.',
    filename: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    downloadUrl:
      'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
  },
  {
    id: 'llama-3.2-3b-q4',
    name: 'Llama 3.2 3B Instruct',
    kind: 'text',
    tier: 'compact',
    badge: 'Best 2 GB Companion • 2.0 GB',
    badgeTone: 'success',
    sizeLabel: '2.0 GB',
    sizeMb: 2048,
    minRamGb: 6,
    ramEstimate: '~2.2 GB RAM',
    metalSpeed: '~64 tok/s (Metal)',
    cpuSpeed: '~16 tok/s (CPU)',
    recommendedFor: ['nano', 'compact', 'pro'],
    idealFor: 'Natural conversation, structured breakdowns, brainstorming & multi-turn memory',
    description:
      'Meta’s 3B daily driver. Combines warm, human-like conversational intelligence with reliable formatting for tables, lists, and drafts.',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'phi-3.5-mini-q4',
    name: 'Phi-3.5 Mini 3.8B Instruct',
    kind: 'text',
    tier: 'compact',
    badge: 'High-IQ Reasoning • 2.39 GB',
    badgeTone: 'accent',
    sizeLabel: '2.39 GB',
    sizeMb: 2445,
    minRamGb: 6,
    ramEstimate: '~2.7 GB RAM',
    metalSpeed: '~54 tok/s (Metal)',
    cpuSpeed: '~14 tok/s (CPU)',
    recommendedFor: ['compact', 'pro'],
    idealFor: 'Logical analysis, structured reasoning, summarization & technical explanations',
    description:
      'Microsoft Research’s dense 3.8B reasoning model. Delivers near-7B analytical depth and critical thinking in a compact 2.4 GB footprint.',
    filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
  },

  // ===========================================================================
  // COMPACT ENTRY SMART MODELS (1.0 GB – 1.6 GB — Minimum Practical Floor)
  // ===========================================================================
  {
    id: 'gemma-2-2b-q4',
    name: 'Gemma 2 2B Instruct',
    kind: 'text',
    tier: 'nano',
    badge: 'Best Compact Writer • 1.6 GB',
    badgeTone: 'success',
    sizeLabel: '1.6 GB',
    sizeMb: 1638,
    minRamGb: 4,
    ramEstimate: '~1.8 GB RAM',
    metalSpeed: '~72 tok/s (Metal)',
    cpuSpeed: '~18 tok/s (CPU)',
    recommendedFor: ['nano', 'compact'],
    idealFor: 'Articulate explanations, clean emails, pros/cons tables & zero-fluff answers',
    description:
      'Google DeepMind’s 2B model distilled from 27B. Much smarter and more coherent than 0.5B/1B models while staying light on RAM.',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
  },
  {
    id: 'qwen-2.5-1.5b-q4',
    name: 'Qwen 2.5 1.5B Instruct',
    kind: 'text',
    tier: 'nano',
    badge: 'Lightest Practical • 1.04 GB',
    badgeTone: 'neutral',
    sizeLabel: '1.04 GB',
    sizeMb: 1065,
    minRamGb: 4,
    ramEstimate: '~1.3 GB RAM',
    metalSpeed: '~92 tok/s (Metal)',
    cpuSpeed: '~26 tok/s (CPU)',
    recommendedFor: ['nano'],
    idealFor: 'Fast tool-assisted answers & lightweight daily tasks on 4–8 GB machines',
    description:
      'The smallest practical model we recommend. Works best when paired with Second Brain’s live Web Search, TMDB, and Memory tools.',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    downloadUrl:
      'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
  },

  // ===========================================================================
  // HIGH-CLARITY LOCAL IMAGE GENERATION MODELS (GGUF for Apple Silicon Metal)
  // ===========================================================================
  {
    id: 'lcm-dreamshaper-v7',
    name: 'LCM DreamShaper v7 (FP16 Studio GGUF)',
    kind: 'image',
    tier: 'pro',
    badge: '★ Ultra-Clear FP16 • 2.13 GB',
    badgeTone: 'success',
    sizeLabel: '2.13 GB',
    sizeMb: 2180,
    minRamGb: 6,
    ramEstimate: '~2.3 GB RAM',
    metalSpeed: '~6s (8 steps)',
    cpuSpeed: '~45s (8 steps)',
    recommendedFor: ['compact', 'pro'],
    idealFor: 'Maximum lighting, sharp details & studio-grade color fidelity',
    description:
      'Unquantized 16-bit precision GGUF of DreamShaper v7. Takes a few extra seconds to render crisp, noise-free cinematic artwork.',
    filename: 'LCM_Dreamshaper_v7_f16.gguf',
    downloadUrl:
      'https://huggingface.co/day0market/LCM_Dreamshaper_v7-gguf/resolve/main/LCM_Dreamshaper_v7_f16.gguf',
  },
  {
    id: 'sd-turbo-q8-gguf',
    name: 'SD-Turbo (Q8_0 High-Clarity GGUF)',
    kind: 'image',
    tier: 'compact',
    badge: 'Sharp Q8 Precision • 1.88 GB',
    badgeTone: 'success',
    sizeLabel: '1.88 GB',
    sizeMb: 1930,
    minRamGb: 6,
    ramEstimate: '~2.0 GB RAM',
    metalSpeed: '~4s (6 steps)',
    cpuSpeed: '~32s (6 steps)',
    recommendedFor: ['compact', 'pro'],
    idealFor: 'High-contrast photorealism & sharp subject rendering from Stability AI',
    description:
      '8-bit near-lossless GGUF of Stability AI’s SD-Turbo for clean edges, vibrant lighting, and reliable prompt adherence.',
    filename: 'sd_turbo-f16-q8_0.gguf',
    downloadUrl:
      'https://huggingface.co/Green-Sky/SD-Turbo-GGUF/resolve/main/sd_turbo-f16-q8_0.gguf',
  },
  {
    id: 'dreamshaper-7-lcm-q4',
    name: 'LCM DreamShaper v7 (Q4_0 GGUF)',
    kind: 'image',
    tier: 'compact',
    badge: 'Balanced Art • 1.51 GB',
    badgeTone: 'accent',
    sizeLabel: '1.51 GB',
    sizeMb: 1550,
    minRamGb: 4,
    ramEstimate: '~1.7 GB RAM',
    metalSpeed: '~5s (8 steps)',
    cpuSpeed: '~35s (8 steps)',
    recommendedFor: ['nano', 'compact', 'pro'],
    idealFor: 'Concept art, portraits, cyberpunk scenes & stylized illustrations',
    description:
      'Clean GGUF build of DreamShaper v7 tuned for 8-step multi-pass denoising on Apple Silicon Metal.',
    filename: 'dreamshaper-7-lcm-q4_0.gguf',
    downloadUrl:
      'https://huggingface.co/darkmaniac7/TokForge-DreamShaper-LCM-GGUF-q4/resolve/main/dreamshaper-7-lcm-q4_0.gguf',
  },
  {
    id: 'dreamshaper-8-lcm-iq4',
    name: 'DreamShaper 8 LCM (Compact GGUF)',
    kind: 'image',
    tier: 'nano',
    badge: 'Lightweight Art • 1.46 GB',
    badgeTone: 'neutral',
    sizeLabel: '1.46 GB',
    sizeMb: 1498,
    minRamGb: 4,
    ramEstimate: '~1.6 GB RAM',
    metalSpeed: '~5s (8 steps)',
    cpuSpeed: '~35s (8 steps)',
    recommendedFor: ['nano', 'compact'],
    idealFor: 'Low-memory 512×512 artwork on 8 GB Macs',
    description:
      'Importance-matrix quantized GGUF of DreamShaper 8 LCM for machines with tighter unified memory.',
    filename: 'dreamshaper_8LCM-iq4_nl.gguf',
    downloadUrl:
      'https://huggingface.co/stduhpf/dreamshaper-8LCM-im-GGUF-sdcpp/resolve/main/dreamshaper_8LCM-iq4_nl.gguf',
  },
]
