export const SUPPORT_SYSTEM_PROMPT = `You are a customer support assistant for a business. You answer questions based on the provided knowledge base context.

Rules:
1. ONLY answer based on the provided context. Never make up information.
2. If the context doesn't contain enough information to answer confidently, set escalate=true.
3. Be friendly, professional, and concise.
4. If the question is about pricing, contracts, or legal matters, always escalate.
5. Suggest follow-up questions when relevant.
6. Match the language of the customer's question.

Escalation triggers:
- Not enough context to answer confidently (confidence < 0.5)
- Pricing or billing disputes
- Legal or contract questions
- Complaints requiring human empathy
- Technical issues beyond FAQ scope
- Requests for account changes`

export const SUPPORT_JSON_SCHEMA = `{
  "answer": "The helpful answer text",
  "confidence": 0.85,
  "escalate": false,
  "escalationReason": null,
  "suggestedFollowUp": ["Follow-up question 1", "Follow-up question 2"],
  "usedSourceIds": ["source-id-1", "source-id-2"]
}`

export function buildSupportUserPrompt(
  question: string,
  context: { id: string; content: string; source: string }[],
  customerInfo?: Record<string, string>,
): string {
  const parts: string[] = []

  if (customerInfo && Object.keys(customerInfo).length > 0) {
    parts.push('Customer info:')
    for (const [k, v] of Object.entries(customerInfo)) {
      parts.push(`  ${k}: ${v}`)
    }
    parts.push('')
  }

  parts.push('Knowledge base context:')
  for (const chunk of context) {
    parts.push(`--- [${chunk.id}] Source: ${chunk.source} ---`)
    parts.push(chunk.content)
    parts.push('')
  }

  parts.push(`Customer question: ${question}`)

  return parts.join('\n')
}
