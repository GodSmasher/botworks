import { Hono } from 'hono'
import { z } from 'zod'
import { registry, createQueue, createLogger, type JobQueue } from '@botworks/core'
import type { JobPayload, TriggerBotRequest } from '@botworks/types'

const log = createLogger('routes:bots')

export const botsRouter = new Hono()

// ─── Lazy queue (Redis when configured, in-memory otherwise) ─────────────────

let queue: JobQueue | null = null

async function getQueue(): Promise<JobQueue> {
  if (!queue) {
    queue = await createQueue('botworks')

    // Start worker that routes jobs to the right bot
    queue.startWorker(async (payload: JobPayload) => {
      const bot = registry.get(payload.botId)
      if (!bot) throw new Error(`Bot "${payload.botId}" not found in registry`)
      return bot.run(payload, new Map())
    })
  }
  return queue
}

// ─── Input schema ────────────────────────────────────────────────────────────

const triggerSchema = z.object({
  botId: z.string().min(1),
  companyId: z.string().min(1),
  input: z.record(z.unknown()),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

/** List all registered bots */
botsRouter.get('/', (c) => {
  const bots = registry.list()
  return c.json({ ok: true, data: bots })
})

/** Look up a queued job — result once it has finished */
botsRouter.get('/jobs/:jobId', async (c) => {
  const result = queue ? await queue.getResult(c.req.param('jobId')) : null
  if (!result) return c.json({ ok: false, error: 'Job not found' }, 404)
  return c.json({ ok: true, data: result })
})

/** Get a single bot's manifest */
botsRouter.get('/:botId', (c) => {
  const botId = c.req.param('botId')
  const bot = registry.get(botId)
  if (!bot) return c.json({ ok: false, error: `Bot "${botId}" not found` }, 404)
  return c.json({ ok: true, data: bot.manifest })
})

/** Trigger a bot (async via queue) */
botsRouter.post('/:botId/trigger', async (c) => {
  const botId = c.req.param('botId')
  const bot = registry.get(botId)
  if (!bot) return c.json({ ok: false, error: `Bot "${botId}" not found` }, 404)

  const body = await c.req.json<TriggerBotRequest>()
  const parsed = triggerSchema.safeParse({ ...body, botId })

  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') }, 400)
  }

  const payload: JobPayload = {
    botId,
    companyId: parsed.data.companyId,
    trigger: { type: 'manual', userId: 'api' },
    input: parsed.data.input,
  }

  const jobId = await (await getQueue()).add(payload, parsed.data.priority)
  log('info', `Bot triggered: ${botId}`, { jobId, companyId: parsed.data.companyId })

  return c.json({ ok: true, data: { jobId, botId, status: 'queued' } }, 202)
})

/** Execute a bot synchronously (for testing / small jobs) */
botsRouter.post('/:botId/run', async (c) => {
  const botId = c.req.param('botId')
  const bot = registry.get(botId)
  if (!bot) return c.json({ ok: false, error: `Bot "${botId}" not found` }, 404)

  const body = await c.req.json<TriggerBotRequest>()
  const parsed = triggerSchema.safeParse({ ...body, botId })

  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') }, 400)
  }

  const payload: JobPayload = {
    botId,
    companyId: parsed.data.companyId,
    trigger: { type: 'manual', userId: 'api' },
    input: parsed.data.input,
  }

  log('info', `Bot sync run: ${botId}`, { companyId: parsed.data.companyId })
  const result = await bot.run(payload, new Map())

  return c.json({ ok: true, data: result })
})

/** Get queue depth for a bot */
botsRouter.get('/:botId/status', async (c) => {
  const botId = c.req.param('botId')
  const bot = registry.get(botId)
  if (!bot) return c.json({ ok: false, error: `Bot "${botId}" not found` }, 404)

  const depth = queue ? await queue.getQueueDepth() : 0

  return c.json({
    ok: true,
    data: {
      botId,
      status: 'idle',
      queueDepth: depth,
    },
  })
})
