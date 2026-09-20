export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { getLocale, getT } from '@/i18n/server'

export default async function TenantDetailPage({ params }: { params: { slug: string } }) {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!company) notFound()

  const [connectorsRes, leadsRes, offersRes, featuresRes, profilesRes] = await Promise.all([
    supabase.from('connectors').select('*').eq('company_id', company.id).order('type'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    supabase.from('offers').select('id, status, total_amount').eq('company_id', company.id),
    supabase.from('company_feature_flags').select('*').eq('company_id', company.id).single(),
    supabase.from('profiles').select('id, first_name, last_name, display_name').eq('company_id', company.id),
  ])

  const connectors = connectorsRes.data ?? []
  const leadCount = leadsRes.count ?? 0
  const offers = offersRes.data ?? []
  const features = featuresRes.data
  const profiles = profilesRes.data ?? []

  const totalPipeline = offers
    .filter(o => o.status === 'draft' || o.status === 'sent')
    .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0)
  const wonOffers = offers.filter(o => o.status === 'won').length

  // Connector type labels
  const CONNECTOR_DISPLAY: Record<string, string> = {
    hubspot: 'HubSpot CRM',
    sevdesk: 'sevDesk',
    '3cx': '3CX Cloud',
    google_calendar: 'Google Calendar',
    typeform: 'Typeform',
    gmail: 'Gmail',
    whatsapp: 'WhatsApp',
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/tenants" className="text-xs text-brand-text-muted hover:text-brand-text-secondary mb-2 inline-block">
          ← {t('Back to tenants')}
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary font-bold text-lg">
            {company.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-text">{company.name}</h1>
            <p className="text-sm text-brand-text-muted">{company.slug} · ID: {company.id.slice(0, 8)}...</p>
          </div>
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${
            company.status === 'active' ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'
          }`}>
            {company.status === 'active' ? t('Active') : t('Inactive')}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Leads')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">{leadCount}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Offers')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">{offers.length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Pipeline')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">EUR {(totalPipeline / 1_000_000).toFixed(1)}M</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Won')}</p>
          <p className="text-xl font-bold text-brand-success mt-1">{wonOffers}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Users')}</p>
          <p className="text-xl font-bold text-brand-text mt-1">{profiles.length}</p>
        </div>
      </div>

      {/* Connectoren */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-6">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Connectors')}</h2>
        {connectors.length === 0 ? (
          <p className="text-sm text-brand-text-muted text-center py-6">{t('No connectors configured.')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {connectors.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-lg border border-brand-border bg-brand-background p-4"
              >
                <span className={`h-3 w-3 rounded-full shrink-0 ${
                  c.status === 'active' ? 'bg-brand-success' : c.status === 'error' ? 'bg-brand-error' : 'bg-brand-warning'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-text">
                    {CONNECTOR_DISPLAY[c.type] ?? c.name}
                  </p>
                  <p className="text-[10px] text-brand-text-muted">
                    {c.type} · {t('Interval')}: {c.sync_interval_minutes}min
                    {c.last_synced_at && ` · ${t('Last sync')}: ${new Date(c.last_synced_at).toLocaleDateString(fmtLocale)}`}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${
                  c.status === 'active' ? 'bg-brand-success/10 text-brand-success'
                  : c.status === 'error' ? 'bg-brand-error/10 text-brand-error'
                  : 'bg-brand-warning/10 text-brand-warning'
                }`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feature Flags */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-6">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Feature Flags')}</h2>
        <div className="space-y-2">
          <FeatureRow label={t('Financial planning')} enabled={features?.finanzplanung_enabled ?? false} />
        </div>
      </div>

      {/* Benutzer */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Users')} ({profiles.length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-lg border border-brand-border bg-brand-background px-3 py-2">
              <p className="text-sm text-brand-text truncate">
                {p.display_name ?? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || t('Unknown'))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  const t = getT()
  return (
    <div className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-background px-4 py-3">
      <span className="text-sm text-brand-text">{label}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        enabled ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-text-muted/10 text-brand-text-muted'
      }`}>
        {enabled ? t('Active') : t('Inactive')}
      </span>
    </div>
  )
}
