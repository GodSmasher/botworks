// Offline (mock mode) support answer: quotes the best-matching knowledge chunk(s) and applies
// the escalation rules from the system prompt via keyword matching. Deterministic.

interface ScoredChunk {
  id: string
  content: string
  source: string
  score?: number
}

// Topics the prompt says must always go to a human.
const ESCALATION_RULES: Array<{ reason: string; pattern: RegExp }> = [
  { reason: 'Pricing or billing question', pattern: /price|pricing|preis|rabatt|discount|kosten|\bcost|billing|abrechnung|invoice|rechnung|refund|r[üu]ckerstattung|erstattung/i },
  { reason: 'Legal or contract question', pattern: /legal|rechtlich|lawyer|anwalt|contract|vertrag|k[üu]ndig|cancel my|gdpr|dsgvo|liabil|haftung/i },
  { reason: 'Complaint requiring a human response', pattern: /complain|beschwer|unacceptable|inakzeptabel|disappointed|entt[äa]uscht|angry|ver[äa]rgert|frech/i },
  { reason: 'Account change request', pattern: /change my (account|email|address|plan)|delete my account|konto (l[öo]schen|[äa]ndern)|account l[öo]schen|upgrade|downgrade/i },
]

const GERMAN_HINT = /[äöüß]|\b(ich|wie|was|kann|k[öo]nnen|meine?|nicht|bitte|wo|wann|der|die|das|und|ist)\b/i

function firstSentences(text: string, count: number): string {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/).slice(0, count).join(' ')
}

export function mockSupportAnswer(
  question: string,
  chunks: ScoredChunk[],
  language?: string,
): {
  answer: string
  confidence: number
  escalate: boolean
  escalationReason: string | null
  suggestedFollowUp: string[]
  usedSourceIds: string[]
} {
  const german = language ? language.toLowerCase().startsWith('de') : GERMAN_HINT.test(question)
  // Re-rank by overlap of meaningful (5+ letter) question words, so stop words do not count as evidence.
  const words = [...new Set(question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 5))]
  const overlap = (c: ScoredChunk) => words.filter((w) => c.content.toLowerCase().includes(w)).length / Math.max(1, words.length)
  const ranked = chunks
    .map((c, i) => ({ c, i, o: overlap(c) }))
    .filter((r) => r.o > 0)
    .sort((x, y) => y.o - x.o || x.i - y.i)
  const top = ranked[0]?.c
  const topOverlap = ranked[0]?.o ?? 0

  // Confidence grows with the keyword overlap of the best chunk.
  const confidence = top ? Math.round(Math.min(0.95, 0.35 + topOverlap * 0.9) * 100) / 100 : 0.15

  const rule = ESCALATION_RULES.find((r) => r.pattern.test(question))
  let escalationReason: string | null = rule?.reason ?? null
  if (!escalationReason && !top) escalationReason = 'No matching knowledge base entry found'
  if (!escalationReason && confidence < 0.5) escalationReason = 'Not enough context to answer confidently'
  const escalate = escalationReason !== null

  // Use the top chunk plus any other chunk that matched at least half as well (max 3).
  const used = ranked.filter((r) => r.o >= topOverlap / 2).slice(0, 3).map((r) => r.c)
  const unused = ranked.map((r) => r.c).filter((c) => !used.includes(c))

  let answer: string
  if (escalate) {
    answer = german
      ? 'Vielen Dank für Ihre Nachricht. Damit Sie eine verbindliche Antwort erhalten, leite ich Ihr Anliegen an eine Kollegin oder einen Kollegen weiter, die sich zeitnah bei Ihnen melden.'
      : 'Thank you for your message. To make sure you get a reliable answer, I am handing your request over to a colleague who will get back to you shortly.'
    if (top && !rule) {
      answer += german
        ? ` Vorab aus unserer Wissensdatenbank: ${firstSentences(top.content, 1)}`
        : ` In the meantime, from our knowledge base: ${firstSentences(top.content, 1)}`
    }
  } else {
    const body = used.map((c) => firstSentences(c.content, 2)).join(' ')
    answer = german ? `Gerne helfe ich weiter. ${body}` : `Happy to help. ${body}`
  }

  const followUpSources = [...new Set((escalate ? [] : unused).map((c) => c.source))].slice(0, 2)
  const suggestedFollowUp = followUpSources.map((s) =>
    german ? `Möchten Sie mehr zum Thema "${s}" erfahren?` : `Would you like to know more about "${s}"?`,
  )

  return {
    answer,
    confidence,
    escalate,
    escalationReason,
    suggestedFollowUp,
    usedSourceIds: escalate ? [] : used.map((c) => c.id),
  }
}
