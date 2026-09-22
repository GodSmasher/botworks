import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { aiComplete, aiJson, isMockMode } from './ai.js'

// Mock mode is the default whenever BOTWORKS_MOCK is not 'false'. These tests
// never set it to 'false', so no network call can happen.
const originalMockFlag = process.env.BOTWORKS_MOCK

beforeEach(() => {
  delete process.env.BOTWORKS_MOCK
})

afterEach(() => {
  if (originalMockFlag === undefined) delete process.env.BOTWORKS_MOCK
  else process.env.BOTWORKS_MOCK = originalMockFlag
})

const messages = [{ role: 'user' as const, content: 'Classify this.' }]

describe('isMockMode', () => {
  it('is on by default', () => {
    expect(isMockMode()).toBe(true)
  })
})

describe('aiComplete (mock mode)', () => {
  it('returns the offline answer from mock()', async () => {
    const text = await aiComplete({ messages, mock: () => 'offline answer' })
    expect(text).toBe('offline answer')
  })

  it('returns a placeholder when no mock is defined', async () => {
    const text = await aiComplete({ messages })
    expect(text).toMatch(/\[mock\]/)
  })
})

describe('aiJson (mock mode)', () => {
  const schema = z.object({
    category: z.enum(['invoice', 'spam']),
    confidence: z.number().min(0).max(1),
  })
  const parse = (raw: string) => schema.parse(JSON.parse(raw))

  it('runs the mock result through parse and returns the parsed value', async () => {
    const result = await aiJson({
      schema: '{ category, confidence }',
      messages,
      parse,
      mock: () => ({ category: 'invoice', confidence: 0.9, extra: 'stripped by zod' }),
    })
    expect(result).toEqual({ category: 'invoice', confidence: 0.9 })
  })

  it('rejects when the mock result violates the schema', async () => {
    await expect(
      aiJson({
        schema: '{ category, confidence }',
        messages,
        parse,
        mock: () => ({ category: 'unknown', confidence: 2 }),
      }),
    ).rejects.toThrow(z.ZodError)
  })

  it('rejects with a clear error when no mock is defined', async () => {
    await expect(aiJson({ schema: '{}', messages, parse })).rejects.toThrow(/no offline result/)
  })
})
