// Offline (mock mode) triage: a small keyword classifier that stands in for the model.
// It is deterministic and derives every field from the email itself.

type Category =
  | 'inquiry' | 'complaint' | 'invoice' | 'contract'
  | 'support' | 'spam' | 'internal' | 'other'
type Priority = 'low' | 'normal' | 'high' | 'critical'

interface MockEmail {
  from: string
  to: string[]
  subject: string
  body: string
}

// Checked top to bottom; the category with the most keyword hits wins, earlier rules win ties.
const RULES: Array<{ category: Category; pattern: RegExp }> = [
  { category: 'spam', pattern: /unsubscribe|abmelden|newsletter|gewonnen|you won|lottery|casino|100% free|limited offer|click here|seo (service|ranking)/gi },
  { category: 'complaint', pattern: /complaint|beschwerde|reklamation|refund|r[üu]ckerstattung|unzufrieden|disappointed|entt[äa]uscht|unacceptable|inakzeptabel|besch[äa]digt|damaged/gi },
  { category: 'invoice', pattern: /invoice|rechnung|zahlungserinnerung|payment (request|reminder)|mahnung|f[äa]llig|amount due|iban/gi },
  { category: 'contract', pattern: /contract|vertrag|agreement|vereinbarung|\bnda\b|unterschrift|signature|terms and conditions|\bagb\b/gi },
  { category: 'support', pattern: /error|fehler|funktioniert nicht|not working|doesn't work|cannot log ?in|login|password|passwort|bug|crash|st[öo]rung|help with/gi },
  { category: 'inquiry', pattern: /angebot|quote|quotation|anfrage|inquiry|enquiry|interested in|interesse|pricing|preisliste|information about|k[öo]nnen sie|could you/gi },
]

const ACTIONS: Record<Category, { action: string; routeTo: string | null }> = {
  inquiry: { action: 'Forward to sales and reply with the requested information', routeTo: 'sales' },
  complaint: { action: 'Escalate to customer service lead and acknowledge within 24h', routeTo: 'customer-service' },
  invoice: { action: 'Forward to accounting for verification and payment', routeTo: 'accounting' },
  contract: { action: 'Forward to legal/management for review', routeTo: 'legal' },
  support: { action: 'Create a support ticket and send troubleshooting steps', routeTo: 'support' },
  spam: { action: 'Archive without reply', routeTo: null },
  internal: { action: 'Deliver to the addressed team, no external action needed', routeTo: 'team' },
  other: { action: 'Leave for manual review', routeTo: null },
}

const URGENT = /urgent|dringend|asap|sofort|immediately|umgehend|letzte mahnung|final notice/i

function domainOf(address: string): string {
  const match = address.match(/@([\w.-]+)/)
  return match ? match[1].toLowerCase() : ''
}

function countHits(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length
}

function extractEntities(email: MockEmail): Record<string, string> {
  const text = `${email.subject}\n${email.body}`
  const entities: Record<string, string> = { sender: email.from }

  const amount = text.match(/(?:EUR|CHF|USD|€|\$)\s?\d[\d.,']*\d|\d[\d.,']*\d\s?(?:EUR|CHF|USD|€)/)
  if (amount) entities.amount = amount[0]

  const reference = text.match(/\b(?:RE|INV|PO|ORD|TCK|AB|KD)[-_ ]?\d[\d-]{2,}\b/i)
  if (reference) entities.reference = reference[0]

  const date = text.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}\.\d{4}\b/)
  if (date) entities.date = date[0]

  return entities
}

export function mockTriage(email: MockEmail): {
  category: Category
  confidence: number
  summary: string
  suggestedAction: string
  priority: Priority
  routeTo: string | null
  extractedEntities: Record<string, string>
} {
  const text = `${email.subject}\n${email.body}`

  let category: Category = 'other'
  let hits = 0
  for (const rule of RULES) {
    const count = countHits(text, rule.pattern)
    if (count > hits) {
      category = rule.category
      hits = count
    }
  }

  // Sender and all recipients on the same domain → internal mail (unless it is clearly something else).
  const senderDomain = domainOf(email.from)
  const isInternal = senderDomain !== '' && email.to.length > 0 && email.to.every((t) => domainOf(t) === senderDomain)
  if (isInternal && hits < 2) {
    category = 'internal'
    hits = Math.max(hits, 2)
  }

  const urgent = URGENT.test(text)
  let priority: Priority = 'normal'
  if (category === 'spam') priority = 'low'
  else if (category === 'complaint') priority = urgent ? 'critical' : 'high'
  else if (urgent) priority = 'high'
  else if (category === 'other' || category === 'internal') priority = 'low'

  const firstSentence = email.body.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] ?? ''
  const summary = `${email.subject.trim()} — ${firstSentence.slice(0, 160)}`.trim()

  return {
    category,
    confidence: category === 'other' ? 0.4 : Math.min(0.95, 0.55 + 0.1 * hits),
    summary,
    suggestedAction: ACTIONS[category].action,
    priority,
    routeTo: ACTIONS[category].routeTo,
    extractedEntities: extractEntities(email),
  }
}
