import { describe, it, expect, afterEach } from 'vitest'
import { sampleInput as inboxTriageSample } from '@botworks/inbox-triage'
import { sampleInput as taxPrepSample } from '@botworks/tax-prep'
import { app } from './app.js'

// The Hono app is driven in-process through `app.request()`; no port is opened.

interface ApiBody<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const originalSecret = process.env.API_SECRET

afterEach(() => {
  if (originalSecret === undefined) delete process.env.API_SECRET
  else process.env.API_SECRET = originalSecret
})

describe('GET /health', () => {
  it('reports ok with all 13 bots registered', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; bots: number }
    expect(body.status).toBe('ok')
    expect(body.bots).toBe(13)
  })
})

describe('GET /api/bots', () => {
  it('lists 13 manifests', async () => {
    const res = await app.request('/api/bots')
    expect(res.status).toBe(200)
    const body = (await res.json()) as ApiBody<Array<{ id: string; tier: string }>>
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(13)
    expect(body.data?.map((m) => m.id)).toContain('inbox-triage')
  })

  it('returns a single manifest', async () => {
    const res = await app.request('/api/bots/tax-prep')
    expect(res.status).toBe(200)
    const body = (await res.json()) as ApiBody<{ id: string }>
    expect(body.data?.id).toBe('tax-prep')
  })
})

describe('POST /api/bots/:botId/run', () => {
  it('runs inbox-triage synchronously and returns a JobResult', async () => {
    const res = await post('/api/bots/inbox-triage/run', { companyId: 'demo', input: inboxTriageSample })
    expect(res.status).toBe(200)
    const body = (await res.json()) as ApiBody<{ botId: string; status: string; startedAt: string }>
    expect(body.ok).toBe(true)
    expect(body.data?.botId).toBe('inbox-triage')
    expect(body.data?.status).toBe('completed')
    expect(typeof body.data?.startedAt).toBe('string')
  })

  it('runs tax-prep synchronously to completion', async () => {
    const res = await post('/api/bots/tax-prep/run', { companyId: 'demo', input: taxPrepSample })
    expect(res.status).toBe(200)
    const body = (await res.json()) as ApiBody<{ status: string; output?: { summary: { totalItems: number } } }>
    expect(body.ok).toBe(true)
    expect(body.data?.status).toBe('completed')
    expect(body.data?.output?.summary.totalItems).toBe(taxPrepSample.expenses.length)
  })

  it('rejects an invalid body with 400', async () => {
    const res = await post('/api/bots/inbox-triage/run', { input: 'not an object' })
    expect(res.status).toBe(400)
    const body = (await res.json()) as ApiBody
    expect(body.ok).toBe(false)
    expect(typeof body.error).toBe('string')
  })

  it('returns 404 for an unknown bot', async () => {
    const res = await post('/api/bots/does-not-exist/run', { companyId: 'demo', input: {} })
    expect(res.status).toBe(404)
    const body = (await res.json()) as ApiBody
    expect(body.ok).toBe(false)
  })
})

describe('API key auth', () => {
  it('rejects requests without a key when API_SECRET is set', async () => {
    process.env.API_SECRET = 'test-secret'
    const res = await app.request('/api/bots')
    expect(res.status).toBe(401)
    const body = (await res.json()) as ApiBody
    expect(body.error).toBe('Unauthorized')
  })

  it('accepts requests with the matching X-API-Key header', async () => {
    process.env.API_SECRET = 'test-secret'
    const res = await app.request('/api/bots', { headers: { 'X-API-Key': 'test-secret' } })
    expect(res.status).toBe(200)
  })

  it('leaves /health public even when API_SECRET is set', async () => {
    process.env.API_SECRET = 'test-secret'
    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })
})
