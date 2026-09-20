// Offline (mock mode) HR request processing for the employee-mgmt bot.

type RequestType = 'vacation' | 'sick_leave' | 'data_change' | 'onboarding' | 'offboarding'
type Priority = 'low' | 'normal' | 'high'

interface MockInput {
  requestText: string
  employeeName?: string
  managerId?: string
  existingData?: Record<string, unknown>
}

// Order matters: the first matching pattern wins
const TYPE_PATTERNS: Array<[RequestType, RegExp]> = [
  ['offboarding', /kündig|austritt|letzter arbeitstag|offboarding|resign|last day|leaving the company/i],
  ['onboarding', /onboarding|neue[rn]? (mitarbeiter|kolleg)|eintritt|fängt .* an|new hire|new employee|starts on/i],
  ['sick_leave', /krank|arbeitsunfähig|\bau\b|attest|sick|doctor|unwell/i],
  ['vacation', /urlaub|frei nehmen|freie tage|ferien|vacation|holiday|annual leave|time off|\bpto\b/i],
  ['data_change', /adresse|umgezogen|umzug|iban|bankverbindung|konto|nachname|telefonnummer|address|moved|bank|phone number|surname/i],
]

const ACTIONS: Record<RequestType, Array<{ step: string; system: string; priority: Priority }>> = {
  vacation: [
    { step: 'Request approval from manager', system: 'email', priority: 'high' },
    { step: 'Block absence in team calendar', system: 'calendar', priority: 'normal' },
    { step: 'Deduct days from vacation balance', system: 'hr_system', priority: 'normal' },
  ],
  sick_leave: [
    { step: 'Notify manager about absence', system: 'email', priority: 'high' },
    { step: 'Mark absence in team calendar', system: 'calendar', priority: 'normal' },
    { step: 'Record sick leave and track doctor\'s note', system: 'hr_system', priority: 'normal' },
  ],
  data_change: [
    { step: 'Update employee master data', system: 'hr_system', priority: 'normal' },
    { step: 'Forward change to payroll', system: 'payroll', priority: 'normal' },
    { step: 'Confirm change to employee', system: 'email', priority: 'low' },
  ],
  onboarding: [
    { step: 'Create accounts and order hardware', system: 'it_ticket', priority: 'high' },
    { step: 'Create personnel file and contract documents', system: 'hr_system', priority: 'high' },
    { step: 'Schedule first-day welcome and trainings', system: 'calendar', priority: 'normal' },
  ],
  offboarding: [
    { step: 'Confirm last working day with manager', system: 'email', priority: 'high' },
    { step: 'Schedule access revocation and hardware return', system: 'it_ticket', priority: 'high' },
    { step: 'Plan handover meeting', system: 'calendar', priority: 'normal' },
    { step: 'Prepare final payroll and reference letter', system: 'hr_system', priority: 'normal' },
  ],
}

export function classifyRequest(text: string): RequestType {
  return TYPE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'data_change'
}

/** Finds ISO (2026-10-05) and German (05.10.2026 / 5.10.) dates, returned as sorted ISO strings. */
export function extractDates(text: string, fallbackYear: number): string[] {
  const dates: string[] = []
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) dates.push(`${m[1]}-${m[2]}-${m[3]}`)
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})?/g)) {
    dates.push(`${m[3] ?? fallbackYear}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`)
  }
  return [...new Set(dates)].sort()
}

/** Mon–Fri days from start to end, both inclusive. */
export function businessDays(start: string, end: string): number {
  const cursor = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  let days = 0
  while (cursor <= last) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) days++
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

/**
 * Classifies the request by keywords, pulls dates / IBAN / replacement out of the text
 * and attaches the fixed workflow for that request type.
 */
export function mockProcessRequest(input: MockInput) {
  const text = input.requestText
  const requestType = classifyRequest(text)
  const extractedData: Record<string, unknown> = {}
  const validationIssues: string[] = []

  // Year of the first fully written date, so that short dates like "5.10." stay deterministic
  const fallbackYear = Number(text.match(/\b(20\d{2})\b/)?.[1] ?? 2026)
  const [startDate, ...rest] = extractDates(text, fallbackYear)
  const endDate = rest[rest.length - 1]

  if (requestType === 'vacation' || requestType === 'sick_leave') {
    if (!startDate) {
      validationIssues.push('No start date found in the request.')
    } else {
      extractedData.startDate = startDate
      if (endDate) {
        extractedData.endDate = endDate
        extractedData.businessDays = businessDays(startDate, endDate)
      } else if (requestType === 'vacation') {
        extractedData.endDate = startDate
        extractedData.businessDays = businessDays(startDate, startDate)
      } else {
        validationIssues.push('Expected return date is unknown.')
      }
    }
  }

  if (requestType === 'vacation') {
    const replacement = text.match(/(?:vertretung|vertritt mich|replacement|covered by)[^.\n]*?((?:Frau|Herr|Mr\.?|Ms\.?)\s+[A-ZÄÖÜ][\wäöüß-]+)/i)
    if (replacement) extractedData.replacement = replacement[1]
    else validationIssues.push('No replacement person named.')

    const remaining = input.existingData?.remainingVacationDays
    const requested = extractedData.businessDays
    if (typeof remaining === 'number' && typeof requested === 'number' && requested > remaining) {
      validationIssues.push(`Requested ${requested} day(s) but only ${remaining} vacation day(s) remaining.`)
    }
  }

  if (requestType === 'sick_leave') {
    extractedData.doctorsNote = /attest|krankschreibung|au-bescheinigung|doctor'?s note|certificate/i.test(text)
      ? (/folgt|nachreichen|reiche .* nach|will follow|later/i.test(text) ? 'pending' : 'provided')
      : 'not mentioned'
  }

  if (requestType === 'data_change') {
    const changedFields: Record<string, string> = {}
    const iban = text.match(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/)
    if (iban) changedFields.iban = iban[0]
    const address = text.match(/([A-ZÄÖÜ][\wäöüß.-]*(?:straße|strasse|str\.|weg|platz|allee|gasse| Street| Road)\s+\d+\w?,\s*\d{4,5}\s+[A-ZÄÖÜ][\wäöüß-]+)/)
    if (address) changedFields.address = address[1]
    const phone = text.match(/\+\d[\d /-]{7,}\d/)
    if (phone) changedFields.phone = phone[0]

    extractedData.changedFields = changedFields
    if (startDate) extractedData.effectiveDate = startDate
    if (Object.keys(changedFields).length === 0) validationIssues.push('Could not identify which field should change.')
  }

  if (requestType === 'onboarding' || requestType === 'offboarding') {
    if (startDate) extractedData[requestType === 'onboarding' ? 'startDate' : 'lastDay'] = startDate
    else validationIssues.push(requestType === 'onboarding' ? 'No start date found.' : 'No last working day found.')
  }

  if (input.employeeName) extractedData.employee = input.employeeName

  // Sick leave is only reported; bank detail changes need a second pair of eyes
  const changedFields = extractedData.changedFields as Record<string, string> | undefined
  const requiresApproval = requestType === 'sick_leave'
    ? false
    : requestType === 'data_change'
      ? Boolean(changedFields?.iban)
      : true

  const approver = !requiresApproval
    ? null
    : requestType === 'data_change'
      ? 'HR / payroll'
      : input.managerId ?? 'Direct manager'

  return {
    requestType,
    extractedData,
    requiresApproval,
    approver,
    actions: ACTIONS[requestType],
    validationIssues,
  }
}
