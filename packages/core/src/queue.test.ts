import { describe, it, expect } from 'vitest'
import type { JobPayload, JobResult } from '@botworks/types'
import { InMemoryQueue } from './queue.js'

const payload = (botId: string): JobPayload => ({
  botId,
  companyId: 'test-tenant',
  trigger: { type: 'manual', userId: 'test' },
  input: {},
})

const completed = (botId: string): JobResult => ({
  jobId: '',
  botId,
  status: 'completed',
  output: { botId },
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
})

const failed = (botId: string, error: string): JobResult => ({
  jobId: '',
  botId,
  status: 'failed',
  error,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
})

/** Polls `getResult` until the job has finished; fails the test after ~1s. */
async function waitForResult(queue: InMemoryQueue, jobId: string): Promise<JobResult> {
  for (let i = 0; i < 500; i++) {
    const result = await queue.getResult(jobId)
    if (result && 'jobId' in result) return result
    await new Promise((r) => setTimeout(r, 2))
  }
  throw new Error(`Job ${jobId} did not finish in time`)
}

describe('InMemoryQueue', () => {
  it('runs a job to completion and returns its JobResult', async () => {
    const queue = new InMemoryQueue('test', 5)
    queue.startWorker(async (p) => completed(p.botId), 1)

    const jobId = await queue.add(payload('bot-a'))
    const result = await waitForResult(queue, jobId)

    expect(result.status).toBe('completed')
    expect(result.botId).toBe('bot-a')
    expect(result.output).toEqual({ botId: 'bot-a' })
    await queue.close()
  })

  it('runs a critical job before earlier low-priority jobs when concurrency is 1', async () => {
    const queue = new InMemoryQueue('test', 5)
    const order: string[] = []

    // Enqueue before the worker starts so nothing runs until ordering is fixed.
    const low1 = await queue.add(payload('low-1'), 'low')
    const low2 = await queue.add(payload('low-2'), 'low')
    const critical = await queue.add(payload('critical'), 'critical')

    queue.startWorker(async (p) => {
      order.push(p.botId)
      return completed(p.botId)
    }, 1)

    await Promise.all([low1, low2, critical].map((id) => waitForResult(queue, id)))

    expect(order).toEqual(['critical', 'low-1', 'low-2'])
    await queue.close()
  })

  it('retries a failed job with backoff and ends up completed', async () => {
    const queue = new InMemoryQueue('test', 5)
    let attempts = 0

    queue.startWorker(async (p) => {
      attempts++
      return attempts < 3 ? failed(p.botId, `attempt ${attempts} failed`) : completed(p.botId)
    }, 1)

    const jobId = await queue.add(payload('flaky'))
    const result = await waitForResult(queue, jobId)

    expect(attempts).toBe(3)
    expect(result.status).toBe('completed')
    await queue.close()
  })

  it('gives up after three failed attempts', async () => {
    const queue = new InMemoryQueue('test', 5)
    let attempts = 0

    queue.startWorker(async (p) => {
      attempts++
      return failed(p.botId, 'always fails')
    }, 1)

    const jobId = await queue.add(payload('broken'))
    const result = await waitForResult(queue, jobId)

    expect(attempts).toBe(3)
    expect(result.status).toBe('failed')
    expect(result.error).toBe('always fails')
    await queue.close()
  })

  it('reports queue depth as pending plus running jobs', async () => {
    const queue = new InMemoryQueue('test', 5)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const ids = [await queue.add(payload('a')), await queue.add(payload('b')), await queue.add(payload('c'))]
    expect(await queue.getQueueDepth()).toBe(3)

    // Concurrency 1: one job blocks on the gate, the other two stay pending.
    queue.startWorker(async (p) => {
      await gate
      return completed(p.botId)
    }, 1)
    expect(await queue.getQueueDepth()).toBe(3)

    release()
    await Promise.all(ids.map((id) => waitForResult(queue, id)))
    expect(await queue.getQueueDepth()).toBe(0)
    await queue.close()
  })

  it('returns null for unknown job ids', async () => {
    const queue = new InMemoryQueue('test', 5)
    expect(await queue.getResult('does-not-exist')).toBeNull()
  })
})
