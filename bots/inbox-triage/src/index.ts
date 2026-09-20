import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type {
  BotManifest,
  BotContext,
  EmailMessage,
  TriageResult,
  EmailCategory,
  JobPriority,
} from '@botworks/types'
import { TRIAGE_SYSTEM_PROMPT, TRIAGE_JSON_SCHEMA, buildTriageUserPrompt } from './prompts.js'
import { mockTriage } from './mock.js'

export { sampleInput } from './sample.js'

// ─── Input validation ────────────────────────────────────────────────────────

const inputSchema = z.object({
  emails: z
    .array(
      z.object({
        id: z.string(),
        from: z.string(),
        to: z.array(z.string()),
        subject: z.string(),
        body: z.string(),
      }),
    )
    .min(1)
    .max(50),
  routingRules: z
    .record(z.string()) // category → target (e.g., "invoice" → "accounting@company.example")
    .optional(),
})

// ─── AI response parser ──────────────────────────────────────────────────────

const triageResultSchema = z.object({
  category: z.enum([
    'inquiry', 'complaint', 'invoice', 'contract',
    'support', 'spam', 'internal', 'other',
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  suggestedAction: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'critical']),
  routeTo: z.string().nullable().optional(),
  extractedEntities: z.record(z.string()).optional(),
})

// ─── Bot Implementation ──────────────────────────────────────────────────────

export class InboxTriageBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'inbox-triage',
    name: 'Inbox Triage Bot',
    description: 'Classifies incoming emails by category, priority, and suggests routing actions.',
    tier: 'tier1',
    version: '0.1.0',
    requiredConnectors: ['email'],
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
    const { emails, routingRules } = inputSchema.parse(input)

    ctx.log('info', `Triaging ${emails.length} email(s)`)

    const results: TriageResult[] = []

    for (const email of emails) {
      ctx.log('debug', `Processing email: ${email.id}`, { subject: email.subject })

      const parsed = await aiJson<{
        category: EmailCategory
        confidence: number
        summary: string
        suggestedAction: string
        priority: JobPriority
        routeTo?: string | null
        extractedEntities?: Record<string, string>
      }>({
        system: TRIAGE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildTriageUserPrompt(email) }],
        schema: TRIAGE_JSON_SCHEMA,
        parse: (raw) => triageResultSchema.parse(JSON.parse(raw)),
        mock: () => mockTriage(email),
      })

      // Apply routing rules if provided
      const routeTo = routingRules?.[parsed.category] ?? parsed.routeTo ?? undefined

      results.push({
        messageId: email.id,
        category: parsed.category,
        confidence: parsed.confidence,
        summary: parsed.summary,
        suggestedAction: parsed.suggestedAction,
        routeTo,
        priority: parsed.priority,
        extractedEntities: parsed.extractedEntities,
      })

      ctx.log('info', `Email ${email.id} → ${parsed.category} (${(parsed.confidence * 100).toFixed(0)}%)`, {
        priority: parsed.priority,
        routeTo,
      })
    }

    const categoryCounts = results.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    ctx.log('info', 'Triage complete', { categoryCounts, total: results.length })

    return {
      results,
      summary: {
        total: results.length,
        categories: categoryCounts,
        highPriority: results.filter((r) => r.priority === 'high' || r.priority === 'critical').length,
      },
    }
  }
}

export default new InboxTriageBot()
