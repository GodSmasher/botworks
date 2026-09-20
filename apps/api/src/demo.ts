// Runs every bot once with its bundled sample input — through the real queue,
// worker, validation and response parsing. With no configuration this uses the
// in-memory queue and the bots' offline answers, so it needs neither Redis nor
// an API key:
//   npm run demo
import { registry, createQueue, isMockMode } from '@botworks/core'
import type { ConnectorConfig, ConnectorType, JobPayload, JobResult } from '@botworks/types'

import { sampleInput as inboxTriage } from '@botworks/inbox-triage'
import { sampleInput as documentExtract } from '@botworks/document-extract'
import { sampleInput as customerSupport } from '@botworks/customer-support'
import { sampleInput as onboarding } from '@botworks/onboarding'
import { sampleInput as followUp } from '@botworks/follow-up'
import { sampleInput as dataSync } from '@botworks/data-sync'
import { sampleInput as reportGenerator } from '@botworks/report-generator'
import { sampleInput as appointment } from '@botworks/appointment'
import { sampleInput as employeeMgmt } from '@botworks/employee-mgmt'
import { sampleInput as inventory } from '@botworks/inventory'
import { sampleInput as billing } from '@botworks/billing'
import { sampleInput as taxPrep } from '@botworks/tax-prep'
import { sampleInput as reviewAnalysis } from '@botworks/review-analysis'

const samples: Record<string, Record<string, unknown>> = {
  'inbox-triage': inboxTriage,
  'document-extract': documentExtract,
  'customer-support': customerSupport,
  onboarding,
  'follow-up': followUp,
  'data-sync': dataSync,
  'report-generator': reportGenerator,
  appointment,
  'employee-mgmt': employeeMgmt,
  inventory,
  billing,
  'tax-prep': taxPrep,
  'review-analysis': reviewAnalysis,
}

/** One-line digest of a bot result: its `summary` object if present, otherwise the top-level keys. */
function digest(output: Record<string, unknown> | undefined): string {
  if (!output) return ''
  const summary = output.summary
  const source = summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : output
  const scalars = Object.entries(source)
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
    .map(([k, v]) => `${k}=${String(v).slice(0, 32)}`)
  const lists = Object.entries(output)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${k}[${(v as unknown[]).length}]`)
  return [...scalars, ...lists].slice(0, 5).join('  ')
}

async function main(): Promise<void> {
  process.env.LOG_LEVEL ??= 'warn'
  await import('./register.js')
  console.log(`\nbotworks demo · AI: ${isMockMode() ? 'mock (offline answers)' : 'live model'} · ${registry.size} bots\n`)

  const queue = await createQueue('botworks-demo')
  // Demo tenants have every connector configured.
  const connectors = new Map<ConnectorType, ConnectorConfig>()
  for (const manifest of registry.list()) {
    for (const type of [...manifest.requiredConnectors, ...(manifest.optionalConnectors ?? [])]) {
      connectors.set(type, { type, companyId: 'demo-tenant', credentials: {}, settings: {} } as unknown as ConnectorConfig)
    }
  }

  queue.startWorker(async (payload: JobPayload) => {
    const bot = registry.get(payload.botId)
    if (!bot) throw new Error(`Bot "${payload.botId}" not found in registry`)
    return bot.run(payload, connectors)
  }, 4)

  const jobs: Array<{ botId: string; jobId: string }> = []
  for (const manifest of registry.list()) {
    const jobId = await queue.add(
      { botId: manifest.id, companyId: 'demo-tenant', trigger: { type: 'manual', userId: 'demo' }, input: samples[manifest.id] ?? {} },
      manifest.tier === 'tier1' ? 'high' : 'normal',
    )
    jobs.push({ botId: manifest.id, jobId })
  }

  let failed = 0
  for (const { botId, jobId } of jobs) {
    let result = await queue.getResult(jobId)
    while (result && !('jobId' in result)) {
      await new Promise((r) => setTimeout(r, 50))
      result = await queue.getResult(jobId)
    }
    const done = result as JobResult
    const ok = done.status === 'completed'
    if (!ok) failed++
    console.log(`${ok ? '✓' : '✗'} ${botId.padEnd(18)} ${String(done.durationMs ?? 0).padStart(4)}ms  ${ok ? digest(done.output) : done.error}`)
  }

  console.log(`\n${jobs.length - failed}/${jobs.length} bots completed\n`)
  await queue.close()
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
