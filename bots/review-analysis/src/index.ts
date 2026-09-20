import { z } from 'zod'
import { Bot, aiJson } from '@botworks/core'
import type { BotManifest, BotContext } from '@botworks/types'
import { REVIEW_ANALYSIS_SYSTEM_PROMPT, REVIEW_ANALYSIS_JSON_SCHEMA } from './prompts.js'
import { mockReviewAnalysis } from './mock.js'

export { sampleInput } from './sample.js'

const reviewSchema = z.object({
  id: z.string(),
  text: z.string(),
  rating: z.number().min(1).max(5).optional(),
  source: z.string().optional(),
  date: z.string().optional(),
  author: z.string().optional(),
})

const inputSchema = z.object({
  reviews: z.array(reviewSchema).min(1),
  language: z.string().default('de'),
  focus: z.string().optional(),
})

const reviewResultSchema = z.object({
  id: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  score: z.number(),
  themes: z.array(z.string()),
  summary: z.string(),
})

const resultSchema = z.object({
  reviews: z.array(reviewResultSchema),
  overallScore: z.number(),
  sentimentBreakdown: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number(),
  }),
  topThemes: z.array(z.object({
    theme: z.string(),
    mentions: z.number(),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
  })),
  recommendations: z.array(z.string()),
  highlights: z.object({
    bestQuote: z.string(),
    worstQuote: z.string(),
  }).optional(),
})

export class ReviewAnalysisBot extends Bot {
  readonly manifest: BotManifest = {
    id: 'review-analysis',
    name: 'Review Analysis Bot',
    description: 'Analyzes customer reviews and feedback. Extracts sentiment, themes, and provides actionable insights.',
    tier: 'tier3',
    version: '0.1.0',
    requiredConnectors: [],
    optionalConnectors: ['webhook'],
  }

  validate(input: Record<string, unknown>): string | null {
    const result = inputSchema.safeParse(input)
    if (!result.success) return result.error.issues.map((i) => i.message).join('; ')
    return null
  }

  async execute(ctx: BotContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const parsed = inputSchema.parse(input)

    ctx.log('info', `Analyzing ${parsed.reviews.length} reviews`, {
      language: parsed.language,
      focus: parsed.focus,
    })

    const result = await aiJson({
      system: REVIEW_ANALYSIS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          `Language: ${parsed.language}`,
          parsed.focus ? `Analysis focus: ${parsed.focus}` : '',
          '',
          `Reviews:\n${JSON.stringify(parsed.reviews, null, 2)}`,
        ].filter(Boolean).join('\n'),
      }],
      schema: REVIEW_ANALYSIS_JSON_SCHEMA,
      parse: (raw) => resultSchema.parse(JSON.parse(raw)),
      mock: () => mockReviewAnalysis(parsed.reviews, parsed.language),
    })

    ctx.log('info', 'Review analysis complete', {
      overallScore: result.overallScore,
      sentiment: result.sentimentBreakdown,
      themes: result.topThemes.length,
    })

    return { result }
  }
}

export default new ReviewAnalysisBot()
