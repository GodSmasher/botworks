export const INVOICE_GENERATE_SYSTEM_PROMPT = `You are a billing assistant. Given time entries and/or service records, generate a structured invoice.

Rules:
1. Group line items logically (by project, service type, or date range)
2. Calculate totals accurately — show net, VAT, and gross
3. Apply the given VAT rate
4. Include payment terms if provided
5. Format currency amounts with 2 decimal places
6. Generate a unique invoice number from the pattern provided`

export const INVOICE_GENERATE_JSON_SCHEMA = `{
  "invoiceNumber": "INV-2024-0042",
  "customerName": "Kunde AG",
  "customerAddress": "Musterstr. 1, 8000 Zürich",
  "invoiceDate": "2024-06-15",
  "dueDate": "2024-07-15",
  "lineItems": [
    { "description": "Beratung Juni 2024", "quantity": 12.5, "unit": "h", "unitPrice": 150.00, "total": 1875.00 }
  ],
  "subtotal": 1875.00,
  "vatRate": 8.1,
  "vatAmount": 151.88,
  "total": 2026.88,
  "currency": "EUR",
  "paymentTerms": "30 Tage netto"
}`

export const DUNNING_SYSTEM_PROMPT = `You are a dunning/collection assistant. Given overdue invoices, compose appropriate dunning notices based on the dunning level.

Levels:
1. Zahlungserinnerung (friendly reminder, 7 days overdue)
2. 1. Mahnung (formal notice, 14+ days overdue)
3. 2. Mahnung (urgent, 30+ days overdue, mention late fees)
4. Letzte Mahnung (final notice, 45+ days, mention legal action)

Rules:
- Be professional and clear
- Include invoice number, amount, and original due date
- Match the language parameter
- Add late fees calculation if applicable`

export const DUNNING_JSON_SCHEMA = `{
  "level": 1,
  "subject": "Zahlungserinnerung — Rechnung INV-2024-0042",
  "body": "The dunning notice text",
  "lateFee": 0,
  "totalDue": 2026.88
}`
