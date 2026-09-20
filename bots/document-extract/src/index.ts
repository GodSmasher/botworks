import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type {
  BotManifest,
  BotContext,
  DocumentType,
  ExtractedDocument,
  ExtractedField,
  InvoiceFields,
  ContractFields,
} from '@botworks/types'
import {
  CLASSIFY_SYSTEM_PROMPT,
  CLASSIFY_JSON_SCHEMA,
  INVOICE_EXTRACT_SYSTEM_PROMPT,
  INVOICE_JSON_SCHEMA,
  CONTRACT_EXTRACT_SYSTEM_PROMPT,
  CONTRACT_JSON_SCHEMA,
  GENERIC_EXTRACT_SYSTEM_PROMPT,
  GENERIC_JSON_SCHEMA,
} from './prompts.js'
import { mockClassify, mockInvoice, mockContract, mockGeneric } from './mock.js'

export { sampleInput } from './sample.js'

// ─── Input validation ────────────────────────────────────────────────────────

const documentInputSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  content: z.string().min(1), // base64 or plain text
  source: z.string().optional(),
})

const inputSchema = z.object({
  documents: z.array(documentInputSchema).min(1).max(20),
  forceType: z.enum(['invoice', 'contract', 'report', 'receipt', 'letter', 'form', 'other']).optional(),
})

// ─── Zod schemas for AI responses ────────────────────────────────────────────

const classifySchema = z.object({
  type: z.enum(['invoice', 'contract', 'report', 'receipt', 'letter', 'form', 'other']),
  confidence: z.number().min(0).max(1),
})

const invoiceSchema = z.object({
  invoiceNumber: z.string(),
  vendor: z.string(),
  date: z.string(),
  dueDate: z.string().optional(),
  totalGross: z.number(),
  totalNet: z.number().optional(),
  vatAmount: z.number().optional(),
  vatRate: z.number().optional(),
  currency: z.string(),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().optional(),
        unitPrice: z.number().optional(),
        total: z.number(),
      }),
    )
    .optional(),
})

const contractSchema = z.object({
  parties: z.array(z.string()),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
  type: z.string().optional(),
  keyTerms: z.array(z.string()).optional(),
})

// ─── Bot Implementation ──────────────────────────────────────────────────────

export class DocumentExtractBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'document-extract',
    name: 'Document Extract Bot',
    description: 'Extracts structured data from invoices, contracts, and other business documents.',
    tier: 'tier1',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['storage'],
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
    const { documents, forceType } = inputSchema.parse(input)

    ctx.log('info', `Extracting data from ${documents.length} document(s)`)

    const results: ExtractedDocument[] = []

    for (const doc of documents) {
      ctx.log('debug', `Processing: ${doc.filename}`)

      // Decode content — support base64 and plain text
      const text = this.decodeContent(doc.content, doc.contentType)

      // Step 1: Classify document type (or use forced type)
      const docType = forceType ?? (await this.classifyDocument(text))

      ctx.log('info', `Document "${doc.filename}" classified as: ${docType}`)

      // Step 2: Extract fields based on type
      const extracted = await this.extractFields(ctx, text, docType, doc.filename)

      results.push(extracted)
    }

    return {
      results,
      summary: {
        total: results.length,
        types: results.reduce(
          (acc, r) => {
            acc[r.type] = (acc[r.type] ?? 0) + 1
            return acc
          },
          {} as Record<string, number>,
        ),
      },
    }
  }

  private decodeContent(content: string, contentType: string): string {
    // If it's already plain text, return as-is
    if (contentType.startsWith('text/')) return content

    // Try base64 decode
    try {
      return Buffer.from(content, 'base64').toString('utf-8')
    } catch {
      return content
    }
  }

  private async classifyDocument(text: string): Promise<DocumentType> {
    const result = await aiJson({
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 6000) }],
      schema: CLASSIFY_JSON_SCHEMA,
      parse: (raw) => classifySchema.parse(JSON.parse(raw)),
      mock: () => mockClassify(text),
    })
    return result.type
  }

  private async extractFields(
    ctx: BotContext,
    text: string,
    type: DocumentType,
    filename: string,
  ): Promise<ExtractedDocument> {
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    switch (type) {
      case 'invoice':
        return this.extractInvoice(ctx, text, documentId, filename)
      case 'contract':
        return this.extractContract(ctx, text, documentId, filename)
      default:
        return this.extractGeneric(ctx, text, type, documentId, filename)
    }
  }

  private async extractInvoice(
    ctx: BotContext,
    text: string,
    documentId: string,
    filename: string,
  ): Promise<ExtractedDocument> {
    const invoice = await aiJson<InvoiceFields>({
      system: INVOICE_EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 8000) }],
      schema: INVOICE_JSON_SCHEMA,
      parse: (raw) => invoiceSchema.parse(JSON.parse(raw)) as InvoiceFields,
      mock: () => mockInvoice(text),
    })

    ctx.log('info', `Invoice extracted: ${invoice.invoiceNumber}`, {
      vendor: invoice.vendor,
      total: invoice.totalGross,
      currency: invoice.currency,
    })

    const fields = this.objectToFields(invoice as unknown as Record<string, unknown>)

    return {
      documentId,
      type: 'invoice',
      confidence: 0.9,
      fields,
      metadata: { filename, invoiceData: invoice },
    }
  }

  private async extractContract(
    ctx: BotContext,
    text: string,
    documentId: string,
    filename: string,
  ): Promise<ExtractedDocument> {
    const contract = await aiJson<ContractFields>({
      system: CONTRACT_EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 8000) }],
      schema: CONTRACT_JSON_SCHEMA,
      parse: (raw) => contractSchema.parse(JSON.parse(raw)) as ContractFields,
      mock: () => mockContract(text),
    })

    ctx.log('info', `Contract extracted: ${contract.parties.join(' ↔ ')}`, {
      type: contract.type,
      value: contract.value,
    })

    const fields = this.objectToFields(contract as unknown as Record<string, unknown>)

    return {
      documentId,
      type: 'contract',
      confidence: 0.85,
      fields,
      metadata: { filename, contractData: contract },
    }
  }

  private async extractGeneric(
    ctx: BotContext,
    text: string,
    type: DocumentType,
    documentId: string,
    filename: string,
  ): Promise<ExtractedDocument> {
    const data = await aiJson<Record<string, string>>({
      system: GENERIC_EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 8000) }],
      schema: GENERIC_JSON_SCHEMA,
      parse: (raw) => {
        const parsed = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Expected object')
        return parsed as Record<string, string>
      },
      mock: () => mockGeneric(text),
    })

    ctx.log('info', `Generic extraction: ${Object.keys(data).length} fields found`)

    const fields = this.objectToFields(data)

    return {
      documentId,
      type,
      confidence: 0.7,
      fields,
      metadata: { filename },
    }
  }

  private objectToFields(obj: Record<string, unknown>): Record<string, ExtractedField> {
    const fields: Record<string, ExtractedField> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue
      // Skip nested arrays/objects — flatten only primitives
      if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        fields[key] = {
          key,
          value: JSON.stringify(value),
          confidence: 0.8,
        }
      } else {
        fields[key] = {
          key,
          value: String(value),
          confidence: 0.9,
        }
      }
    }
    return fields
  }
}

export default new DocumentExtractBot()
