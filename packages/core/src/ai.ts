import Anthropic from '@anthropic-ai/sdk'
import { createLogger } from './logger.js'

const log = createLogger('ai')

/**
 * Mock mode is the default: no API key, no network. Every bot ships its own
 * deterministic offline answer (`mock`), which still runs through the bot's
 * real response parser. Set BOTWORKS_MOCK=false plus ANTHROPIC_API_KEY to use
 * the live model.
 */
export function isMockMode(): boolean {
  return process.env.BOTWORKS_MOCK !== 'false'
}

let client: Anthropic | null = null

export function getAIClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    client = new Anthropic({ apiKey })
    log('info', 'Anthropic client initialized')
  }
  return client
}

export interface AICompletionOptions {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
  model?: string
  /** Offline answer used in mock mode. */
  mock?: () => string
}

export async function aiComplete(options: AICompletionOptions): Promise<string> {
  if (isMockMode()) {
    log('debug', 'AI request (mock)', { messageCount: options.messages.length })
    return options.mock?.() ?? '[mock] No offline answer defined for this prompt.'
  }

  const ai = getAIClient()
  const model = options.model ?? 'claude-sonnet-4-20250514'

  log('debug', 'AI request', { model, messageCount: options.messages.length })

  const response = await ai.messages.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.2,
    system: options.system,
    messages: options.messages,
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  log('debug', 'AI response', {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  })

  return text
}

export interface AIJsonOptions<T> extends Omit<AICompletionOptions, 'mock'> {
  schema: string // description of expected JSON shape for the system prompt
  parse: (raw: string) => T
  /** Offline result used in mock mode. It is serialized and sent through `parse`, so it must satisfy the same schema as a live answer. */
  mock?: () => unknown
}

export async function aiJson<T>(options: AIJsonOptions<T>): Promise<T> {
  if (isMockMode()) {
    if (!options.mock) throw new Error('Mock mode is on, but this AI call defines no offline result')
    log('debug', 'AI JSON request (mock)')
    return options.parse(JSON.stringify(options.mock()))
  }

  const systemPrompt = [
    options.system ?? '',
    '',
    'IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, no code fences.',
    `Expected JSON structure: ${options.schema}`,
  ].join('\n')

  const raw = await aiComplete({
    system: systemPrompt,
    messages: options.messages,
    maxTokens: options.maxTokens,
    model: options.model,
    temperature: options.temperature ?? 0.1,
  })

  // Strip potential markdown code fences
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim()

  try {
    return options.parse(cleaned)
  } catch (err) {
    log('error', 'Failed to parse AI JSON response', { raw: cleaned.slice(0, 500) })
    throw new Error(`AI returned invalid JSON: ${(err as Error).message}`)
  }
}
