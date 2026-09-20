import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type {
  BotManifest,
  BotContext,
  OnboardingEntityType,
  OnboardingResult,
  ValidationError,
  DistributionTarget,
} from '@botworks/types'
import { sendWebhook, type WebhookConfig } from '@botworks/connectors'
import {
  NORMALIZE_SYSTEM_PROMPT,
  NORMALIZE_JSON_SCHEMA,
  DISTRIBUTION_SYSTEM_PROMPT,
  DISTRIBUTION_JSON_SCHEMA,
} from './prompts.js'
import { mockNormalize, mockDistribution } from './mock.js'

export { sampleInput } from './sample.js'

// ─── Input validation ────────────────────────────────────────────────────────

const inputSchema = z.object({
  entityType: z.enum(['customer', 'employee', 'vendor', 'partner']),
  rawData: z.record(z.unknown()).refine((d) => Object.keys(d).length > 0, 'rawData cannot be empty'),
  sourceFormat: z.string().optional(),
  targetSystems: z.array(z.string()).optional(),
  webhooks: z.array(z.object({
    system: z.string(),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
  })).optional(),
})

// ─── AI response schemas ─────────────────────────────────────────────────────

const normalizeResultSchema = z.object({
  normalizedData: z.record(z.string()),
  validationErrors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    severity: z.enum(['error', 'warning']),
  })),
})

const distributionResultSchema = z.object({
  distributions: z.array(z.object({
    system: z.string(),
    fields: z.record(z.unknown()),
  })),
})

// ─── Bot Implementation ──────────────────────────────────────────────────────

export class OnboardingBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'onboarding',
    name: 'Onboarding Bot',
    description: 'Normalizes and validates new entity data (customers, employees, vendors) and distributes to target systems.',
    tier: 'tier2',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['crm', 'webhook'],
  }

  validate(input: Record<string, unknown>): string | null {
    const result = inputSchema.safeParse(input)
    if (!result.success) return result.error.issues.map((i) => i.message).join('; ')
    return null
  }

  async execute(
    ctx: BotContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const parsed = inputSchema.parse(input)

    ctx.log('info', `Onboarding ${parsed.entityType}`, {
      fields: Object.keys(parsed.rawData).length,
      targetSystems: parsed.targetSystems?.length ?? 0,
    })

    // Step 1: Normalize raw data with AI
    ctx.log('info', 'Step 1: Normalizing data')
    const normalized = await this.normalizeData(parsed.entityType, parsed.rawData)

    ctx.log('info', `Normalized ${Object.keys(normalized.normalizedData).length} fields`, {
      errors: normalized.validationErrors.length,
    })

    // Step 2: Check for blocking validation errors
    const blockingErrors = normalized.validationErrors.filter((e) => e.severity === 'error')
    if (blockingErrors.length > 0) {
      ctx.log('warn', `${blockingErrors.length} blocking validation error(s)`, {
        errors: blockingErrors.map((e) => `${e.field}: ${e.message}`),
      })

      return {
        result: {
          entityType: parsed.entityType,
          normalizedData: normalized.normalizedData,
          validationErrors: normalized.validationErrors,
          distributionTargets: [],
          status: 'needs_review',
        } satisfies OnboardingResult,
      }
    }

    // Step 3: Distribute to target systems
    const distributionTargets: DistributionTarget[] = []

    if (parsed.webhooks && parsed.webhooks.length > 0) {
      ctx.log('info', `Step 2: Distributing to ${parsed.webhooks.length} system(s)`)

      // Plan distribution via AI
      const plan = await this.planDistribution(
        normalized.normalizedData,
        parsed.webhooks.map((w) => w.system),
      )

      // Execute distribution via webhooks
      for (const webhook of parsed.webhooks) {
        const dist = plan.distributions.find((d) => d.system === webhook.system)
        const payload = dist?.fields ?? normalized.normalizedData

        try {
          const config: WebhookConfig = {
            url: webhook.url,
            method: 'POST',
            headers: webhook.headers,
            timeout: 15_000,
          }
          const result = await sendWebhook(config, {
            entityType: parsed.entityType,
            data: payload,
          })

          distributionTargets.push({
            system: webhook.system,
            status: result.status >= 200 && result.status < 300 ? 'sent' : 'failed',
            payload: payload as Record<string, unknown>,
          })

          ctx.log('info', `Distributed to ${webhook.system}: ${result.status}`)
        } catch (err) {
          distributionTargets.push({
            system: webhook.system,
            status: 'failed',
          })
          ctx.log('error', `Failed to distribute to ${webhook.system}`, {
            error: (err as Error).message,
          })
        }
      }
    }

    const result: OnboardingResult = {
      entityType: parsed.entityType,
      normalizedData: normalized.normalizedData,
      validationErrors: normalized.validationErrors,
      distributionTargets,
      status: 'complete',
    }

    ctx.log('info', 'Onboarding complete', {
      distributed: distributionTargets.filter((d) => d.status === 'sent').length,
      failed: distributionTargets.filter((d) => d.status === 'failed').length,
    })

    return { result }
  }

  private async normalizeData(
    entityType: OnboardingEntityType,
    rawData: Record<string, unknown>,
  ) {
    return aiJson({
      system: NORMALIZE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Entity type: ${entityType}\n\nRaw data:\n${JSON.stringify(rawData, null, 2)}`,
      }],
      schema: NORMALIZE_JSON_SCHEMA,
      parse: (raw) => normalizeResultSchema.parse(JSON.parse(raw)),
      mock: () => mockNormalize(entityType, rawData),
    })
  }

  private async planDistribution(
    normalizedData: Record<string, string>,
    systems: string[],
  ) {
    return aiJson({
      system: DISTRIBUTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Normalized data:\n${JSON.stringify(normalizedData, null, 2)}\n\nTarget systems: ${systems.join(', ')}`,
      }],
      schema: DISTRIBUTION_JSON_SCHEMA,
      parse: (raw) => distributionResultSchema.parse(JSON.parse(raw)),
      mock: () => mockDistribution(normalizedData, systems),
    })
  }
}

export default new OnboardingBot()
