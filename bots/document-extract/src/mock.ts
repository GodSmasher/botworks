// Offline (mock mode) extraction: regex/keyword heuristics that stand in for the model.
// Everything is derived from the document text; nothing is random.

type DocType = 'invoice' | 'contract' | 'report' | 'receipt' | 'letter' | 'form' | 'other'

const AMOUNT = String.raw`\d{1,3}(?:[.,' ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`
const DATE = String.raw`\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\/\d{1,2}\/\d{4}`

// ─── Small helpers ───────────────────────────────────────────────────────────

/** Parses "1.190,00", "1,190.00", "1'190.00" or "1190" into a number. */
export function parseAmount(raw: string): number {
  let s = raw.replace(/[' ]/g, '')
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    // comma is the decimal separator (German style) unless it groups thousands
    s = s.length - lastComma === 4 && lastDot === -1 ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    s = s.length - lastDot === 4 && lastComma === -1 ? s.replace(/\./g, '') : s.replace(/,/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** Converts DD.MM.YYYY or DD/MM/YYYY to ISO; ISO dates pass through. */
export function toIsoDate(raw: string): string {
  const m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return raw
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** First amount that follows one of the labels on the same line (a percentage such as "VAT 19%:" is skipped). */
function amountAfter(text: string, labels: string): number | undefined {
  const m = text.match(new RegExp(`(?:${labels})(?:[^\\n\\d]*\\d+(?:[.,]\\d+)?\\s?%)?[^\\n\\d]*?(${AMOUNT})(?![\\d%])`, 'i'))
  return m ? parseAmount(m[1]) : undefined
}

/** First date that follows one of the labels on the same line. */
function dateAfter(text: string, labels: string): string | undefined {
  const m = text.match(new RegExp(`(?:${labels})[^\\n]*?(${DATE})`, 'i'))
  return m ? toIsoDate(m[1]) : undefined
}

function detectCurrency(text: string): string | undefined {
  if (/\bCHF\b/.test(text)) return 'CHF'
  if (/\bEUR\b|€/.test(text)) return 'EUR'
  if (/\bUSD\b|\$/.test(text)) return 'USD'
  if (/\bGBP\b|£/.test(text)) return 'GBP'
  return undefined
}

// ─── Classification ──────────────────────────────────────────────────────────

// Earlier entries win ties.
const TYPE_KEYWORDS: Array<{ type: DocType; pattern: RegExp }> = [
  { type: 'invoice', pattern: /rechnung|invoice|rechnungsnummer|mwst|\bust\b|\bvat\b|zahlbar|due date|netto|brutto/gi },
  { type: 'contract', pattern: /vertrag|contract|agreement|vereinbarung|parties|vertragsparteien|hereinafter|nachfolgend|termination|k[üu]ndigung|signature|unterschrift/gi },
  { type: 'receipt', pattern: /quittung|receipt|kassenbon|beleg|paid in full|bezahlt|card payment|kartenzahlung/gi },
  { type: 'report', pattern: /bericht|report|quarterly|quartal|summary of results|kennzahlen|analysis|auswertung/gi },
  { type: 'form', pattern: /formular|application form|antrag|bitte ausf[üu]llen|please fill|registration|anmeldung/gi },
  { type: 'letter', pattern: /sehr geehrte|dear |mit freundlichen gr[üu]ssen|mit freundlichen gr[üu]ßen|sincerely|kind regards|best regards/gi },
]

export function mockClassify(text: string): { type: DocType; confidence: number } {
  let type: DocType = 'other'
  let hits = 0
  for (const entry of TYPE_KEYWORDS) {
    const count = (text.match(entry.pattern) ?? []).length
    if (count > hits) {
      type = entry.type
      hits = count
    }
  }
  return { type, confidence: type === 'other' ? 0.4 : Math.min(0.95, 0.5 + 0.1 * hits) }
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export function mockInvoice(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  const number = text.match(/(?:rechnungsnummer|rechnungs-?nr\.?|rechnung nr\.?|invoice (?:no\.?|number|#))[:\s#]*([A-Z0-9][A-Z0-9\/-]*)/i)
  const rate = text.match(/(\d{1,2}(?:[.,]\d)?)\s?%/)

  let totalNet = amountAfter(text, 'netto|net total|subtotal|zwischensumme')
  let vatAmount = amountAfter(text, 'mwst|\\bust\\b|umsatzsteuer|\\bvat\\b')
  let totalGross =
    amountAfter(text, 'brutto|gesamtbetrag|rechnungsbetrag|total due|grand total|gross') ??
    amountAfter(text, '\\btotal')
  const vatRate = rate ? parseAmount(rate[1]) : undefined

  // Line items look like: "<qty> x <description>  <unit price>  <total>"
  const lineItems = lines.flatMap((line) => {
    const m = line.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*x\\s+(.+?)\\s{2,}(${AMOUNT})\\s{2,}(${AMOUNT})$`, 'i'))
    if (!m) return []
    return [{ description: m[2], quantity: parseAmount(m[1]), unitPrice: parseAmount(m[3]), total: parseAmount(m[4]) }]
  })

  // Fill gaps with arithmetic on what we found.
  if (totalNet === undefined && lineItems.length > 0) totalNet = round2(lineItems.reduce((s, i) => s + i.total, 0))
  if (vatAmount === undefined && totalNet !== undefined && vatRate !== undefined) vatAmount = round2((totalNet * vatRate) / 100)
  if (totalGross === undefined) totalGross = round2((totalNet ?? 0) + (vatAmount ?? 0))

  return {
    invoiceNumber: number ? number[1] : 'UNKNOWN',
    vendor: lines[0] ?? 'Unknown vendor',
    date: dateAfter(text, 'rechnungsdatum|invoice date|datum|date') ?? '',
    dueDate: dateAfter(text, 'f[äa]llig|zahlbar bis|\\bdue\\b'),
    totalGross,
    totalNet,
    vatAmount,
    vatRate,
    currency: detectCurrency(text) ?? 'EUR',
    lineItems: lineItems.length > 0 ? lineItems : undefined,
  }
}

// ─── Contract ────────────────────────────────────────────────────────────────

const CONTRACT_TYPES: Array<{ type: string; pattern: RegExp }> = [
  { type: 'NDA', pattern: /non-disclosure|\bnda\b|geheimhaltung|vertraulichkeitsvereinbarung/i },
  { type: 'employment', pattern: /employment|arbeitsvertrag|employee|arbeitnehmer/i },
  { type: 'lease', pattern: /lease|mietvertrag|tenant|landlord|vermieter/i },
  { type: 'service', pattern: /service|dienstleistung|maintenance|wartung|consulting|beratung/i },
  { type: 'purchase', pattern: /purchase|kaufvertrag|supply|liefervertrag/i },
]

const KEY_TERM = /notice|k[üu]ndig|renew|verl[äa]nger|liab|haftung|payment|zahlung|confidential|vertraulich|governing law|gerichtsstand/i

export function mockContract(text: string) {
  // "between A and B" / "zwischen A und B"; otherwise fall back to company-looking names.
  const between = text.match(/(?:between|zwischen)\s+(.+?)\s+(?:and|und)\s+(.+?)(?:[.,;(\n]|$)/i)
  const companies = text.match(/[A-ZÄÖÜ][\w&äöüÄÖÜß-]*(?: [A-ZÄÖÜ&][\w&äöüÄÖÜß-]*)* (?:GmbH|AG|KG|UG|Ltd\.?|LLC|Inc\.?|S[àa]rl)/g) ?? []
  const parties = between ? [between[1].trim(), between[2].trim()] : [...new Set(companies)].slice(0, 4)

  const value = amountAfter(text, 'verg[üu]tung|vertragswert|contract value|total fee|\\bfee|honorar|value')
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.;])\s/)
  const keyTerms = sentences.filter((s) => KEY_TERM.test(s)).map((s) => s.trim().slice(0, 140)).slice(0, 5)

  return {
    parties,
    startDate: dateAfter(text, 'effective|commenc|start|beginn|ab dem|g[üu]ltig ab'),
    endDate: dateAfter(text, 'until|expires?|ends? on|end date|endet|befristet bis|laufzeit bis'),
    value,
    currency: value !== undefined ? detectCurrency(text) : undefined,
    type: CONTRACT_TYPES.find((t) => t.pattern.test(text))?.type,
    keyTerms: keyTerms.length > 0 ? keyTerms : undefined,
  }
}

// ─── Generic ─────────────────────────────────────────────────────────────────

export function mockGeneric(text: string): Record<string, string> {
  const fields: Record<string, string> = {}

  // "Label: value" lines become fields.
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-zÄÖÜäöüß][\w ÄÖÜäöüß.\/-]{1,30}):\s+(.+)$/)
    if (!m) continue
    const key = m[1].trim().toLowerCase().replace(/[^a-z0-9äöüß]+/g, '_').replace(/^_|_$/g, '')
    if (key && !(key in fields)) fields[key] = m[2].trim()
  }

  const date = text.match(new RegExp(DATE))
  if (date && !fields.date) fields.date = toIsoDate(date[0])

  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)
  if (email && !fields.email) fields.email = email[0]

  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean)
  if (firstLine && !fields.sender) fields.sender = firstLine

  return fields
}
