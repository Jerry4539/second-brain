import { generateText } from './textEngine'

export interface SynthesizedImagePrompt {
  visualPrompt: string
  aiConcept: string
  usedLLM: boolean
}

interface SynthesizeParams {
  rawPrompt: string
  history: { role: string; content: string }[]
  userName?: string
  botName?: string
  isTextEngineRunning: boolean
}

/**
 * Strips conversational filler and meta phrases like:
 * "can you create an image based on what you know about me and my situation"
 */

function cleanMetaQuery(input: string): string {
  let cleaned = input.trim()
  // Remove leading commands or polite prefixes
  cleaned = cleaned.replace(/^\/image\s+/i, '')
  cleaned = cleaned.replace(/^(?:please\s+)?(?:can you\s+)?(?:could you\s+)?(?:i want (?:you )?to\s+)?(?:generate|create|draw|paint|visualize|make)\s+(?:an?\s+)?(?:image|picture|artwork|illustration|drawing)\s+(?:of\s+|based on\s+|for\s+)?/i, '')
  return cleaned.trim()
}

/**
 * Synthesizes a rich, context-aware visual image prompt from chat history and user request.
 * If the local text model is running, it uses the LLM to analyze the conversation and user situation.
 * Otherwise, it uses a rich contextual heuristic analyzer.
 */
export async function synthesizeImagePrompt({
  rawPrompt,
  history,
  userName = 'User',
  botName = 'Second Brain',
  isTextEngineRunning,
}: SynthesizeParams): Promise<SynthesizedImagePrompt> {
  const cleanInput = cleanMetaQuery(rawPrompt)

  // Try LLM synthesis first if the local text engine is active
  if (isTextEngineRunning) {
    try {
      const llmResult = await synthesizeWithLLM({ rawPrompt, history, userName, botName })
      if (llmResult && llmResult.visualPrompt.length > 5) {
        return {
          visualPrompt: llmResult.visualPrompt,
          aiConcept: llmResult.aiConcept,
          usedLLM: true,
        }
      }
    } catch (err) {
      console.warn('LLM prompt synthesis fallback to heuristic:', err)
    }
  }

  // Heuristic context synthesizer
  return synthesizeWithHeuristics({ cleanInput, rawPrompt, history, userName })
}

/**
 * Ask the active local LLM to comprehend the user's intent, past chat history, and situation.
 */
async function synthesizeWithLLM({
  rawPrompt,
  history,
  userName,
  botName,
}: {
  rawPrompt: string
  history: { role: string; content: string }[]
  userName: string
  botName: string
}): Promise<{ visualPrompt: string; aiConcept: string }> {
  const recentHistory = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? userName : botName}: ${m.content.slice(0, 300)}`)
    .join('\n')

  const systemInstruction = `You are an expert visual art director and prompt engineer for Stable Diffusion image generation.
The user wants to generate an image. Analyze their request and the chat history to understand what they truly mean and their situation.

Recent Chat History:
${recentHistory || '(No previous messages, user just started session)'}

User Request: "${rawPrompt}"

Rules:
1. Translate the user's request and context into a vivid, descriptive visual prompt (subjects, setting, artistic style, lighting, camera angle, atmosphere, high resolution details).
2. If the user asks based on what you know about them or their situation, derive creative visual metaphors from the conversation history.
3. Formulate your response strictly in two lines:
CONCEPT: <One concise sentence explaining your artistic thought and interpretation of the user's request and situation>
PROMPT: <The detailed visual image prompt for the image generator, without quotes>
`

  return new Promise((resolve, reject) => {
    let collectedOutput = ''
    const timer = setTimeout(() => {
      resolve(fallbackParse(collectedOutput, rawPrompt))
    }, 7000)

    generateText({
      prompt: systemInstruction,
      settings: {
        temperature: 0.7,
        max_tokens: 160,
      },
      onToken: (token) => {
        collectedOutput += token
      },
      onDone: () => {
        clearTimeout(timer)
        resolve(fallbackParse(collectedOutput, rawPrompt))
      },
      onError: (err) => {
        clearTimeout(timer)
        reject(new Error(err))
      },
    }).catch(reject)
  })
}

function fallbackParse(output: string, rawPrompt: string): { visualPrompt: string; aiConcept: string } {
  let concept = ''
  let prompt = ''

  const conceptMatch = output.match(/CONCEPT:\s*([^\n\r]+)/i)
  if (conceptMatch) {
    concept = conceptMatch[1].trim()
  }

  const promptMatch = output.match(/PROMPT:\s*([\s\S]+)/i)
  if (promptMatch) {
    prompt = promptMatch[1].trim()
  }

  // If format wasn't strictly followed, parse lines
  if (!prompt && output.trim()) {
    const lines = output.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length > 1) {
      concept = lines[0].replace(/^CONCEPT:?\s*/i, '')
      prompt = lines.slice(1).join(' ').replace(/^PROMPT:?\s*/i, '')
    } else {
      prompt = lines[0].replace(/^(?:PROMPT|CONCEPT):?\s*/i, '')
    }
  }

  // Sanitize prompt (remove markdown bold/quotes)
  prompt = prompt.replace(/^["'`*]+|["'`*]+$/g, '').trim()

  if (!prompt) {
    return {
      aiConcept: 'Conceptualized from your conversation and situation.',
      visualPrompt: `${rawPrompt}, highly detailed digital art, cinematic lighting, vibrant atmosphere, 8k masterpiece`,
    }
  }

  return {
    aiConcept: concept || 'Formulated a personalized visual concept based on your thoughts and history.',
    visualPrompt: prompt,
  }
}

/**
 * Intelligent heuristic synthesis when LLM is offline or for instant responsiveness.
 */
function synthesizeWithHeuristics({
  cleanInput,
  rawPrompt,
  history,
  userName,
}: {
  cleanInput: string
  rawPrompt: string
  history: { role: string; content: string }[]
  userName: string
}): SynthesizedImagePrompt {
  const isPersonalContextRequest =
    /know about me|my situation|my life|who i am|about myself|based on me|our conversation|what we talked about|what we discussed/i.test(
      rawPrompt
    )

  // Extract keywords and context from past conversation history
  const allHistoryText = history.map((m) => m.content).join(' ').toLowerCase()

  let theme = 'digital workspace, visionary builder, technological innovation'
  let contextConcept = `Synthesized a personalized portrait of ${userName}'s creative mind and current environment.`

  if (allHistoryText.includes('code') || allHistoryText.includes('software') || allHistoryText.includes('developer') || allHistoryText.includes('app')) {
    theme = 'modern developer sanctuary, glowing holographic code matrices, mechanical keyboards, multi-monitor station'
    contextConcept = 'Interpreted from your journey as a focused software creator building the future.'
  } else if (allHistoryText.includes('game') || allHistoryText.includes('gaming') || allHistoryText.includes('race') || allHistoryText.includes('snake')) {
    theme = 'cyberpunk retro-futuristic arcade lounge, neon glow, holographic game boards, synthwave aesthetic'
    contextConcept = 'Derived from your playful and strategic game exploration in Second Brain.'
  } else if (allHistoryText.includes('study') || allHistoryText.includes('learn') || allHistoryText.includes('reading') || allHistoryText.includes('book')) {
    theme = 'serene futuristic library with warm amber lantern glow, floating digital scrolls, cozy armchair, autumn rain outside glass window'
    contextConcept = 'Crafted from your thoughtful pursuit of knowledge, reading, and deep learning.'
  } else if (allHistoryText.includes('stress') || allHistoryText.includes('tired') || allHistoryText.includes('relax') || allHistoryText.includes('calm')) {
    theme = 'tranquil Japanese zen garden at twilight, glowing cherry blossom trees, serene reflection pool with koi fish, soft warm lantern light'
    contextConcept = 'Conceived as a peaceful sanctuary for mindfulness, calm, and rest.'
  }

  if (isPersonalContextRequest || cleanInput.length < 5) {
    return {
      aiConcept: contextConcept,
      visualPrompt: `A cinematic masterpiece depicting ${theme}, warm volumetric lighting, intimate atmosphere, hyper-detailed 8k resolution, elegant digital art style`,
      usedLLM: false,
    }
  }

  // User provided a subject or thought — enhance it into a stunning visual prompt
  return {
    aiConcept: `Enriched "${cleanInput}" into a cinematic visual scene with atmospheric depth and lighting.`,
    visualPrompt: `${cleanInput}, beautifully rendered, cinematic composition, volumetric lighting, rich color palette, sharp focus, 8k resolution, trending on ArtStation`,
    usedLLM: false,
  }
}
