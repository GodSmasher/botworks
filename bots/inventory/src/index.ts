import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type { BotManifest, BotContext } from '@botworks/types'
import { INVENTORY_ANALYSIS_SYSTEM_PROMPT, INVENTORY_JSON_SCHEMA } from './prompts.js'
import { mockInventoryAnalysis } from './mock.js'

export { sampleInput } from './sample.js'

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  currentStock: z.number(),
  reorderThreshold: z.number().optional(),
  unit: z.string().default('pcs'),
  avgDailyConsumption: z.number().optional(),
  expiryDate: z.string().optional(),
  lastMovementDate: z.string().optional(),
  unitPrice: z.number().optional(),
  category: z.string().optional(),
})

const inputSchema = z.object({
  items: z.array(itemSchema).min(1),
  checkDate: z.string().optional(),
  expiryWarningDays: z.number().default(30),
  slowMovingDays: z.number().default(60),
})

const alertSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  type: z.enum(['low_stock', 'expiring', 'slow_moving', 'out_of_stock']),
  urgency: z.enum(['critical', 'warning', 'info']),
  message: z.string(),
  suggestedAction: z.string(),
  daysUntilIssue: z.number().optional(),
})

const resultSchema = z.object({
  alerts: z.array(alertSchema),
  summary: z.object({
    totalItems: z.number(),
    criticalAlerts: z.number(),
    warningAlerts: z.number(),
    healthyItems: z.number(),
    totalStockValue: z.number().optional(),
  }),
})

export class InventoryBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'inventory',
    name: 'Inventory Bot',
    description: 'Monitors stock levels, expiry dates, and consumption patterns. Alerts on low stock and suggests reorders.',
    tier: 'tier3',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['webhook', 'storage'],
  }

  validate(input: Record<string, unknown>): string | null {
    const result = inputSchema.safeParse(input)
    if (!result.success) return result.error.issues.map((i) => i.message).join('; ')
    return null
  }

  async execute(ctx: BotContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const parsed = inputSchema.parse(input)
    const checkDate = parsed.checkDate ?? new Date().toISOString().split('T')[0]

    ctx.log('info', `Analyzing inventory: ${parsed.items.length} items`, {
      checkDate,
      expiryWarningDays: parsed.expiryWarningDays,
    })

    const result = await aiJson({
      system: INVENTORY_ANALYSIS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Check date: ${checkDate}`,
          `Expiry warning threshold: ${parsed.expiryWarningDays} days`,
          `Slow-moving threshold: ${parsed.slowMovingDays} days`,
          '',
          `Inventory data:\n${JSON.stringify(parsed.items, null, 2)}`,
        ].join('\n'),
      }],
      schema: INVENTORY_JSON_SCHEMA,
      parse: (raw) => resultSchema.parse(JSON.parse(raw)),
      mock: () => mockInventoryAnalysis(parsed.items, checkDate, parsed.expiryWarningDays, parsed.slowMovingDays),
    })

    ctx.log('info', 'Inventory analysis complete', {
      critical: result.summary.criticalAlerts,
      warnings: result.summary.warningAlerts,
      healthy: result.summary.healthyItems,
    })

    return { result, analyzedAt: checkDate }
  }
}

export default new InventoryBot()
