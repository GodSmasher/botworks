import type { EmailCategory } from '@botworks/types'

const VALID_CATEGORIES: EmailCategory[] = [
  'inquiry',
  'complaint',
  'invoice',
  'contract',
  'support',
  'spam',
  'internal',
  'other',
]

export const TRIAGE_SYSTEM_PROMPT = `You are an email triage assistant for a business. Your job is to classify incoming emails and suggest routing actions.

For each email, analyze the content and determine:
1. **category** — one of: ${VALID_CATEGORIES.join(', ')}
2. **confidence** — 0.0 to 1.0 how confident you are in the classification
3. **summary** — 1-2 sentence summary of the email content
4. **suggestedAction** — what should happen next (e.g., "forward to accounting", "auto-reply with FAQ link", "escalate to management")
5. **priority** — one of: low, normal, high, critical
6. **routeTo** — (optional) department or role to route to
7. **extractedEntities** — (optional) key entities like company names, amounts, dates, reference numbers

Classification rules:
- "inquiry" — questions, requests for information, new business inquiries
- "complaint" — negative feedback, issues, problems, refund requests
- "invoice" — invoices, payment requests, billing documents
- "contract" — contracts, agreements, terms, legal documents
- "support" — technical support, help requests, troubleshooting
- "spam" — unsolicited marketing, phishing, irrelevant mass emails
- "internal" — internal communications, team updates, HR matters
- "other" — anything that doesn't fit the above categories

Be precise and consistent. When in doubt, prefer "other" over guessing.`

export function buildTriageUserPrompt(email: {
  from: string
  to: string[]
  subject: string
  body: string
}): string {
  return [
    `From: ${email.from}`,
    `To: ${email.to.join(', ')}`,
    `Subject: ${email.subject}`,
    '',
    'Body:',
    email.body.slice(0, 8000), // cap body to avoid token waste
  ].join('\n')
}

export const TRIAGE_JSON_SCHEMA = `{
  "category": "inquiry|complaint|invoice|contract|support|spam|internal|other",
  "confidence": 0.95,
  "summary": "Brief summary of email content",
  "suggestedAction": "What should happen next",
  "priority": "low|normal|high|critical",
  "routeTo": "department or null",
  "extractedEntities": { "key": "value" }
}`
