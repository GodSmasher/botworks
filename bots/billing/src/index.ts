import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type { BotManifest, BotContext } from '@botworks/types'
import { INVOICE_GENERATE_SYSTEM_PROMPT, INVOICE_GENERATE_JSON_SCHEMA, DUNNING_SYSTEM_PROMPT, DUNNING_JSON_SCHEMA } from './prompts.js'
import { mockInvoice, mockDunning } from './mock.js'

export { sampleInput, sampleDunningInput } from './sample.js'

const timeEntrySchema = z.object({
  date: z.string(),
  hours: z.number(),
  description: z.string(),
  project: z.string().optional(),
  rate: z.number().optional(),
})

const overdueInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  amount: z.number(),
  currency: z.string().default('EUR'),
  dueDate: z.string(),
  daysPastDue: z.number(),
  previousDunningLevel: z.number().default(0),
})

const inputSchema = z.object({
  action: z.enum(['generate_invoice', 'generate_dunning']),
  // generate_invoice
  timeEntries: z.array(timeEntrySchema).optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  defaultRate: z.number().optional(),
  vatRate: z.number().default(8.1),
  currency: z.string().default('EUR'),
  invoiceNumberPattern: z.string().default('INV-{YEAR}-{SEQ}'),
  paymentTerms: z.string().default('30 Tage netto'),
  // generate_dunning
  overdueInvoices: z.array(overdueInvoiceSchema).optional(),
  lateFeePercent: z.number().default(5),
  language: z.string().default('de'),
})

const invoiceResultSchema = z.object({
  invoiceNumber: z.string(),
  customerName: z.string(),
  customerAddress: z.string().optional(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unit: z.string(),
    unitPrice: z.number(),
    total: z.number(),
  })),
  subtotal: z.number(),
  vatRate: z.number(),
  vatAmount: z.number(),
  total: z.number(),
  currency: z.string(),
  paymentTerms: z.string(),
})

const dunningResultSchema = z.object({
  level: z.number(),
  subject: z.string(),
  body: z.string(),
  lateFee: z.number(),
  totalDue: z.number(),
})

export class BillingBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'billing',
    name: 'Billing Bot',
    description: 'Generates invoices from time entries and composes dunning notices for overdue payments.',
    tier: 'tier3',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['email', 'accounting', 'webhook'],
  }

  validate(input: Record<string, unknown>): string | null {
    const result = inputSchema.safeParse(input)
    if (!result.success) return result.error.issues.map((i) => i.message).join('; ')
    return null
  }

  async execute(ctx: BotContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const parsed = inputSchema.parse(input)
    if (parsed.action === 'generate_invoice') return this.generateInvoice(ctx, parsed)
    return this.generateDunning(ctx, parsed)
  }

  private async generateInvoice(ctx: BotContext, input: z.infer<typeof inputSchema>) {
    const entries = input.timeEntries ?? []
    ctx.log('info', `Generating invoice from ${entries.length} time entries`)

    const result = await aiJson({
      system: INVOICE_GENERATE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Customer: ${input.customerName ?? 'Unknown'}`,
          `Address: ${input.customerAddress ?? ''}`,
          `Default rate: ${input.defaultRate ?? 'per entry'} ${input.currency}/h`,
          `VAT rate: ${input.vatRate}%`,
          `Payment terms: ${input.paymentTerms}`,
          `Invoice number pattern: ${input.invoiceNumberPattern}`,
          '',
          `Time entries:\n${JSON.stringify(entries, null, 2)}`,
        ].join('\n'),
      }],
      schema: INVOICE_GENERATE_JSON_SCHEMA,
      parse: (raw) => invoiceResultSchema.parse(JSON.parse(raw)),
      mock: () => mockInvoice(input),
    })

    ctx.log('info', `Invoice generated: ${result.invoiceNumber}`, {
      total: result.total,
      currency: result.currency,
      lineItems: result.lineItems.length,
    })

    return { invoice: result }
  }

  private async generateDunning(ctx: BotContext, input: z.infer<typeof inputSchema>) {
    const invoices = input.overdueInvoices ?? []
    ctx.log('info', `Generating dunning for ${invoices.length} overdue invoice(s)`)

    const dunnings = []
    for (const inv of invoices) {
      const level = this.determineDunningLevel(inv.daysPastDue, inv.previousDunningLevel)

      const result = await aiJson({
        system: DUNNING_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            `Language: ${input.language}`,
            `Dunning level: ${level}`,
            `Invoice: ${inv.invoiceNumber}`,
            `Customer: ${inv.customerName}`,
            `Amount: ${inv.amount} ${inv.currency}`,
            `Due date: ${inv.dueDate}`,
            `Days overdue: ${inv.daysPastDue}`,
            `Late fee percent: ${input.lateFeePercent}%`,
          ].join('\n'),
        }],
        schema: DUNNING_JSON_SCHEMA,
        parse: (raw) => dunningResultSchema.parse(JSON.parse(raw)),
        mock: () => mockDunning(inv, level, input.lateFeePercent, input.language),
      })

      dunnings.push({ invoiceNumber: inv.invoiceNumber, customerEmail: inv.customerEmail, ...result })
      ctx.log('info', `Dunning level ${level} for ${inv.invoiceNumber}`)
    }

    return { dunnings, total: dunnings.length }
  }

  private determineDunningLevel(daysPastDue: number, previousLevel: number): number {
    if (daysPastDue >= 45) return 4
    if (daysPastDue >= 30) return Math.max(3, previousLevel + 1)
    if (daysPastDue >= 14) return Math.max(2, previousLevel + 1)
    return Math.max(1, previousLevel + 1)
  }
}

export default new BillingBot()
