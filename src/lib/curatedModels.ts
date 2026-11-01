export interface CuratedModel {
  id: string
  name: string
  kind: 'text' | 'image'
  badge: string
  badgeTone: 'success' | 'accent' | 'neutral'
  sizeLabel: string
  description: string
  filename: string
  downloadUrl: string
  idealFor: string
  ramEstimate: string
}

export const CURATED_MODELS: CuratedModel[] = [
  // --- Text Models (Lightweight, High IQ, Great for Daily Banter & Timepass) ---
  {
    id: 'qwen-2.5-3b-q4',
    name: 'Qwen 2.5 3B Instruct',
    kind: 'text',
    badge: 'Smartest Mini Brain',
    badgeTone: 'success',
    sizeLabel: '2.1 GB',
    ramEstimate: '~2.3 GB RAM',
    idealFor: 'Exceptional IQ, witty banter, deep conversation, never feels dumb or repetitive',
    description: 'Arguably the smartest sub-4B model available. Outperforms older 7B models in logic, humor, everyday chat, and reasoning while staying silky smooth on CPU.',
    filename: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    downloadUrl:
      'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
  },
  {
    id: 'llama-3.2-3b-q4',
    name: 'Llama 3.2 3B Instruct',
    kind: 'text',
    badge: 'Chill Companion',
    badgeTone: 'success',
    sizeLabel: '2.0 GB',
    ramEstimate: '~2.2 GB RAM',
    idealFor: 'Friendly daily chatter, creative ideas, natural tone, cool & silent on CPU/M4',
    description: 'Meta’s conversational star. Speaks like a thoughtful, engaging friend rather than a dry robot. Perfect for relaxing and timepass without slowing down your computer.',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  },
  {
    id: 'hermes-3-3b-q4',
    name: 'Hermes 3 Llama 3.2 3B',
    kind: 'text',
    badge: 'Fun Persona & Banter',
    badgeTone: 'accent',
    sizeLabel: '2.0 GB',
    ramEstimate: '~2.2 GB RAM',
    idealFor: 'Playful humor, creative storytelling, open casual hangout, zero robotic filters',
    description: 'Nous Research’s companion model. Fine-tuned for vibrant personality, sharp humor, and lifelike interaction. Great for unwinding after a long day.',
    filename: 'Hermes-3-Llama-3.2-3B.Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/NousResearch/Hermes-3-Llama-3.2-3B-GGUF/resolve/main/Hermes-3-Llama-3.2-3B.Q4_K_M.gguf',
  },
  {
    id: 'gemma-2-2b-q4',
    name: 'Gemma 2 2B Instruct',
    kind: 'text',
    badge: 'Poetic & Natural',
    badgeTone: 'neutral',
    sizeLabel: '1.6 GB',
    ramEstimate: '~1.8 GB RAM',
    idealFor: 'Eloquent thoughts, casual advice, ultra-light on battery & older CPUs',
    description: 'Google DeepMind’s compact powerhouse. Remarkable expressive language and nuanced dialogue with tiny resource overhead.',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    downloadUrl:
      'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
  },

  // --- Image Models ---
  {
    id: 'sd-turbo-fp16',
    name: 'SD-Turbo (Real-Time)',
    kind: 'image',
    badge: 'Recommended for CPU',
    badgeTone: 'success',
    sizeLabel: '2.1 GB',
    ramEstimate: '~2.5 GB RAM',
    idealFor: 'Generates in 1–4 steps! Blazingly fast, zero system freeze',
    description: 'Stability AI’s distilled model. Unlike standard diffusion that takes 30 steps, this finishes in seconds on CPU.',
    filename: 'sd_turbo.safetensors',
    downloadUrl:
      'https://huggingface.co/stabilityai/sd-turbo/resolve/main/sd_turbo.safetensors',
  },
  {
    id: 'lcm-dreamshaper-v7',
    name: 'LCM DreamShaper v7',
    kind: 'image',
    badge: 'Fast LCM (4 Steps)',
    badgeTone: 'success',
    sizeLabel: '2.1 GB',
    ramEstimate: '~2.6 GB RAM',
    idealFor: 'Artistic consistency in 4–8 steps, smooth CPU & Apple Silicon M4',
    description: 'Latent Consistency Model (LCM) version of DreamShaper v7. Designed for ultra-rapid local inference in just 4 steps.',
    filename: 'LCM_Dreamshaper_v7-f16.gguf',
    downloadUrl:
      'https://huggingface.co/Steward/lcm-dreamshaper-v7-gguf/resolve/main/LCM_Dreamshaper_v7-f16.gguf',
  },
  {
    id: 'dreamshaper-8',
    name: 'DreamShaper 8 (Art & Portraits)',
    kind: 'image',
    badge: 'Artistic Standard',
    badgeTone: 'accent',
    sizeLabel: '2.0 GB',
    ramEstimate: '~2.8 GB RAM',
    idealFor: 'Vibrant digital art, fantasy, portraits, and anime styles',
    description: 'The community favorite SD 1.5 checkpoint. Incredible artistic styling and photorealism.',
    filename: 'DreamShaper_8_pruned.safetensors',
    downloadUrl:
      'https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8_pruned.safetensors',
  },
]
