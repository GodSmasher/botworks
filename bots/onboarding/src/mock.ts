// Offline (mock mode) normalization and distribution planning. Rule-based and deterministic:
// field aliases are mapped to canonical keys, values are cleaned up, obvious problems are flagged.

interface ValidationIssue {
  field: string
  message: string
  severity: 'error' | 'warning'
}

// Canonical key → accepted raw keys (compared lower-case, without separators).
const ALIASES: Record<string, string[]> = {
  full_name: ['name', 'fullname', 'contact', 'contactperson', 'ansprechpartner', 'kontakt'],
  first_name: ['firstname', 'vorname', 'givenname'],
  last_name: ['lastname', 'nachname', 'surname', 'familyname'],
  email: ['email', 'mail', 'emailaddress'],
  phone: ['phone', 'telefon', 'tel', 'mobile', 'mobil', 'handy', 'phonenumber'],
  company: ['company', 'firma', 'organisation', 'organization', 'unternehmen'],
  address: ['address', 'adresse', 'anschrift'],
  street: ['street', 'strasse', 'straße'],
  zip: ['zip', 'plz', 'postcode', 'postalcode'],
  city: ['city', 'ort', 'stadt'],
  country: ['country', 'land'],
  vat_id: ['vatid', 'vat', 'ustid', 'ustidnr', 'uid'],
  start_date: ['startdate', 'eintrittsdatum', 'customersince', 'kundeseit', 'start'],
  birth_date: ['birthdate', 'geburtsdatum', 'dob'],
  notes: ['notes', 'note', 'notiz', 'notizen', 'bemerkung', 'comment'],
}

const COUNTRIES: Record<string, { code: string; dial: string }> = {
  de: { code: 'DE', dial: '49' }, deutschland: { code: 'DE', dial: '49' }, germany: { code: 'DE', dial: '49' },
  ch: { code: 'CH', dial: '41' }, schweiz: { code: 'CH', dial: '41' }, switzerland: { code: 'CH', dial: '41' },
  at: { code: 'AT', dial: '43' }, österreich: { code: 'AT', dial: '43' }, oesterreich: { code: 'AT', dial: '43' }, austria: { code: 'AT', dial: '43' },
}

// Fields each kind of target system is interested in; unknown systems receive the full record.
const SYSTEM_FIELDS: Array<{ pattern: RegExp; fields: string[] }> = [
  { pattern: /account|billing|erp|buchhaltung|finance/i, fields: ['company', 'first_name', 'last_name', 'email', 'street', 'zip', 'city', 'country', 'vat_id', 'payment_terms'] },
  { pattern: /newsletter|marketing|mailing/i, fields: ['first_name', 'last_name', 'email', 'company', 'country'] },
  { pattern: /calendar|kalender/i, fields: ['first_name', 'last_name', 'email', 'start_date'] },
]

function canonicalKey(rawKey: string): string {
  const compact = rawKey.toLowerCase().replace(/[^a-z0-9äöüß]/g, '')
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(compact)) return canonical
  }
  return rawKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field'
}

function properCase(value: string): string {
  return value.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

function toIsoDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const m = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return (typeof value === 'object' ? JSON.stringify(value) : String(value)).trim()
}

export function mockNormalize(
  entityType: string,
  rawData: Record<string, unknown>,
): { normalizedData: Record<string, string>; validationErrors: ValidationIssue[] } {
  const data: Record<string, string> = {}
  const issues: ValidationIssue[] = []

  for (const [rawKey, rawValue] of Object.entries(rawData)) {
    const value = asString(rawValue)
    if (value === '') continue
    const key = canonicalKey(rawKey)
    if (!(key in data)) data[key] = value
  }

  // Names: split a full name, then proper-case.
  if (data.full_name) {
    const parts = data.full_name.split(/\s+/)
    // The last name starts at a particle ("von", "van", …) if there is one, otherwise it is the last word.
    const particleAt = parts.findIndex((p, i) => i > 0 && /^(von|van|de|der|den|zu)$/i.test(p))
    const splitAt = particleAt > 0 ? particleAt : Math.max(1, parts.length - 1)
    if (!data.first_name) data.first_name = parts.slice(0, splitAt).join(' ')
    if (!data.last_name && parts.length > 1) data.last_name = parts.slice(splitAt).join(' ')
    delete data.full_name
  }
  for (const key of ['first_name', 'last_name', 'city']) {
    if (data[key]) data[key] = properCase(data[key])
  }
  // Name particles stay lower-case ("von Hollenstedt").
  if (data.last_name) data.last_name = data.last_name.replace(/\b(Von|Van|De|Der|Den|Zu)(?=\s)/g, (p) => p.toLowerCase())

  // Address: "Street 1, 12345 City, Country" → structured fields.
  if (data.address) {
    const parts = data.address.split(',').map((p) => p.trim()).filter(Boolean)
    const zipCity = parts.map((p) => p.match(/^(\d{4,5})\s+(.+)$/)).find(Boolean)
    if (!data.street && parts[0]) data.street = parts[0]
    if (zipCity) {
      if (!data.zip) data.zip = zipCity[1]
      if (!data.city) data.city = properCase(zipCity[2])
    }
    if (!data.country && parts.length >= 3) data.country = parts[parts.length - 1]
    if (zipCity) delete data.address
    else issues.push({ field: 'address', message: 'Address could not be split into street/zip/city', severity: 'warning' })
  }

  // Country → ISO code.
  let dial: string | undefined
  if (data.country) {
    const known = COUNTRIES[data.country.toLowerCase()]
    if (known) {
      data.country = known.code
      dial = known.dial
    } else {
      issues.push({ field: 'country', message: `Unknown country "${data.country}", kept as entered`, severity: 'warning' })
    }
  }

  // Email: lower-case and validate.
  if (data.email) {
    data.email = data.email.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      issues.push({ field: 'email', message: 'Email address format is invalid', severity: 'error' })
    }
  } else {
    issues.push({ field: 'email', message: `No email address provided for ${entityType}`, severity: 'error' })
  }

  // Phone: international format with country code.
  if (data.phone) {
    const digits = data.phone.replace(/[^\d+]/g, '')
    if (digits.startsWith('+')) data.phone = digits
    else if (digits.startsWith('00')) data.phone = `+${digits.slice(2)}`
    else if (digits.startsWith('0') && dial) {
      data.phone = `+${dial}${digits.slice(1)}`
      issues.push({ field: 'phone', message: `No country code given; assumed +${dial} from country`, severity: 'warning' })
    } else {
      issues.push({ field: 'phone', message: 'Phone number has no country code and country is unknown', severity: 'warning' })
    }
    if (data.phone.replace(/\D/g, '').length < 7) {
      issues.push({ field: 'phone', message: 'Phone number looks too short', severity: 'error' })
    }
  }

  // Dates → ISO.
  for (const key of Object.keys(data).filter((k) => k.endsWith('_date'))) {
    const iso = toIsoDate(data[key])
    if (iso) data[key] = iso
    else issues.push({ field: key, message: `Date "${data[key]}" is not in a recognised format`, severity: 'warning' })
  }

  if (data.vat_id) data.vat_id = data.vat_id.replace(/\s+/g, '').toUpperCase()
  if (!data.last_name && !data.company) {
    issues.push({ field: 'last_name', message: 'Neither a person name nor a company name was found', severity: 'error' })
  }

  return { normalizedData: data, validationErrors: issues }
}

export function mockDistribution(
  normalizedData: Record<string, string>,
  systems: string[],
): { distributions: Array<{ system: string; fields: Record<string, string> }> } {
  return {
    distributions: systems.map((system) => {
      const wanted = SYSTEM_FIELDS.find((s) => s.pattern.test(system))?.fields ?? Object.keys(normalizedData)
      const fields: Record<string, string> = {}
      for (const key of wanted) {
        if (key in normalizedData) fields[key] = normalizedData[key]
      }
      return { system, fields }
    }),
  }
}
