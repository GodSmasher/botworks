import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type { BotManifest, BotContext } from '@botworks/types'
import { CATEGORIZE_SYSTEM_PROMPT, CATEGORIZE_JSON_SCHEMA } from './prompts.js'
import { mockCategorization } from './mock.js'

export { sampleInput } from './sample.js'

const expenseSchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  currency: z.string().default('EUR'),
  vendor: z.string().optional(),
  paymentMethod: z.string().optional(),
  receiptText: z.string().optional(),
})

const inputSchema = z.object({
  expenses: z.array(expenseSchema).min(1),
  period: z.string().optional(),
  existingCategories: z.array(z.string()).optional(),
  language: z.string().default('de'),
})

const categorizedItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  confidence: z.number(),
  taxDeductible: z.boolean(),
  vatAmount: z.number().optional(),
  needsReview: z.boolean(),
  notes: z.string().optional(),
})

const resultSchema = z.object({
  categorizedItems: z.array(categorizedItemSchema),
  summary: z.object({
    totalItems: z.number(),
    byCategory: z.record(z.number()),
    needsReview: z.number(),
    totalAmount: z.number(),
    totalVat: z.number().optional(),
  }),
})

export class TaxPrepBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'tax-prep',
    name: 'Tax Preparation Bot',
    description: 'Categorizes expenses and receipts for tax preparation. Structures data for the tax advisor.',
    tier: 'tier3',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['storage', 'accounting'],
  }

  validate(input: Record<string, unknown>): string | null {
    const result = inputSchema.safeParse(input)
    if (!result.success) return result.error.issues.map((i) => i.message).join('; ')
    return null
  }

  async execute(ctx: BotContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const parsed = inputSchema.parse(input)

    ctx.log('info', `Categorizing ${parsed.expenses.length} expenses`, {
      period: parsed.period,
      totalAmount: parsed.expenses.reduce((s, e) => s + e.amount, 0),
    })

    // Process in batches of 20 to stay within token limits
    const batchSize = 20
    const allResults: z.infer<typeof categorizedItemSchema>[] = []

    for (let i = 0; i < parsed.expenses.length; i += batchSize) {
      const batch = parsed.expenses.slice(i, i + batchSize)
      ctx.log('debug', `Processing batch ${Math.floor(i / batchSize) + 1}`)

      const result = await aiJson({
        system: CATEGORIZE_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            `Language: ${parsed.language}`,
            parsed.period ? `Period: ${parsed.period}` : '',
            parsed.existingCategories ? `Custom categories: ${parsed.existingCategories.join(', ')}` : '',
            '',
            `Expenses:\n${JSON.stringify(batch, null, 2)}`,
          ].filter(Boolean).join('\n'),
        }],
        schema: CATEGORIZE_JSON_SCHEMA,
        parse: (raw) => resultSchema.parse(JSON.parse(raw)),
        mock: () => mockCategorization(batch, parsed.existingCategories),
      })

      allResults.push(...result.categorizedItems)
    }

    // Build final summary
    const byCategory: Record<string, number> = {}
    let totalVat = 0
    let needsReview = 0
    for (const item of allResults) {
      byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
      if (item.vatAmount) totalVat += item.vatAmount
      if (item.needsReview) needsReview++
    }

    const summary = {
      totalItems: allResults.length,
      byCategory,
      needsReview,
      totalAmount: parsed.expenses.reduce((s, e) => s + e.amount, 0),
      totalVat: Math.round(totalVat * 100) / 100,
    }

    ctx.log('info', 'Categorization complete', {
      categories: Object.keys(byCategory).length,
      needsReview,
    })

    return { categorizedItems: allResults, summary }
  }
}

export default new TaxPrepBot()
