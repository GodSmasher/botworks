// Offline (mock mode) expense categorization: keyword matching on description, vendor and receipt text.

export interface MockExpense {
  id: string
  description: string
  amount: number
  vendor?: string
  receiptText?: string
}

interface CategoryRule {
  category: string
  subcategory: string
  keywords: RegExp
}

// Checked top to bottom; the rule with the most keyword hits wins (first rule wins ties).
const RULES: CategoryRule[] = [
  { category: 'Personalaufwand', subcategory: 'Löhne & Sozialabgaben', keywords: /lohn|gehalt|salary|payroll|sozialversicherung|ahv|weiterbildung/gi },
  { category: 'Reisekosten', subcategory: 'Reise & Unterkunft', keywords: /hotel|übernachtung|bahn|\bzug\b|train|flug|flight|taxi|reise|travel|bewirtung|restaurant|geschäftsessen/gi },
  { category: 'Fahrzeugkosten', subcategory: 'Fahrzeug', keywords: /tankstelle|benzin|diesel|fuel|leasing|werkstatt|reifen|kfz|fahrzeug|parkhaus|parking/gi },
  { category: 'IT & Software', subcategory: 'Lizenzen & Hosting', keywords: /software|lizenz|license|hosting|cloud|domain|saas|laptop|notebook|monitor|server/gi },
  { category: 'Marketing', subcategory: 'Werbung', keywords: /werbung|anzeige|advertis|kampagne|campaign|messe|flyer|marketing|sponsoring/gi },
  { category: 'Beratung', subcategory: 'Beratung & Recht', keywords: /steuerberat|anwalt|rechtsberat|notar|consulting|beratung|treuhand/gi },
  { category: 'Betriebsaufwand', subcategory: 'Raum & Versicherung', keywords: /miete|\brent\b|strom|heizung|nebenkosten|versicherung|insurance|reinigung/gi },
  { category: 'Bürokosten', subcategory: 'Büromaterial', keywords: /büro|papier|toner|drucker|porto|briefmarken|office|\babo\b|subscription|zeitschrift/gi },
  { category: 'Materialaufwand', subcategory: 'Material', keywords: /material|rohstoff|holz|schrauben|ersatzteil|verpackung|werkzeug|supplies/gi },
]

const NOT_DEDUCTIBLE = /privat|private|bussgeld|bußgeld|strafzettel|fine\b/i
const PARTLY_DEDUCTIBLE = /bewirtung|geschäftsessen|geschenk|gift/i

// "MwSt 19%: 15,20", "VAT 12.50", "USt. 7 % 3,85" -> the amount with two decimals after the tax keyword.
const VAT_PATTERN = /\b(?:mwst|ust|vat|umsatzsteuer|mehrwertsteuer)\b\.?[^\d\n]*(?:\d{1,2}(?:[.,]\d)?\s*%[^\d\n]*)?(\d+[.,]\d{2})/i

const round2 = (n: number): number => Math.round(n * 100) / 100

function extractVat(text: string): number | undefined {
  const match = text.match(VAT_PATTERN)
  return match ? Number(match[1].replace(',', '.')) : undefined
}

function categorize(expense: MockExpense, customCategories: string[]) {
  const text = [expense.description, expense.vendor ?? '', expense.receiptText ?? ''].join(' ')

  // A custom category named literally in the expense text beats the standard rules.
  const custom = customCategories.find((c) => text.toLowerCase().includes(c.toLowerCase()))

  let best: CategoryRule | undefined
  let bestHits = 0
  for (const rule of RULES) {
    const hits = text.match(rule.keywords)?.length ?? 0
    if (hits > bestHits) {
      best = rule
      bestHits = hits
    }
  }

  const category = custom ?? best?.category ?? 'Sonstiges'
  const confidence = custom ? 0.9 : bestHits >= 2 ? 0.9 : bestHits === 1 ? 0.75 : 0.3

  const notes: string[] = []
  const notDeductible = NOT_DEDUCTIBLE.test(text)
  if (notDeductible) notes.push('Looks like a private or non-deductible expense')
  if (PARTLY_DEDUCTIBLE.test(text)) notes.push('Entertainment/gifts are usually only partly deductible')
  if (bestHits === 0 && !custom) notes.push('No category keyword found')
  if (expense.amount >= 1000 && !expense.receiptText) notes.push('Large amount without receipt text')

  const vatAmount = extractVat(text)

  return {
    id: expense.id,
    category,
    ...(best && !custom ? { subcategory: best.subcategory } : {}),
    confidence,
    taxDeductible: !notDeductible,
    ...(vatAmount !== undefined ? { vatAmount } : {}),
    needsReview: notes.length > 0,
    ...(notes.length > 0 ? { notes: notes.join('; ') } : {}),
  }
}

export function mockCategorization(batch: MockExpense[], customCategories: string[] = []) {
  const categorizedItems = batch.map((e) => categorize(e, customCategories))

  const byCategory: Record<string, number> = {}
  for (const item of categorizedItems) byCategory[item.category] = (byCategory[item.category] ?? 0) + 1

  return {
    categorizedItems,
    summary: {
      totalItems: categorizedItems.length,
      byCategory,
      needsReview: categorizedItems.filter((i) => i.needsReview).length,
      totalAmount: round2(batch.reduce((sum, e) => sum + e.amount, 0)),
      totalVat: round2(categorizedItems.reduce((sum, i) => sum + (i.vatAmount ?? 0), 0)),
    },
  }
}
