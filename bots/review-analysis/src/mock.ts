// Offline (mock mode) review analysis: word lists for sentiment, keyword lists for themes.

export interface MockReview {
  id: string
  text: string
  rating?: number
}

type Sentiment = 'positive' | 'neutral' | 'negative'

// Letter-aware word boundaries (\b does not treat umlauts as word characters).
const POSITIVE = /(?<!\p{L})(super|toll|top|great|excellent|perfekt|perfect|freundlich|friendly|schnell|fast|quick|empfehle|empfehlen|recommend|zufrieden|happy|love|liebe|begeistert|hervorragend|gut|good|gerne|best|beste|lecker|kompetent|hilfsbereit|helpful)(?!\p{L})/giu
const NEGATIVE = /(?<!\p{L})(schlecht|bad|terrible|furchtbar|enttäuscht|enttäuschend|disappointed|disappointing|langsam|slow|unfreundlich|rude|kaputt|defekt|broken|nie wieder|never again|teuer|expensive|überteuert|verspätet|late|delayed|ärgerlich|annoying|mangelhaft|poor|problem|probleme|fehler|reklamation|warten|gewartet|waiting)(?!\p{L})/giu

interface Theme {
  de: string
  en: string
  keywords: RegExp
  adviceDe: string
  adviceEn: string
}

const THEMES: Theme[] = [
  {
    de: 'Kundenservice', en: 'Customer service',
    keywords: /service|support|beratung|mitarbeiter|personal|staff|hotline|freundlich|unfreundlich|friendly|rude|antwort|response/i,
    adviceDe: 'Kundenservice: Antwortzeiten messen und das Team im Umgang mit Beschwerden schulen.',
    adviceEn: 'Customer service: track response times and train the team in handling complaints.',
  },
  {
    de: 'Lieferung', en: 'Delivery',
    keywords: /liefer|versand|delivery|shipping|paket|zustellung|verspätet|delayed|angekommen|arrived/i,
    adviceDe: 'Lieferung: realistische Lieferzeiten kommunizieren und bei Verzögerungen aktiv informieren.',
    adviceEn: 'Delivery: communicate realistic delivery times and proactively notify customers about delays.',
  },
  {
    de: 'Preis-Leistung', en: 'Value for money',
    keywords: /preis|price|teuer|expensive|günstig|cheap|kosten|wert|worth|überteuert/i,
    adviceDe: 'Preis-Leistung: Preisgestaltung prüfen und den Mehrwert klarer kommunizieren.',
    adviceEn: 'Value for money: review pricing and communicate the added value more clearly.',
  },
  {
    de: 'Produktqualität', en: 'Product quality',
    keywords: /qualität|quality|verarbeitung|kaputt|defekt|broken|material|haltbar|mangelhaft|geschmack|lecker/i,
    adviceDe: 'Produktqualität: gemeldete Mängel auswerten und die Qualitätskontrolle vor dem Versand verschärfen.',
    adviceEn: 'Product quality: analyse reported defects and tighten quality control before shipping.',
  },
  {
    de: 'Wartezeit', en: 'Waiting time',
    keywords: /warte|gewartet|waiting|wait\b|langsam|slow|schnell|fast\b|quick|termin/i,
    adviceDe: 'Wartezeit: Stosszeiten analysieren und Personal- bzw. Terminplanung anpassen.',
    adviceEn: 'Waiting time: analyse peak hours and adjust staffing or scheduling.',
  },
  {
    de: 'Bedienbarkeit', en: 'Usability',
    keywords: /app\b|website|webseite|bedienung|usability|bestellvorgang|checkout|login|online-shop|onlineshop/i,
    adviceDe: 'Bedienbarkeit: die genannten Hürden im Bestellprozess nachstellen und beheben.',
    adviceEn: 'Usability: reproduce and fix the reported hurdles in the ordering process.',
  },
]

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))
const round1 = (n: number): number => Math.round(n * 10) / 10
const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0

/** Score 1-10: word balance around a neutral 5.5, averaged with the star rating (x2) when one is given. */
function scoreReview(review: MockReview): number {
  const wordScore = clamp(5.5 + 1.5 * (count(review.text, POSITIVE) - count(review.text, NEGATIVE)), 1, 10)
  const score = review.rating !== undefined ? (wordScore + review.rating * 2) / 2 : wordScore
  return round1(clamp(score, 1, 10))
}

function sentimentOf(score: number): Sentiment {
  if (score >= 6.5) return 'positive'
  if (score <= 4.5) return 'negative'
  return 'neutral'
}

/** First sentence, cut to at most `maxWords` words. */
function shortQuote(text: string, maxWords: number): string {
  const sentence = text.trim().split(/(?<=[.!?])\s+/)[0] ?? ''
  const words = sentence.split(/\s+/)
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')} …` : sentence
}

function dominant(sentiments: Sentiment[]): Sentiment {
  const pos = sentiments.filter((s) => s === 'positive').length
  const neg = sentiments.filter((s) => s === 'negative').length
  if (pos > neg) return 'positive'
  if (neg > pos) return 'negative'
  return 'neutral'
}

export function mockReviewAnalysis(reviews: MockReview[], language: string) {
  const german = language.toLowerCase().startsWith('de')

  const analysed = reviews.map((review) => {
    const score = scoreReview(review)
    const themes = THEMES.filter((t) => t.keywords.test(review.text))
    return { review, score, sentiment: sentimentOf(score), themes }
  })

  const percent = (s: Sentiment): number =>
    Math.round((analysed.filter((a) => a.sentiment === s).length / analysed.length) * 100)

  const topThemes = THEMES
    .map((theme) => {
      const hits = analysed.filter((a) => a.themes.includes(theme))
      return { theme, mentions: hits.length, sentiment: dominant(hits.map((h) => h.sentiment)) }
    })
    .filter((t) => t.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions)

  const recommendations = topThemes
    .filter((t) => t.sentiment !== 'positive')
    .map((t) => (german ? t.theme.adviceDe : t.theme.adviceEn))
  const praised = topThemes.find((t) => t.sentiment === 'positive')
  if (praised) {
    recommendations.push(german
      ? `Stärke "${praised.theme.de}" in Marketing und Antworten auf Bewertungen hervorheben.`
      : `Highlight the strength "${praised.theme.en}" in marketing and review replies.`)
  }
  if (recommendations.length === 0) {
    recommendations.push(german
      ? 'Keine klaren Muster erkennbar; mehr Bewertungen sammeln und erneut auswerten.'
      : 'No clear patterns yet; collect more reviews and analyse again.')
  }

  const byScore = [...analysed].sort((a, b) => b.score - a.score)
  const best = byScore[0]
  const worst = byScore[byScore.length - 1]

  return {
    reviews: analysed.map((a) => ({
      id: a.review.id,
      sentiment: a.sentiment,
      score: a.score,
      themes: a.themes.map((t) => (german ? t.de : t.en)),
      summary: shortQuote(a.review.text, 20),
    })),
    overallScore: round1(analysed.reduce((sum, a) => sum + a.score, 0) / analysed.length),
    sentimentBreakdown: { positive: percent('positive'), neutral: percent('neutral'), negative: percent('negative') },
    topThemes: topThemes.map((t) => ({ theme: german ? t.theme.de : t.theme.en, mentions: t.mentions, sentiment: t.sentiment })),
    recommendations,
    // Quotes only make sense when there is both a positive and a negative review.
    ...(best.sentiment === 'positive' && worst.sentiment === 'negative'
      ? { highlights: { bestQuote: shortQuote(best.review.text, 15), worstQuote: shortQuote(worst.review.text, 15) } }
      : {}),
  }
}
