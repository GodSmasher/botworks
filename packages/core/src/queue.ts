import { Queue, Worker, type Job } from 'bullmq'
import type IORedis from 'ioredis'
import type { JobPayload, JobResult, JobPriority } from '@botworks/types'
import { createLogger } from './logger.js'

const log = createLogger('queue')

const PRIORITY_MAP: Record<JobPriority, number> = {
  critical: 1,
  high: 2,
  normal: 3,
  low: 4,
}

export type JobHandler = (payload: JobPayload) => Promise<JobResult>

/** What the API needs from a queue — implemented by BullMQ (Redis) and by the in-memory fallback. */
export interface JobQueue {
  add(payload: JobPayload, priority?: JobPriority): Promise<string>
  startWorker(handler: JobHandler, concurrency?: number): void
  getQueueDepth(): Promise<number>
  getResult(jobId: string): Promise<JobResult | { status: 'queued' | 'running' } | null>
  close(): Promise<void>
}

export class BotQueue implements JobQueue {
  private queue: Queue
  private worker: Worker | null = null

  constructor(
    private readonly queueName: string,
    private readonly connection: IORedis,
  ) {
    this.queue = new Queue(queueName, { connection: this.connection as never })
  }

  async add(payload: JobPayload, priority: JobPriority = 'normal'): Promise<string> {
    const job = await this.queue.add(payload.botId, payload, {
      priority: PRIORITY_MAP[priority],
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    })
    log('info', `Job enqueued: ${job.id}`, { botId: payload.botId, companyId: payload.companyId })
    return job.id!
  }

  startWorker(handler: JobHandler, concurrency = 3): void {
    this.worker = new Worker(
      this.queueName,
      async (job: Job<JobPayload>) => {
        log('info', `Processing job ${job.id}`, { botId: job.data.botId })
        const result = await handler(job.data)
        if (result.status === 'failed') {
          throw new Error(result.error ?? 'Bot execution failed')
        }
        return result
      },
      {
        connection: this.connection as never,
        concurrency,
      },
    )

    this.worker.on('completed', (job) => {
      log('info', `Job completed: ${job.id}`, { botId: job.data.botId })
    })

    this.worker.on('failed', (job, err) => {
      log('error', `Job failed: ${job?.id}`, { error: err.message, botId: job?.data.botId })
    })

    log('info', `Worker started for queue "${this.queueName}" (concurrency: ${concurrency})`)
  }

  async getQueueDepth(): Promise<number> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed')
    return counts.waiting + counts.active + counts.delayed
  }

  async getResult(jobId: string): Promise<JobResult | { status: 'queued' | 'running' } | null> {
    const job = await this.queue.getJob(jobId)
    if (!job) return null
    const state = await job.getState()
    if (state === 'completed') return job.returnvalue as JobResult
    if (state === 'failed') {
      return { jobId, botId: job.data.botId, status: 'failed', error: job.failedReason, startedAt: '', completedAt: '' } as JobResult
    }
    return { status: state === 'active' ? 'running' : 'queued' }
  }

  async close(): Promise<void> {
    await this.worker?.close()
    await this.queue.close()
  }
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

interface MemoryJob {
  id: string
  payload: JobPayload
  priority: number
  attempts: number
  state: 'queued' | 'running' | 'done'
  result?: JobResult
}

/**
 * Same contract as BotQueue, without Redis: priority ordering, bounded
 * concurrency, three attempts with exponential backoff. Used when no
 * REDIS_URL is configured, so the API and the demo run with zero infrastructure.
 * Jobs live in process memory only — do not use it for production workloads.
 */
export class InMemoryQueue implements JobQueue {
  private jobs = new Map<string, MemoryJob>()
  private pending: MemoryJob[] = []
  private handler: JobHandler | null = null
  private concurrency = 3
  private running = 0
  private seq = 0

  constructor(private readonly queueName: string, private readonly backoffMs = 2000) {}

  async add(payload: JobPayload, priority: JobPriority = 'normal'): Promise<string> {
    const job: MemoryJob = { id: `mem-${++this.seq}`, payload, priority: PRIORITY_MAP[priority], attempts: 0, state: 'queued' }
    this.jobs.set(job.id, job)
    this.pending.push(job)
    this.pending.sort((a, b) => a.priority - b.priority)
    log('info', `Job enqueued: ${job.id}`, { botId: payload.botId, companyId: payload.companyId })
    this.drain()
    return job.id
  }

  startWorker(handler: JobHandler, concurrency = 3): void {
    this.handler = handler
    this.concurrency = concurrency
    log('info', `In-memory worker started for queue "${this.queueName}" (concurrency: ${concurrency})`)
    this.drain()
  }

  private drain(): void {
    while (this.handler && this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!
      this.running++
      job.state = 'running'
      void this.process(job).finally(() => {
        this.running--
        this.drain()
      })
    }
  }

  private async process(job: MemoryJob): Promise<void> {
    job.attempts++
    let result: JobResult
    try {
      result = await this.handler!(job.payload)
    } catch (err) {
      result = {
        jobId: job.id,
        botId: job.payload.botId,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }
    }

    if (result.status === 'failed' && job.attempts < 3) {
      const delay = this.backoffMs * 2 ** (job.attempts - 1)
      log('warn', `Job ${job.id} failed (attempt ${job.attempts}/3), retrying in ${delay}ms`, { error: result.error })
      job.state = 'queued'
      setTimeout(() => {
        this.pending.push(job)
        this.pending.sort((a, b) => a.priority - b.priority)
        this.drain()
      }, delay)
      return
    }

    job.state = 'done'
    job.result = result
    log(result.status === 'failed' ? 'error' : 'info', `Job ${result.status}: ${job.id}`, { botId: job.payload.botId })
  }

  async getQueueDepth(): Promise<number> {
    return this.pending.length + this.running
  }

  async getResult(jobId: string): Promise<JobResult | { status: 'queued' | 'running' } | null> {
    const job = this.jobs.get(jobId)
    if (!job) return null
    if (job.state === 'done' && job.result) return job.result
    return { status: job.state === 'running' ? 'running' : 'queued' }
  }

  async close(): Promise<void> {
    this.handler = null
    this.pending = []
  }
}

/** Redis-backed queue when REDIS_URL is set, in-memory otherwise. */
export async function createQueue(queueName: string): Promise<JobQueue> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    log('info', 'REDIS_URL not set — using the in-memory queue')
    return new InMemoryQueue(queueName)
  }
  const { default: IORedisClient } = await import('ioredis')
  return new BotQueue(queueName, new IORedisClient(redisUrl, { maxRetriesPerRequest: null }))
}
