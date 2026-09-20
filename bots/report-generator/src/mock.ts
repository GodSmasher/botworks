// Offline (mock mode) analysis for the report-generator bot.
// Plain arithmetic on the provided rows instead of a model call.

type Row = Record<string, unknown>

interface MockSection {
  title: string
  type: string
  data?: Row[]
}

const PREVIOUS_KEYS = ['previous', 'previousValue', 'prev', 'vorperiode', 'vorjahr', 'vormonat']
const VALUE_KEYS = ['value', 'current', 'wert', 'aktuell']

const TEXT = {
  de: {
    change: (label: string, cur: string, prev: string, pct: string) => `${label}: ${cur} (Vorperiode ${prev}, ${pct})`,
    column: (col: string, total: string, avg: string) => `${col}: Summe ${total}, Durchschnitt ${avg}`,
    peak: (col: string, label: string, val: string) => `Höchster Wert bei ${col}: ${label} (${val})`,
    rows: (n: number) => `${n} Datensätze ohne numerische Werte.`,
    summary: (title: string, n: number, up: number, down: number) =>
      `Der Bericht "${title}" umfasst ${n} Abschnitt(e). ${up} Kennzahl(en) sind gegenüber der Vorperiode gestiegen, ${down} gesunken.`,
    investigate: (label: string, pct: string) => `Den Rückgang bei "${label}" (${pct}) einordnen und bei Bedarf Gegenmaßnahmen festlegen.`,
    reviewIncrease: (label: string, pct: string) => `Prüfen, ob der Anstieg bei "${label}" (${pct}) nachhaltig ist, und die Treiber dokumentieren.`,
    fallback: 'Kennzahlen in der nächsten Periode erneut prüfen, um Trends zu erkennen.',
  },
  en: {
    change: (label: string, cur: string, prev: string, pct: string) => `${label}: ${cur} (previous period ${prev}, ${pct})`,
    column: (col: string, total: string, avg: string) => `${col}: total ${total}, average ${avg}`,
    peak: (col: string, label: string, val: string) => `Highest ${col}: ${label} (${val})`,
    rows: (n: number) => `${n} records without numeric values.`,
    summary: (title: string, n: number, up: number, down: number) =>
      `The report "${title}" covers ${n} section(s). ${up} metric(s) rose compared to the previous period, ${down} fell.`,
    investigate: (label: string, pct: string) => `Assess the decline in "${label}" (${pct}) and define countermeasures where needed.`,
    reviewIncrease: (label: string, pct: string) => `Check whether the increase in "${label}" (${pct}) is sustainable and document its drivers.`,
    fallback: 'Review the metrics again next period to identify trends.',
  },
}

function wording(language: string) {
  return language.toLowerCase().startsWith('de') ? TEXT.de : TEXT.en
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function pct(current: number, previous: number): string {
  const change = ((current - previous) / Math.abs(previous)) * 100
  return `${change >= 0 ? '+' : ''}${fmt(change)} %`
}

function findKey(row: Row, candidates: string[]): string | undefined {
  return candidates.find((k) => typeof row[k] === 'number')
}

/** First string field of a row serves as its label. */
function rowLabel(row: Row, index: number): string {
  const label = Object.values(row).find((v) => typeof v === 'string')
  return typeof label === 'string' ? label : `#${index + 1}`
}

interface Change { label: string; current: number; previous: number }

/** Rows shaped like { name, value, previous } → period-over-period changes. */
function extractChanges(data: Row[]): Change[] {
  const changes: Change[] = []
  data.forEach((row, i) => {
    const valueKey = findKey(row, VALUE_KEYS)
    const previousKey = findKey(row, PREVIOUS_KEYS)
    if (!valueKey || !previousKey || row[previousKey] === 0) return
    changes.push({ label: rowLabel(row, i), current: row[valueKey] as number, previous: row[previousKey] as number })
  })
  return changes
}

function analyse(data: Row[], language: string): string[] {
  const t = wording(language)

  const changes = extractChanges(data)
  if (changes.length > 0) {
    return changes.map((c) => t.change(c.label, fmt(c.current), fmt(c.previous), pct(c.current, c.previous)))
  }

  // Generic rows: total, average and peak per numeric column
  const numericColumns = Object.keys(data[0]).filter((k) => data.every((r) => typeof r[k] === 'number'))
  const lines: string[] = []
  for (const col of numericColumns) {
    const values = data.map((r) => r[col] as number)
    const total = values.reduce((a, b) => a + b, 0)
    const peakIndex = values.indexOf(Math.max(...values))
    lines.push(t.column(col, fmt(total), fmt(total / values.length)))
    lines.push(t.peak(col, rowLabel(data[peakIndex], peakIndex), fmt(values[peakIndex])))
  }
  return lines.length > 0 ? lines : [t.rows(data.length)]
}

export function mockSectionAnalysis(section: MockSection, language: string) {
  const highlights = analyse(section.data ?? [], language)
  return {
    title: section.title,
    content: highlights.map((h) => `- ${h}`).join('\n'),
    highlights: highlights.slice(0, 3),
  }
}

export function mockReportSummary(title: string, sections: MockSection[], language: string) {
  const t = wording(language)
  const analysed = sections.filter((s) => (s.type === 'kpi' || s.type === 'summary') && s.data && s.data.length > 0)

  const changes = analysed.flatMap((s) => extractChanges(s.data ?? []))
  const increased = changes.filter((c) => c.current >= c.previous)
  const declined = changes.filter((c) => c.current < c.previous)

  const keyFindings = analysed.flatMap((s) => analyse(s.data ?? [], language).slice(0, 2)).slice(0, 5)

  const recommendations = [
    ...declined.slice(0, 2).map((c) => t.investigate(c.label, pct(c.current, c.previous))),
    ...increased.slice(0, 1).map((c) => t.reviewIncrease(c.label, pct(c.current, c.previous))),
  ]
  if (recommendations.length === 0) recommendations.push(t.fallback)

  return {
    summary: t.summary(title, sections.length, increased.length, declined.length),
    keyFindings,
    recommendations,
  }
}
