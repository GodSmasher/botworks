import type { DocumentType } from '@botworks/types'

const VALID_TYPES: DocumentType[] = [
  'invoice', 'contract', 'report', 'receipt', 'letter', 'form', 'other',
]

export const CLASSIFY_SYSTEM_PROMPT = `You are a document classification assistant. Given the text content of a document, determine its type.

Valid document types: ${VALID_TYPES.join(', ')}

Classification rules:
- "invoice" — bills, payment requests, contains amounts/totals, vendor info, invoice numbers
- "contract" — agreements, terms, signatures, legal language, parties involved
- "report" — analysis, summaries, data tables, quarterly/annual reports
- "receipt" — proof of payment, transaction confirmations, POS receipts
- "letter" — formal correspondence, cover letters, notifications
- "form" — fillable documents, applications, registrations
- "other" — anything that doesn't fit the above`

export const CLASSIFY_JSON_SCHEMA = `{
  "type": "invoice|contract|report|receipt|letter|form|other",
  "confidence": 0.95
}`

export const INVOICE_EXTRACT_SYSTEM_PROMPT = `You are a document data extraction assistant specialized in invoices.

Extract all relevant fields from the invoice text. Be precise with numbers — use the exact values shown.

For amounts: use numeric values (no currency symbols in the number). Identify the currency separately.
For dates: use ISO format YYYY-MM-DD.
For line items: extract each individual item with description, quantity, unit price, and total.`

export const INVOICE_JSON_SCHEMA = `{
  "invoiceNumber": "INV-2024-001",
  "vendor": "Company Name",
  "date": "2024-01-15",
  "dueDate": "2024-02-15",
  "totalGross": 1190.00,
  "totalNet": 1000.00,
  "vatAmount": 190.00,
  "vatRate": 19.0,
  "currency": "EUR",
  "lineItems": [
    { "description": "Item description", "quantity": 2, "unitPrice": 500.00, "total": 1000.00 }
  ]
}`

export const CONTRACT_EXTRACT_SYSTEM_PROMPT = `You are a document data extraction assistant specialized in contracts.

Extract key information from the contract text:
- Parties involved (all named entities that are signatories)
- Start and end dates
- Contract value/amount
- Type of contract (service, employment, lease, NDA, etc.)
- Key terms and conditions (summarize important clauses)

For dates: use ISO format YYYY-MM-DD.
For amounts: use numeric values.`

export const CONTRACT_JSON_SCHEMA = `{
  "parties": ["Party A GmbH", "Party B AG"],
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "value": 50000.00,
  "currency": "EUR",
  "type": "service",
  "keyTerms": ["30-day notice period", "Automatic renewal"]
}`

export const GENERIC_EXTRACT_SYSTEM_PROMPT = `You are a document data extraction assistant.

Extract all structured information from the document text. Identify:
- Key entities (people, companies, addresses)
- Dates
- Amounts/numbers
- Reference numbers
- Any structured data points

Return a flat key-value map of extracted fields.`

export const GENERIC_JSON_SCHEMA = `{
  "field_name": "extracted value",
  "another_field": "another value"
}`
