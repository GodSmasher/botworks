// Offline (mock mode) answers for the billing bot: arithmetic on the given entries and text templates.

export interface MockTimeEntry {
  date: string
  hours: number
  description: string
  project?: string
  rate?: number
}

export interface MockInvoiceInput {
  timeEntries?: MockTimeEntry[]
  customerName?: string
  customerAddress?: string
  defaultRate?: number
  vatRate: number
  currency: string
  invoiceNumberPattern: string
  paymentTerms: string
}

export interface MockOverdueInvoice {
  invoiceNumber: string
  customerName: string
  amount: number
  currency: string
  dueDate: string
  daysPastDue: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/** Invoice date = latest time entry date; falls back to today when there are no usable dates. */
function invoiceDateFor(entries: MockTimeEntry[]): string {
  const dates = entries.map((e) => e.date).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort()
  return dates.length > 0 ? dates[dates.length - 1].slice(0, 10) : new Date().toISOString().split('T')[0]
}

/** One line item per project + hourly rate; hours are summed. */
export function mockInvoice(input: MockInvoiceInput) {
  const entries = input.timeEntries ?? []
  const groups = new Map<string, { project: string; rate: number; hours: number; from: string; to: string }>()

  for (const entry of entries) {
    const project = entry.project ?? 'Dienstleistungen'
    const rate = entry.rate ?? input.defaultRate ?? 0
    const key = `${project}|${rate}`
    const group = groups.get(key)
    if (group) {
      group.hours += entry.hours
      if (entry.date < group.from) group.from = entry.date
      if (entry.date > group.to) group.to = entry.date
    } else {
      groups.set(key, { project, rate, hours: entry.hours, from: entry.date, to: entry.date })
    }
  }

  const lineItems = [...groups.values()].map((g) => ({
    description: g.from === g.to ? `${g.project} (${g.from})` : `${g.project} (${g.from} – ${g.to})`,
    quantity: round2(g.hours),
    unit: 'h',
    unitPrice: round2(g.rate),
    total: round2(g.hours * g.rate),
  }))

  const invoiceDate = invoiceDateFor(entries)
  // First number in the payment terms is taken as the payment period in days ("30 Tage netto" -> 30).
  const termDays = Number(input.paymentTerms.match(/\d+/)?.[0] ?? 30)
  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.total, 0))
  const vatAmount = round2(subtotal * input.vatRate / 100)

  return {
    invoiceNumber: input.invoiceNumberPattern
      .replace('{YEAR}', invoiceDate.slice(0, 4))
      .replace('{SEQ}', '0001'),
    customerName: input.customerName ?? 'Unknown',
    ...(input.customerAddress ? { customerAddress: input.customerAddress } : {}),
    invoiceDate,
    dueDate: addDays(invoiceDate, termDays),
    lineItems,
    subtotal,
    vatRate: input.vatRate,
    vatAmount,
    total: round2(subtotal + vatAmount),
    currency: input.currency,
    paymentTerms: input.paymentTerms,
  }
}

const LEVEL_TITLES_DE = ['Zahlungserinnerung', '1. Mahnung', '2. Mahnung', 'Letzte Mahnung']
const LEVEL_TITLES_EN = ['Payment reminder', 'First dunning notice', 'Second dunning notice', 'Final notice']

/** Dunning notice from a text template; late fee (annual rate, pro rata by days overdue) from level 3 on. */
export function mockDunning(inv: MockOverdueInvoice, level: number, lateFeePercent: number, language: string) {
  const german = language.toLowerCase().startsWith('de')
  const idx = Math.min(Math.max(level, 1), 4) - 1
  const lateFee = level >= 3 ? round2(inv.amount * (lateFeePercent / 100) * (inv.daysPastDue / 365)) : 0
  const totalDue = round2(inv.amount + lateFee)
  const amount = `${inv.amount.toFixed(2)} ${inv.currency}`
  const total = `${totalDue.toFixed(2)} ${inv.currency}`
  const fee = `${lateFee.toFixed(2)} ${inv.currency}`

  const levelSentenceDe = [
    'Sicher handelt es sich um ein Versehen. Wir bitten Sie, den Betrag in den nächsten Tagen zu überweisen.',
    'Bitte begleichen Sie den offenen Betrag innerhalb von 7 Tagen.',
    `Wir berechnen Verzugszinsen von ${fee} (${lateFeePercent} % p. a.). Bitte überweisen Sie ${total} innerhalb von 7 Tagen.`,
    `Inklusive Verzugszinsen (${fee}) sind ${total} offen. Geht der Betrag nicht innerhalb von 5 Tagen ein, leiten wir rechtliche Schritte ein.`,
  ][idx]

  const levelSentenceEn = [
    'This has probably just been overlooked. Please transfer the amount within the next few days.',
    'Please settle the outstanding amount within 7 days.',
    `We are charging late interest of ${fee} (${lateFeePercent}% p.a.). Please transfer ${total} within 7 days.`,
    `Including late interest (${fee}), ${total} is outstanding. If we do not receive payment within 5 days, we will take legal action.`,
  ][idx]

  const body = german
    ? [
        `Guten Tag ${inv.customerName},`,
        '',
        `unsere Rechnung ${inv.invoiceNumber} über ${amount} war am ${inv.dueDate} fällig und ist seit ${inv.daysPastDue} Tagen offen.`,
        levelSentenceDe,
        '',
        'Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.',
        '',
        'Freundliche Grüsse',
      ]
    : [
        `Dear ${inv.customerName},`,
        '',
        `our invoice ${inv.invoiceNumber} for ${amount} was due on ${inv.dueDate} and has been outstanding for ${inv.daysPastDue} days.`,
        levelSentenceEn,
        '',
        'If your payment has crossed with this letter, please disregard it.',
        '',
        'Kind regards',
      ]

  const title = (german ? LEVEL_TITLES_DE : LEVEL_TITLES_EN)[idx]

  return {
    level,
    subject: `${title} — ${german ? 'Rechnung' : 'Invoice'} ${inv.invoiceNumber}`,
    body: body.join('\n'),
    lateFee,
    totalDue,
  }
}
