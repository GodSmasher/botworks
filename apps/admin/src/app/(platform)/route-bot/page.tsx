export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { getT, getLocale } from '@/i18n/server'

function fmtTime(time: string | null): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

export default async function RouteBotPage() {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const supabase = createServiceClient()

  const [configRes, companiesRes, leadsRes, plansRes, suggestionsRes] = await Promise.all([
    supabase.from('route_bot_config').select('*'),
    supabase.from('companies').select('id, name, slug'),
    supabase.from('leads').select('id, address_zip, address_city', { count: 'exact' }).not('address_zip', 'is', null),
    supabase.from('route_plans').select('id, company_id, rep_id, plan_date, status, total_distance_km, stops, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('route_suggestions').select('id, company_id, rep_id, lead_id, distance_km, suggested_for, status, created_at').order('created_at', { ascending: false }).limit(30),
  ])

  type Config = {
    id: string
    company_id: string
    is_active: boolean
    radius_km: number
    min_leads_for_suggestion: number
    suggest_before_minutes: number
    suggest_after_minutes: number
    working_hours_start: string
    working_hours_end: string
    calendar_api_key: string | null
    calendar_org_uri: string | null
    notification_channel: string
    created_at: string
    updated_at: string
  }

  const configs = (configRes.data ?? []) as Config[]
  const companies = (companiesRes.data ?? []) as Array<{ id: string; name: string; slug: string }>
  const geocodedLeads = leadsRes.count ?? 0
  const plans = (plansRes.data ?? []) as Array<{ id: string; company_id: string; rep_id: string; plan_date: string; status: string; total_distance_km: number | null; stops: unknown[]; created_at: string }>
  const suggestions = (suggestionsRes.data ?? []) as Array<{ id: string; company_id: string; rep_id: string; lead_id: string; distance_km: number | null; suggested_for: string; status: string; created_at: string }>

  const [plzRes] = await Promise.all([
    supabase.from('plz_geocache').select('plz', { count: 'exact', head: true }),
  ])
  const geocachedPlz = plzRes.count ?? 0

  const companyMap = new Map(companies.map(c => [c.id, c]))

  const plzDistribution: Record<string, number> = {}
  if (leadsRes.data) {
    for (const l of leadsRes.data as Array<{ address_zip: string }>) {
      const region = l.address_zip?.slice(0, 2) || '??'
      plzDistribution[region] = (plzDistribution[region] ?? 0) + 1
    }
  }
  const topRegions = Object.entries(plzDistribution).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const channelLabels: Record<string, string> = {
    platform: t('Platform only'),
    whatsapp: t('WhatsApp only'),
    both: 'Platform + WhatsApp',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Route Bot</h1>
          <p className="text-sm text-brand-text-secondary mt-1">{t('Route optimisation and proximity-based lead suggestions')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
            {geocodedLeads} {t('leads with postal code')}
          </span>
          <span className="rounded-full bg-brand-accent/10 px-3 py-1 text-xs font-medium text-brand-accent">
            {geocachedPlz} {t('postal codes cached')}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted font-medium">{t('Configurations')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">{configs.length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted font-medium">{t('Active bots')}</p>
          <p className="text-xl font-bold text-brand-success mt-1">{configs.filter(c => c.is_active).length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted font-medium">{t('Routes created')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">{plans.length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted font-medium">{t('Suggestions')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">{suggestions.length}</p>
        </div>
      </div>

      {/* Bot Configurations */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-6">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Bot configuration per tenant')}</h2>
        {configs.length === 0 ? (
          <p className="text-sm text-brand-text-muted text-center py-6">{t('No configurations available.')}</p>
        ) : (
          <div className="space-y-4">
            {configs.map((config) => {
              const company = companyMap.get(config.company_id)
              return (
                <div key={config.id} className="rounded-lg border border-brand-border bg-brand-background p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary font-bold">
                        {company?.name.charAt(0) ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-text">{company?.name ?? t('Unknown')}</p>
                        <p className="text-[10px] text-brand-text-muted">{company?.slug ?? '—'}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      config.is_active
                        ? 'bg-brand-success/10 text-brand-success'
                        : 'bg-brand-text-muted/10 text-brand-text-muted'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${config.is_active ? 'bg-brand-success' : 'bg-brand-text-muted'}`} />
                      {config.is_active ? t('Active') : t('Inactive')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] text-brand-text-muted uppercase tracking-wide">{t('Radius')}</p>
                      <p className="text-sm font-medium text-brand-text mt-0.5">{config.radius_km} km</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-brand-text-muted uppercase tracking-wide">{t('Min. leads')}</p>
                      <p className="text-sm font-medium text-brand-text mt-0.5">{config.min_leads_for_suggestion}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-brand-text-muted uppercase tracking-wide">{t('Time window')}</p>
                      <p className="text-sm font-medium text-brand-text mt-0.5">-{config.suggest_before_minutes}min / +{config.suggest_after_minutes}min</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-brand-text-muted uppercase tracking-wide">{t('Working hours')}</p>
                      <p className="text-sm font-medium text-brand-text mt-0.5">{fmtTime(config.working_hours_start)} – {fmtTime(config.working_hours_end)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-brand-border/50">
                    <div>
                      <p className="text-[10px] text-brand-text-muted uppercase tracking-wide">{t('Notification')}</p>
                      <p className="text-sm font-medium text-brand-text mt-0.5">{channelLabels[config.notification_channel] ?? config.notification_channel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-brand-text-muted uppercase tracking-wide">{t('Calendar')}</p>
                      <p className="text-sm font-medium mt-0.5">
                        {config.calendar_api_key ? (
                          <span className="text-brand-success">{t('Connected')}</span>
                        ) : (
                          <span className="text-brand-warning">{t('Not configured')}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-brand-text-muted uppercase tracking-wide">{t('Config ID')}</p>
                      <p className="text-[10px] font-mono text-brand-text-muted mt-0.5">{config.id.slice(0, 12)}…</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lead Coverage by Region */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Lead coverage by region')}</h2>
          <p className="text-xs text-brand-text-muted mb-4">{t('Distribution by postal code prefix (first 2 digits)')}</p>
          <div className="space-y-3">
            {topRegions.map(([region, count]) => {
              const pct = geocodedLeads > 0 ? Math.round((count / geocodedLeads) * 100) : 0
              return (
                <div key={region}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-brand-text font-medium">{t('Postal code')} {region}xx</span>
                    <span className="text-brand-text-muted">{count.toLocaleString(fmtLocale)} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-brand-background overflow-hidden">
                    <div className="h-full rounded-full bg-brand-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="text-lg font-semibold text-brand-text mb-4">{t('System status')}</h2>
          <div className="space-y-3">
            <StatusRow
              label={t('Postal code geocache')}
              detail={geocachedPlz > 0 ? `${geocachedPlz} ${t('postal codes cached')}` : t('Not populated yet — geocoding required')}
              status={geocachedPlz > 100 ? 'ok' : geocachedPlz > 0 ? 'warn' : 'error'}
            />
            <StatusRow
              label={t('Calendar integration')}
              detail={configs.some(c => c.calendar_api_key) ? t('API key configured') : t('No API key stored')}
              status={configs.some(c => c.calendar_api_key) ? 'ok' : 'warn'}
            />
            <StatusRow
              label={t('Lead addresses')}
              detail={`${geocodedLeads.toLocaleString(fmtLocale)} ${t('leads with postal code available')}`}
              status={geocodedLeads > 100 ? 'ok' : 'warn'}
            />
            <StatusRow
              label={t('Route plans')}
              detail={plans.length > 0 ? `${plans.length} ${t('plans created')}` : t('No routes generated yet')}
              status={plans.length > 0 ? 'ok' : 'info'}
            />
            <StatusRow
              label={t('WhatsApp channel')}
              detail={configs.some(c => c.notification_channel === 'whatsapp' || c.notification_channel === 'both') ? t('Active for at least one tenant') : t('Not enabled')}
              status={configs.some(c => c.notification_channel === 'whatsapp' || c.notification_channel === 'both') ? 'ok' : 'info'}
            />
          </div>
        </div>
      </div>

      {/* Recent Route Plans */}
      {plans.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="text-lg font-semibold text-brand-text">{t('Recent route plans')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                  <th className="text-left px-6 py-3">{t('Date')}</th>
                  <th className="text-left px-4 py-3">Tenant</th>
                  <th className="text-right px-4 py-3">{t('Stops')}</th>
                  <th className="text-right px-4 py-3">{t('Distance')}</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => {
                  const company = companyMap.get(plan.company_id)
                  const stopsCount = Array.isArray(plan.stops) ? plan.stops.length : 0
                  return (
                    <tr key={plan.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                      <td className="px-6 py-3 text-xs text-brand-text">{new Date(plan.plan_date).toLocaleDateString(fmtLocale)}</td>
                      <td className="px-4 py-3 text-xs text-brand-text-secondary">{company?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-brand-text text-right font-mono">{stopsCount}</td>
                      <td className="px-4 py-3 text-xs text-brand-text text-right font-mono">{plan.total_distance_km ? `${plan.total_distance_km} km` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          plan.status === 'sent' ? 'bg-brand-success/10 text-brand-success' :
                          plan.status === 'accepted' ? 'bg-brand-primary/10 text-brand-primary' :
                          'bg-brand-text-muted/10 text-brand-text-muted'
                        }`}>
                          {plan.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Suggestions */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="text-lg font-semibold text-brand-text">{t('Recent suggestions')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                  <th className="text-left px-6 py-3">{t('Date')}</th>
                  <th className="text-left px-4 py-3">Tenant</th>
                  <th className="text-right px-4 py-3">{t('Distance')}</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map(s => {
                  const company = companyMap.get(s.company_id)
                  return (
                    <tr key={s.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                      <td className="px-6 py-3 text-xs text-brand-text">{new Date(s.suggested_for).toLocaleDateString(fmtLocale)}</td>
                      <td className="px-4 py-3 text-xs text-brand-text-secondary">{company?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-brand-text text-right font-mono">{s.distance_km ? `${s.distance_km} km` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          s.status === 'accepted' ? 'bg-brand-success/10 text-brand-success' :
                          s.status === 'dismissed' ? 'bg-brand-error/10 text-brand-error' :
                          'bg-brand-warning/10 text-brand-warning'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state for plans/suggestions */}
      {plans.length === 0 && suggestions.length === 0 && (
        <div className="rounded-xl border border-dashed border-brand-border bg-brand-surface/50 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 mb-4">
            <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-brand-text mb-1">{t('No routes yet')}</h3>
          <p className="text-xs text-brand-text-muted max-w-md mx-auto">
            {t('As soon as the bot is active and calendar appointments exist, optimised routes and lead suggestions will appear here automatically.')}
          </p>
        </div>
      )}
    </div>
  )
}

function StatusRow({ label, detail, status }: { label: string; detail: string; status: 'ok' | 'warn' | 'error' | 'info' }) {
  const t = getT()
  const colors: Record<string, string> = {
    ok: 'bg-brand-success/10 text-brand-success',
    warn: 'bg-brand-warning/10 text-brand-warning',
    error: 'bg-brand-error/10 text-brand-error',
    info: 'bg-brand-primary/10 text-brand-primary',
  }
  const labels: Record<string, string> = { ok: 'OK', warn: t('Open'), error: t('Missing'), info: 'Info' }

  return (
    <div className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-background p-4">
      <div>
        <p className="text-sm font-medium text-brand-text">{label}</p>
        <p className="text-xs text-brand-text-muted mt-0.5">{detail}</p>
      </div>
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${colors[status]}`}>
        {labels[status]}
      </span>
    </div>
  )
}
