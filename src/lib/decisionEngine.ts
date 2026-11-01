import { invoke } from '@tauri-apps/api/core'

export interface DecisionEngineStatus {
  available: boolean
}

export interface ChoiceOption {
  key: string
  description?: string
}

export type QuestionDef =
  | { type: 'choice'; instructions: string; criteria: ChoiceOption[] }
  | { type: 'score'; instructions: string; levels: string[] }
  | { type: 'noul'; instructions: string; trueDescription?: string; falseDescription?: string }

export interface ChoiceAnswer {
  type: 'choice'
  choice: string
  probabilities: Record<string, number>
  confidence: number
}

export interface ScoreAnswer {
  type: 'score'
  score: number
  legend: string[]
  probabilities: Record<string, number>
  confidence: number
}

export interface NoulAnswer {
  type: 'noul'
  noul: number
  confidence: number
}

export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer

export interface DecisionResult {
  model: string
  answers: Record<string, Answer>
}

export function decisionEngineStatus(): Promise<DecisionEngineStatus> {
  return invoke('decision_engine_status')
}

export function makeDecision(
  inputState: unknown,
  questions: Record<string, QuestionDef>,
): Promise<DecisionResult> {
  return invoke('make_decision', { inputState, questions })
}

/**
 * Picks one of `options` using the local Laya decision model, falling back to a
 * uniform random pick if the model isn't available — Second Brain must never
 * break when the (optional, free, offline) decision engine can't run.
 */
export async function chooseWithFallback(
  inputState: unknown,
  instructions: string,
  options: ChoiceOption[],
): Promise<{ choice: string; confidence: number; usedFallback: boolean }> {
  try {
    const status = await decisionEngineStatus()
    if (!status.available) throw new Error('decision engine unavailable')
    const result = await makeDecision(inputState, {
      pick: { type: 'choice', instructions, criteria: options },
    })
    const answer = result.answers.pick as ChoiceAnswer
    return { choice: answer.choice, confidence: answer.confidence, usedFallback: false }
  } catch {
    const choice = options[Math.floor(Math.random() * options.length)]
    return { choice: choice.key, confidence: 1 / options.length, usedFallback: true }
  }
}
