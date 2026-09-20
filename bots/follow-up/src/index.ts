import { z } from 'zod'
import { Bot, aiJson, aiComplete } from '@botworks/core'
import type {
  BotManifest,
  BotContext,
  EscalationLevel,
  FollowUpRule,
  FollowUpTarget,
  FollowUpAction,
} from '@botworks/types'
import {
  COMPOSE_SYSTEM_PROMPT,
  COMPOSE_JSON_SCHEMA,
  EVALUATE_SYSTEM_PROMPT,
  EVALUATE_JSON_SCHEMA,
} from './prompts.js'
import { mockEvaluateTargets, mockComposeEmail } from './mock.js'

// ─── Input validation ────────────────────────────────────────────────────────

const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  triggerAfterDays: z.number().min(1),
  escalationLevel: z.number().min(1).max(3) as z.ZodType<EscalationLevel>,
  template: z.string(),
  channel: z.enum(['email', 'webhook']),
  maxReminders: z.number().optional(),
})

const targetSchema = z.object({
  id: z.string(),
  recipientEmail: z.string().email(),
  recipientName: z.string(),
  subject: z.string(),
  context: z.record(z.string()),
  createdAt: z.string(),
  lastContactAt: z.string().optional(),
  remindersSent: z.number().default(0),
  status: z.enum(['active', 'completed', 'escalated', 'cancelled']),
})

const inputSchema = z.object({
  targets: z.array(targetSchema).min(1),
  rules: z.array(ruleSchema).min(1),
  dryRun: z.boolean().default(false),
  currentDate: z.string().optional(),
})

// ─── AI response schemas ─────────────────────────────────────────────────────

const evaluateResultSchema = z.object({
  actions: z.array(z.object({
    targetId: z.string(),
    action: z.enum(['send_reminder', 'escalate', 'skip', 'complete']),
    escalationLevel: z.number().min(1).max(3),
    reason: z.string(),
  })),
})

const composeResultSchema = z.object({
  subject: z.string(),
  body: z.string(),
  tone: z.enum(['friendly', 'direct', 'urgent']),
})

// ─── Bot Implementation ──────────────────────────────────────────────────────

export class FollowUpBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'follow-up',
    name: 'Follow-up & Reminder Bot',
    description: 'Sends time-based follow-up emails with escalation levels. Evaluates targets and composes personalized reminders.',
    tier: 'tier2',
    version: '0.1.0',
    requiredConnectors: ['email'],
    optionalConnectors: ['webhook'],
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
    const { targets, rules, dryRun, currentDate } = inputSchema.parse(input)
    const now = currentDate ?? new Date().toISOString().split('T')[0]

    const activeTargets = targets.filter((t) => t.status === 'active')
    ctx.log('info', `Evaluating ${activeTargets.length} active follow-up target(s)`, { dryRun })

    // Step 1: Evaluate which targets need action
    const evaluation = await this.evaluateTargets(activeTargets, rules, now)

    ctx.log('info', `Evaluation complete`, {
      actions: evaluation.actions.map((a) => `${a.targetId}:${a.action}`),
    })

    const results: (FollowUpAction & { composedEmail?: { subject: string; body: string } })[] = []

    // Step 2: Compose and (optionally) send reminders
    for (const action of evaluation.actions) {
      if (action.action === 'skip' || action.action === 'complete') {
        results.push({
          targetId: action.targetId,
          action: action.action,
          escalationLevel: action.escalationLevel as EscalationLevel,
        })
        continue
      }

      const target = targets.find((t) => t.id === action.targetId)
      if (!target) continue

      // Find the matching rule for this escalation level
      const rule = rules.find((r) => r.escalationLevel === action.escalationLevel)
      if (!rule) {
        ctx.log('warn', `No rule for escalation level ${action.escalationLevel}`)
        continue
      }

      // Compose the email
      const composed = await this.composeEmail(target, rule, action.escalationLevel as EscalationLevel)

      ctx.log('info', `Composed ${composed.tone} email for ${target.recipientName}`, {
        subject: composed.subject,
        escalation: action.escalationLevel,
      })

      const resultItem: FollowUpAction & { composedEmail?: { subject: string; body: string } } = {
        targetId: action.targetId,
        action: action.action as FollowUpAction['action'],
        escalationLevel: action.escalationLevel as EscalationLevel,
        message: composed.body,
        composedEmail: { subject: composed.subject, body: composed.body },
      }

      if (!dryRun) {
        ctx.log('info', `Would send email to ${target.recipientEmail} (sending disabled in MVP)`)
        // In production: use EmailConnector to send
        // const emailConnector = ctx.connectors.get('email')
        // await emailConnector.send([target.recipientEmail], composed.subject, composed.body)
      }

      results.push(resultItem)
    }

    const summary = {
      total: results.length,
      reminders: results.filter((r) => r.action === 'send_reminder').length,
      escalations: results.filter((r) => r.action === 'escalate').length,
      skipped: results.filter((r) => r.action === 'skip').length,
      completed: results.filter((r) => r.action === 'complete').length,
      dryRun,
    }

    ctx.log('info', 'Follow-up run complete', summary)

    return { results, summary }
  }

  private async evaluateTargets(
    targets: z.infer<typeof targetSchema>[],
    rules: z.infer<typeof ruleSchema>[],
    currentDate: string,
  ) {
    const targetSummary = targets.map((t) => ({
      id: t.id,
      name: t.recipientName,
      createdAt: t.createdAt,
      lastContactAt: t.lastContactAt,
      remindersSent: t.remindersSent,
    }))

    const rulesSummary = rules.map((r) => ({
      level: r.escalationLevel,
      afterDays: r.triggerAfterDays,
      maxReminders: r.maxReminders,
    }))

    return aiJson({
      system: EVALUATE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Current date: ${currentDate}`,
          '',
          `Rules:\n${JSON.stringify(rulesSummary, null, 2)}`,
          '',
          `Targets:\n${JSON.stringify(targetSummary, null, 2)}`,
        ].join('\n'),
      }],
      schema: EVALUATE_JSON_SCHEMA,
      parse: (raw) => evaluateResultSchema.parse(JSON.parse(raw)),
      mock: () => mockEvaluateTargets(targets, rules, currentDate),
    })
  }

  private async composeEmail(
    target: z.infer<typeof targetSchema>,
    rule: z.infer<typeof ruleSchema>,
    level: EscalationLevel,
  ) {
    // Replace template variables
    let template = rule.template
    for (const [key, value] of Object.entries(target.context)) {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    template = template.replace(/\{\{recipient_name\}\}/g, target.recipientName)

    return aiJson({
      system: COMPOSE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Escalation level: ${level}`,
          `Reminders already sent: ${target.remindersSent}`,
          `Original subject: ${target.subject}`,
          '',
          `Template:\n${template}`,
          '',
          `Context variables:\n${JSON.stringify(target.context, null, 2)}`,
        ].join('\n'),
      }],
      schema: COMPOSE_JSON_SCHEMA,
      parse: (raw) => composeResultSchema.parse(JSON.parse(raw)),
      mock: () => mockComposeEmail(template, target.subject, level),
    })
  }
}

export default new FollowUpBot()

export { sampleInput } from './sample.js'
