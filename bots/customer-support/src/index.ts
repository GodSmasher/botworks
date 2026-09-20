import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type {
  BotManifest,
  BotContext,
  KnowledgeChunk,
  SupportResponse,
} from '@botworks/types'
import { SUPPORT_SYSTEM_PROMPT, SUPPORT_JSON_SCHEMA, buildSupportUserPrompt } from './prompts.js'
import { mockSupportAnswer } from './mock.js'

export { sampleInput } from './sample.js'

// ─── Input validation ────────────────────────────────────────────────────────

const knowledgeChunkSchema = z.object({
  id: z.string(),
  content: z.string(),
  source: z.string(),
  score: z.number().optional(),
})

const querySchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  context: z.string().optional(),
  language: z.string().optional(),
  customerInfo: z.record(z.string()).optional(),
})

const inputSchema = z.object({
  queries: z.array(querySchema).min(1).max(20),
  knowledgeBase: z.array(knowledgeChunkSchema).min(1),
  maxSourcesPerQuery: z.number().min(1).max(10).default(5),
  escalationEmail: z.string().email().optional(),
})

// ─── AI response schema ──────────────────────────────────────────────────────

const supportResultSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  escalate: z.boolean(),
  escalationReason: z.string().nullable().optional(),
  suggestedFollowUp: z.array(z.string()).optional(),
  usedSourceIds: z.array(z.string()).optional(),
})

// ─── Bot Implementation ──────────────────────────────────────────────────────

export class CustomerSupportBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'customer-support',
    name: 'Customer Support Bot',
    description: 'Answers customer questions using a knowledge base (RAG). Escalates complex queries to humans.',
    tier: 'tier2',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['email', 'webhook'],
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
    const { queries, knowledgeBase, maxSourcesPerQuery } = inputSchema.parse(input)

    ctx.log('info', `Processing ${queries.length} support query(ies) against ${knowledgeBase.length} knowledge chunks`)

    const responses: SupportResponse[] = []

    for (const query of queries) {
      ctx.log('debug', `Query ${query.id}: "${query.question.slice(0, 80)}"`)

      // Simple relevance matching — in production, use vector similarity
      const relevantChunks = this.findRelevantChunks(query.question, knowledgeBase, maxSourcesPerQuery)

      ctx.log('debug', `Found ${relevantChunks.length} relevant chunks`, {
        sources: relevantChunks.map((c) => c.source),
      })

      const aiResult = await aiJson({
        system: SUPPORT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: buildSupportUserPrompt(query.question, relevantChunks, query.customerInfo),
        }],
        schema: SUPPORT_JSON_SCHEMA,
        parse: (raw) => supportResultSchema.parse(JSON.parse(raw)),
        mock: () => mockSupportAnswer(query.question, relevantChunks, query.language),
      })

      const usedSources: KnowledgeChunk[] = relevantChunks
        .filter((c) => aiResult.usedSourceIds?.includes(c.id))
        .map((c) => ({ ...c, score: c.score }))

      const response: SupportResponse = {
        queryId: query.id,
        answer: aiResult.answer,
        confidence: aiResult.confidence,
        sources: usedSources,
        escalate: aiResult.escalate,
        escalationReason: aiResult.escalationReason ?? undefined,
        suggestedFollowUp: aiResult.suggestedFollowUp,
      }

      responses.push(response)

      ctx.log('info', `Query ${query.id}: confidence=${aiResult.confidence.toFixed(2)}, escalate=${aiResult.escalate}`)
    }

    const escalated = responses.filter((r) => r.escalate)

    return {
      responses,
      summary: {
        total: responses.length,
        answered: responses.filter((r) => !r.escalate).length,
        escalated: escalated.length,
        avgConfidence: responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length,
      },
    }
  }

  /**
   * Basic keyword-based relevance search.
   * In production: replace with vector embedding similarity (e.g., via Supabase pgvector).
   */
  private findRelevantChunks(
    question: string,
    chunks: z.infer<typeof knowledgeChunkSchema>[],
    limit: number,
  ): z.infer<typeof knowledgeChunkSchema>[] {
    const questionWords = question
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)

    const scored = chunks.map((chunk) => {
      const text = chunk.content.toLowerCase()
      let score = 0
      for (const word of questionWords) {
        if (text.includes(word)) score++
      }
      return { ...chunk, score: score / questionWords.length }
    })

    return scored
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}

export default new CustomerSupportBot()
