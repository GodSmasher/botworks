import { describe, it, expect } from 'vitest'
import type { Bot } from '@botworks/core'
import type { ConnectorConfig, ConnectorType, JobPayload } from '@botworks/types'

import inboxTriage, { sampleInput as inboxTriageSample } from '@botworks/inbox-triage'
import documentExtract, { sampleInput as documentExtractSample } from '@botworks/document-extract'
import customerSupport, { sampleInput as customerSupportSample } from '@botworks/customer-support'
import onboarding, { sampleInput as onboardingSample } from '@botworks/onboarding'
import followUp, { sampleInput as followUpSample } from '@botworks/follow-up'
import dataSync, { sampleInput as dataSyncSample } from '@botworks/data-sync'
import reportGenerator, { sampleInput as reportGeneratorSample } from '@botworks/report-generator'
import appointment, { sampleInput as appointmentSample } from '@botworks/appointment'
import employeeMgmt, { sampleInput as employeeMgmtSample } from '@botworks/employee-mgmt'
import inventory, { sampleInput as inventorySample } from '@botworks/inventory'
import billing, { sampleInput as billingSample } from '@botworks/billing'
import taxPrep, { sampleInput as taxPrepSample } from '@botworks/tax-prep'
import reviewAnalysis, { sampleInput as reviewAnalysisSample } from '@botworks/review-analysis'

// Every bot with its bundled sample input. Runs entirely offline: mock mode is
// the default, so each AI call answers with the bot's deterministic heuristics.
const bots: Array<{ bot: Bot; sample: Record<string, unknown> }> = [
  { bot: inboxTriage, sample: inboxTriageSample },
  { bot: documentExtract, sample: documentExtractSample },
  { bot: customerSupport, sample: customerSupportSample },
  { bot: onboarding, sample: onboardingSample },
  { bot: followUp, sample: followUpSample },
  { bot: dataSync, sample: dataSyncSample },
  { bot: reportGenerator, sample: reportGeneratorSample },
  { bot: appointment, sample: appointmentSample },
  { bot: employeeMgmt, sample: employeeMgmtSample },
  { bot: inventory, sample: inventorySample },
  { bot: billing, sample: billingSample },
  { bot: taxPrep, sample: taxPrepSample },
  { bot: reviewAnalysis, sample: reviewAnalysisSample },
]

/** A tenant with every connector the bot declares, mirroring the demo script. */
function connectorsFor(bot: Bot): Map<ConnectorType, ConnectorConfig> {
  const connectors = new Map<ConnectorType, ConnectorConfig>()
  for (const type of [...bot.manifest.requiredConnectors, ...(bot.manifest.optionalConnectors ?? [])]) {
    connectors.set(type, {
      id: `conn-${type}`,
      companyId: 'test-tenant',
      type,
      provider: 'mock',
      status: 'connected',
      credentials: { type, provider: 'mock', credentials: {} },
    })
  }
  return connectors
}

function payloadFor(bot: Bot, input: Record<string, unknown>): JobPayload {
  return { botId: bot.manifest.id, companyId: 'test-tenant', trigger: { type: 'manual', userId: 'test' }, input }
}

async function runWithSample(bot: Bot, sample: Record<string, unknown>) {
  return bot.run(payloadFor(bot, sample), connectorsFor(bot))
}

describe('all bots', () => {
  it('covers all 13 bot packages with unique ids', () => {
    const ids = bots.map(({ bot }) => bot.manifest.id)
    expect(ids).toHaveLength(13)
    expect(new Set(ids).size).toBe(13)
  })

  describe.each(bots.map(({ bot, sample }) => [bot.manifest.id, bot, sample] as const))(
    '%s',
    (_id, bot, sample) => {
      it('accepts its sample input', () => {
        expect(bot.validate(sample)).toBeNull()
      })

      it('completes with its sample input in mock mode', async () => {
        const result = await runWithSample(bot, sample)
        expect(result.error).toBeUndefined()
        expect(result.status).toBe('completed')
        expect(result.output).toBeDefined()
        expect(result.botId).toBe(bot.manifest.id)
      })
    },
  )
})

describe('inbox-triage with sample emails', () => {
  interface TriageOutput {
    results: Array<{ messageId: string; category: string; priority: string; routeTo?: string }>
    summary: { total: number; categories: Record<string, number>; highPriority: number }
  }

  async function triage(): Promise<TriageOutput> {
    const result = await runWithSample(inboxTriage, inboxTriageSample)
    return result.output as unknown as TriageOutput
  }

  it('counts every sample email in the summary', async () => {
    const { results, summary } = await triage()
    expect(summary.total).toBe(inboxTriageSample.emails.length)
    expect(results).toHaveLength(inboxTriageSample.emails.length)
    expect(Object.values(summary.categories).reduce((a, b) => a + b, 0)).toBe(summary.total)
  })

  it('classifies the invoice mail as invoice and routes it via the routing rules', async () => {
    const { results } = await triage()
    const invoice = results.find((r) => r.messageId === 'msg-001')
    expect(invoice?.category).toBe('invoice')
    expect(invoice?.routeTo).toBe(inboxTriageSample.routingRules.invoice)
  })

  it('classifies the prize mail as spam with low priority', async () => {
    const { results } = await triage()
    const spam = results.find((r) => r.messageId === 'msg-004')
    expect(spam?.category).toBe('spam')
    expect(spam?.priority).toBe('low')
  })
})

describe('tax-prep with sample expenses', () => {
  interface TaxPrepOutput {
    categorizedItems: Array<{ id: string; category: string; taxDeductible: boolean; needsReview: boolean }>
    summary: { totalItems: number; totalAmount: number; totalVat?: number; needsReview: number }
  }

  async function categorize(): Promise<TaxPrepOutput> {
    const result = await runWithSample(taxPrep, taxPrepSample)
    return result.output as unknown as TaxPrepOutput
  }

  it('rounds totalVat to two decimals', async () => {
    const { summary } = await categorize()
    expect(summary.totalVat).toBeDefined()
    expect(Math.round(summary.totalVat! * 100) / 100).toBe(summary.totalVat)
    // VAT lines in the sample receipts: 15,57 + 14,25 + 22,80
    expect(summary.totalVat).toBe(52.62)
  })

  it('categorizes every sample expense', async () => {
    const { categorizedItems, summary } = await categorize()
    expect(summary.totalItems).toBe(taxPrepSample.expenses.length)
    expect(categorizedItems.map((i) => i.id)).toEqual(taxPrepSample.expenses.map((e) => e.id))
  })

  it('flags the parking fine as not deductible and marks it for review', async () => {
    const { categorizedItems } = await categorize()
    const fine = categorizedItems.find((i) => i.id === 'exp-008')
    expect(fine?.taxDeductible).toBe(false)
    expect(fine?.needsReview).toBe(true)
  })
})
