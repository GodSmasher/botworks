// Fixture tables for mock mode. Every company, person, address and amount in
// this file is invented. Data is generated from a seeded PRNG, so the demo
// looks the same on every run while timestamps stay relative to "now".

type Row = Record<string, unknown>

function prng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const rand = prng(20260920)
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) => Math.round(min + rand() * (max - min))
const HOUR = 3_600_000
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()
const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`

// ─── Tenants ────────────────────────────────────────────────────────────────

const HOLDING = uuid('10000000', 1)

const companies: Row[] = [
  { name: 'Nordlicht Haustechnik', slug: 'nordlicht-haustechnik', status: 'active' },
  { name: 'Kiesel & Partner Steuerberatung', slug: 'kiesel-partner', status: 'active' },
  { name: 'Praxis am Stadtpark', slug: 'praxis-stadtpark', status: 'active' },
  { name: 'Fjord Logistik', slug: 'fjord-logistik', status: 'active' },
  { name: 'Blattwerk Gartenbau', slug: 'blattwerk-gartenbau', status: 'active' },
  { name: 'Werkbank Schreinerei', slug: 'werkbank-schreinerei', status: 'onboarding' },
  { name: 'Hafenkante Immobilien', slug: 'hafenkante-immobilien', status: 'paused' },
].map((c, i) => ({ id: uuid('10000000', i + 2), holding_id: HOLDING, created_at: ago((220 - i * 27) * 24), ...c }))

const companyIds = companies.map((c) => c.id as string)
const activeCompanyIds = companies.filter((c) => c.status === 'active').map((c) => c.id as string)

const company_feature_flags: Row[] = companies.map((c, i) => ({
  id: uuid('11000000', i + 1),
  company_id: c.id,
  finanzplanung_enabled: i % 3 !== 2,
}))

// ─── Users ──────────────────────────────────────────────────────────────────

const FIRST = ['Mara', 'Jonas', 'Elif', 'Tobias', 'Nele', 'Piotr', 'Svenja', 'Malik', 'Greta', 'Henrik', 'Aylin', 'Lasse'] as const
const LAST = ['Brandt', 'Okafor', 'Lindqvist', 'Yilmaz', 'Hartwig', 'Nowak', 'Petersen', 'Amrani', 'Sommer', 'Falk'] as const

const profiles: Row[] = []
companies.forEach((c, ci) => {
  const size = c.status === 'active' ? between(3, 6) : 2
  for (let i = 0; i < size; i++) {
    const first = FIRST[(ci * 5 + i * 3) % FIRST.length]
    const last = LAST[(ci * 3 + i * 7) % LAST.length]
    profiles.push({
      id: uuid('20000000', profiles.length + 1),
      first_name: first,
      last_name: last,
      display_name: `${first} ${last}`,
      email: `${first}.${last}@${c.slug}.example`.toLowerCase(),
      company_id: c.id,
      is_active: !(i === size - 1 && ci % 2 === 1),
      last_sign_in_at: i === size - 1 && ci % 2 === 1 ? null : ago(between(1, 24 * 9)),
    })
  }
})

// ─── Connectors ─────────────────────────────────────────────────────────────

const CONNECTOR_TYPES = [
  ['hubspot', 'HubSpot CRM'],
  ['sevdesk', 'sevDesk'],
  ['google_calendar', 'Google Calendar'],
  ['typeform', 'Typeform'],
  ['gmail', 'Gmail'],
  ['whatsapp', 'WhatsApp Business'],
] as const

const connectors: Row[] = []
companies.forEach((c, ci) => {
  if (c.status === 'onboarding') return
  const count = c.status === 'paused' ? 2 : between(3, 5)
  for (let i = 0; i < count; i++) {
    const [type, label] = CONNECTOR_TYPES[(ci + i) % CONNECTOR_TYPES.length]
    const broken = ci === 3 && i === 1
    connectors.push({
      id: uuid('30000000', connectors.length + 1),
      company_id: c.id,
      type,
      name: label,
      status: c.status === 'paused' ? 'paused' : broken ? 'error' : 'active',
      last_synced_at: broken ? ago(31) : ago(between(0, 3)),
      sync_interval_minutes: pick([15, 30, 60]),
    })
  }
})

const connector_sync_log: Row[] = []
connectors.forEach((conn) => {
  if (conn.status === 'paused') return
  for (let i = 0; i < 4; i++) {
    const failed = conn.status === 'error' && i < 2
    connector_sync_log.push({
      id: uuid('31000000', connector_sync_log.length + 1),
      connector_id: conn.id,
      started_at: ago(i * 6 + between(0, 2)),
      status: failed ? 'error' : 'success',
      records_synced: failed ? 0 : between(4, 180),
      error_message: failed ? '401 Unauthorized — access token expired, re-authentication required' : null,
    })
  }
})

// ─── Sales data ─────────────────────────────────────────────────────────────

const CITIES = [['10115', 'Berlin'], ['20095', 'Hamburg'], ['80331', 'München'], ['50667', 'Köln'], ['04109', 'Leipzig'], ['28195', 'Bremen'], ['70173', 'Stuttgart'], ['24103', 'Kiel']] as const

const leads: Row[] = Array.from({ length: 140 }, (_, i) => {
  const [zip, city] = pick(CITIES)
  return {
    id: uuid('40000000', i + 1),
    company_id: pick(activeCompanyIds),
    status: pick(['new', 'new', 'contacted', 'qualified', 'won', 'lost']),
    source: pick(['website', 'referral', 'campaign', 'phone', 'trade-fair']),
    created_at: ago(between(2, 24 * 120)),
    address_zip: i % 9 === 0 ? null : `${zip.slice(0, 3)}${String(between(10, 99))}`,
    address_city: i % 9 === 0 ? null : city,
  }
})

const offers: Row[] = Array.from({ length: 64 }, (_, i) => ({
  id: uuid('41000000', i + 1),
  company_id: pick(activeCompanyIds),
  status: pick(['draft', 'sent', 'sent', 'accepted', 'won', 'declined']),
  total_amount: between(18, 420) * 100,
  created_at: ago(between(4, 24 * 90)),
}))

const projects: Row[] = Array.from({ length: 38 }, (_, i) => ({
  id: uuid('42000000', i + 1),
  company_id: pick(activeCompanyIds),
  phase: pick(['planning', 'in_progress', 'in_progress', 'review', 'done']),
  created_at: ago(between(24, 24 * 150)),
}))

const invoices_incoming: Row[] = Array.from({ length: 46 }, (_, i) => ({
  id: uuid('43000000', i + 1),
  company_id: pick(activeCompanyIds),
  gross_amount: between(9, 260) * 10,
  status: pick(['paid', 'paid', 'open', 'overdue']),
}))

const suppliers: Row[] = ['Papierhaus Nord', 'Kabelkontor', 'Büroquelle', 'Grünschnitt Großhandel', 'Holzlager Ost', 'Medishop Beispiel'].map((name, i) => ({
  id: uuid('44000000', i + 1),
  name,
}))

// ─── Bot fleet ──────────────────────────────────────────────────────────────

const FLEET = [
  ['inbox-triage', 'Classified 14 e-mails, 2 escalated'],
  ['document-extract', 'Extracted 6 supplier invoices'],
  ['customer-support', 'Answered 9 tickets, 1 handed to a human'],
  ['follow-up', 'Sent 5 stage-2 reminders'],
  ['data-sync', 'Reconciled 212 CRM contacts, 3 conflicts'],
  ['report-generator', 'Built weekly sales report'],
  ['appointment', 'Proposed 4 slots, 3 confirmed'],
  ['billing', 'Drafted 7 invoices from time entries'],
  ['review-analysis', 'Analysed 31 new reviews'],
] as const

const bot_status: Row[] = FLEET.map(([bot, action], i) => {
  const failing = bot === 'data-sync'
  const stale = bot === 'review-analysis'
  return {
    id: uuid('50000000', i + 1),
    bot_name: bot,
    status: failing ? 'error' : stale ? 'idle' : 'active',
    last_heartbeat: stale ? ago(40) : ago(i * 0.2),
    last_action: action,
    last_action_at: stale ? ago(41) : ago(i * 0.7 + 0.1),
    last_error: failing ? 'Conflict limit exceeded for tenant fjord-logistik (3 > 2)' : null,
    details: { version: '0.1.0', queueDepth: i % 3 },
  }
})

const ACTIONS: Record<string, string[]> = {
  'inbox-triage': ['classify_inbox', 'route_message'],
  'document-extract': ['extract_invoice', 'extract_contract'],
  'customer-support': ['answer_ticket', 'escalate_ticket'],
  'follow-up': ['send_reminder'],
  'data-sync': ['reconcile_contacts'],
  'report-generator': ['build_report'],
  appointment: ['propose_slots', 'send_confirmation'],
  billing: ['draft_invoice', 'dunning_run'],
  'review-analysis': ['analyse_reviews'],
}

const bot_logs: Row[] = Array.from({ length: 60 }, (_, i) => {
  const [bot] = FLEET[i % FLEET.length]
  const failed = (bot === 'data-sync' && i % 2 === 0) || i === 17
  return {
    id: uuid('51000000', i + 1),
    bot_name: bot,
    aktion: pick(ACTIONS[bot]),
    status: failed ? 'error' : 'success',
    created_at: ago(i * 0.9 + rand()),
    details: failed
      ? { error: 'upstream timeout after 3 attempts', tenant: pick(companies).slug }
      : { durationMs: between(400, 5200), tenant: pick(companies).slug, items: between(1, 40) },
  }
})

const bot_kpis: Row[] = FLEET.flatMap(([bot], i) => [
  { id: uuid('52000000', i * 2 + 1), taken_at: ago(1), scope: 'bot', scope_key: bot, metric: 'runs_24h', value: between(6, 90), source: 'runtime' },
  { id: uuid('52000000', i * 2 + 2), taken_at: ago(1), scope: 'bot', scope_key: bot, metric: 'success_rate', value: bot === 'data-sync' ? 71 : between(93, 100), source: 'runtime' },
])

// ─── Route bot ──────────────────────────────────────────────────────────────

const route_bot_config: Row[] = activeCompanyIds.slice(0, 2).map((id, i) => ({
  id: uuid('60000000', i + 1),
  company_id: id,
  is_active: i === 0,
  radius_km: i === 0 ? 15 : 25,
  min_leads_for_suggestion: 3,
  suggest_before_minutes: 60,
  suggest_after_minutes: 90,
  working_hours_start: '08:00',
  working_hours_end: '18:00',
  calendar_api_key: null,
  calendar_org_uri: null,
  notification_channel: i === 0 ? 'both' : 'platform',
  created_at: ago(24 * 40),
  updated_at: ago(24 * 3),
}))

const reps = profiles.filter((p) => p.company_id === activeCompanyIds[0]).map((p) => p.id as string)

const route_plans: Row[] = Array.from({ length: 8 }, (_, i) => ({
  id: uuid('61000000', i + 1),
  company_id: activeCompanyIds[0],
  rep_id: reps[i % reps.length],
  plan_date: ago((i - 2) * 24).slice(0, 10),
  status: i < 2 ? 'planned' : 'completed',
  total_distance_km: between(38, 164),
  stops: Array.from({ length: between(3, 6) }, (_, s) => ({ order: s + 1, lead_id: leads[(i * 7 + s) % leads.length].id })),
  created_at: ago(i * 24 + 5),
}))

const route_suggestions: Row[] = Array.from({ length: 14 }, (_, i) => ({
  id: uuid('62000000', i + 1),
  company_id: activeCompanyIds[0],
  rep_id: reps[i % reps.length],
  lead_id: leads[(i * 11) % leads.length].id,
  distance_km: between(1, 14) + rand(),
  suggested_for: ago(-between(2, 60)),
  status: pick(['pending', 'pending', 'accepted', 'dismissed']),
  created_at: ago(i * 3 + 1),
}))

const plz_geocache: Row[] = Array.from({ length: 412 }, (_, i) => ({ plz: String(10000 + i * 173).padStart(5, '0') }))

export const mockTables: Record<string, Row[]> = {
  companies,
  company_feature_flags,
  profiles,
  connectors,
  connector_sync_log,
  leads,
  offers,
  projects,
  invoices_incoming,
  suppliers,
  bot_status,
  bot_logs,
  bot_kpis,
  route_bot_config,
  route_plans,
  route_suggestions,
  plz_geocache,
}

void companyIds
