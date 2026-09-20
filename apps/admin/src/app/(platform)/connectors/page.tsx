export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { getT, getLocale } from '@/i18n/server'

// Descriptions are English source strings; translated via t() at the render site.
const CONNECTOR_DISPLAY: Record<string, { label: string; description: string }> = {
  hubspot: { label: 'HubSpot CRM', description: 'CRM & lead management' },
  sevdesk: { label: 'sevDesk', description: 'Accounting, invoices, contacts' },
  '3cx': { label: '3CX Cloud', description: 'Telephony, call recording, routing' },
  google_calendar: { label: 'Google Calendar', description: 'Appointments, availability, sync' },
  typeform: { label: 'Typeform', description: 'Lead capture & qualification' },
  gmail: { label: 'Gmail', description: 'Email integration, inbox triage' },
  whatsapp: { label: 'WhatsApp', description: 'Messaging, customer service' },
}

export default async function ConnectorsPage() {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const supabase = createServiceClient()

  const [connectorsRes, companiesRes, syncLogRes] = await Promise.all([
    supabase.from('connectors').select('*').order('type'),
    supabase.from('companies').select('id, name, slug'),
    supabase.from('connector_sync_log').select('connector_id, started_at, status, records_synced, error_message')
      .order('started_at', { ascending: false })
      .limit(50),
  ])

  const connectors = connectorsRes.data ?? []
  const companies = companiesRes.data ?? []
  const syncLogs = syncLogRes.data ?? []

  const companyMap = companies.reduce<Record<string, string>>((acc, c) => {
    acc[c.id] = c.name
    return acc
  }, {})

  // Group by connector type
  const byType = connectors.reduce<Record<string, typeof connectors>>((acc, c) => {
    if (!acc[c.type]) acc[c.type] = []
    acc[c.type].push(c)
    return acc
  }, {})

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-text">{t('Connectors')}</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          {t('All integrations across all tenants')}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Total')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">{connectors.length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Active')}</p>
          <p className="text-xl font-bold text-brand-success mt-1">
            {connectors.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Errors')}</p>
          <p className="text-xl font-bold text-brand-error mt-1">
            {connectors.filter(c => c.status === 'error').length}
          </p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Types')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">{Object.keys(byType).length}</p>
        </div>
      </div>

      {/* By Connector Type */}
      {Object.entries(byType).map(([type, typeConnectors]) => {
        const display = CONNECTOR_DISPLAY[type] ?? { label: type, description: '' }
        return (
          <div key={type} className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-semibold text-brand-text">{display.label}</h2>
              <span className="text-xs text-brand-text-muted">{display.description ? t(display.description) : ''}</span>
              <span className="ml-auto rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
                {typeConnectors.length} {typeConnectors.length !== 1 ? t('instances') : t('instance')}
              </span>
            </div>
            <div className="space-y-2">
              {typeConnectors.map((c) => {
                const lastSync = syncLogs.find(l => l.connector_id === c.id)
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 rounded-lg border border-brand-border bg-brand-background p-3"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      c.status === 'active' ? 'bg-brand-success' : c.status === 'error' ? 'bg-brand-error' : 'bg-brand-warning'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-text">{companyMap[c.company_id] ?? t('Unknown')}</p>
                      <p className="text-[10px] text-brand-text-muted">
                        {t('Interval')}: {c.sync_interval_minutes}min
                        {c.last_synced_at && ` · ${t('Last sync')}: ${new Date(c.last_synced_at).toLocaleString(fmtLocale)}`}
                      </p>
                    </div>
                    {lastSync && (
                      <span className="text-[10px] text-brand-text-muted">
                        {lastSync.records_synced ?? 0} Records
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      c.status === 'active' ? 'bg-brand-success/10 text-brand-success'
                      : c.status === 'error' ? 'bg-brand-error/10 text-brand-error'
                      : 'bg-brand-warning/10 text-brand-warning'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
