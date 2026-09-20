export const NORMALIZE_SYSTEM_PROMPT = `You are a data normalization assistant. Given raw, unstructured input data about a person or organization, extract and normalize the fields into a clean, standardized format.

Rules:
1. Normalize names to proper case (e.g., "JOHN DOE" → "John Doe")
2. Normalize phone numbers to international format with country code (e.g., +41 79 123 45 67)
3. Normalize dates to ISO format YYYY-MM-DD
4. Normalize addresses into structured fields (street, city, zip, country)
5. Extract email addresses and validate format
6. For ambiguous fields, make your best guess and mark confidence accordingly
7. Flag any fields that look invalid or incomplete as validation errors

Return the normalized data and any validation issues found.`

export const NORMALIZE_JSON_SCHEMA = `{
  "normalizedData": {
    "first_name": "Max",
    "last_name": "Mustermann",
    "email": "max@example.com",
    "phone": "+41 79 123 45 67",
    "company": "Firma AG",
    "street": "Musterstrasse 1",
    "zip": "8000",
    "city": "Zürich",
    "country": "CH",
    "notes": "Additional info"
  },
  "validationErrors": [
    { "field": "phone", "message": "Phone number format unclear", "severity": "warning" }
  ]
}`

export const DISTRIBUTION_SYSTEM_PROMPT = `You are a data distribution planner. Given a normalized entity record and a list of target systems, determine which fields should be sent to which system.

Return a distribution plan mapping each target system to the relevant payload.`

export const DISTRIBUTION_JSON_SCHEMA = `{
  "distributions": [
    {
      "system": "crm",
      "fields": { "name": "Max Mustermann", "email": "max@example.com" }
    }
  ]
}`
