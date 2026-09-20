export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { botsApiFetch, botsApiLabel } from '@/lib/bots-api'
import { getT } from '@/i18n/server'

export default async function DashboardPage() {
  const t = getT()
  const supabase = createServiceClient()

  // Parallel queries for platform overview
  const [companiesRes, connectorsRes, botsRes, profilesRes] = await Promise.all([
    supabase.from('companies').select('id, name, slug, status').eq('status', 'active'),
    supabase.from('connectors').select('id, company_id, type, name, status, last_synced_at'),
    botsApiFetch('/api/bots').then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  const companies = companiesRes.data ?? []
  const connectors = connectorsRes.data ?? []
  const bots = Array.isArray(botsRes) ? botsRes : (botsRes?.data ?? botsRes?.bots ?? [])
  const userCount = profilesRes.count ?? 0

  const activeConnectors = connectors.filter(c => c.status === 'active').length
  const errorConnectors = connectors.filter(c => c.status === 'error').length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-text">{t('Platform Dashboard')}</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          botworks — {t('Overview of all tenants and systems')}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label={t('Active tenants')} value={companies.length} />
        <KpiCard label={t('Total users')} value={userCount} />
        <KpiCard
          label={t('Connectors')}
          value={`${activeConnectors} / ${connectors.length}`}
          sub={errorConnectors > 0 ? `${errorConnectors} ${t('errors')}` : t('All OK')}
          subColor={errorConnectors > 0 ? 'text-brand-error' : 'text-brand-success'}
        />
        <KpiCard label={t('Bot Fleet')} value={bots.length} sub={t('registered')} />
      </div>

      {/* Tenants Overview */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-brand-text">{t('Tenants')}</h2>
          <Link href="/tenants" className="text-xs text-brand-primary hover:text-brand-primary-hover">
            {t('View all')} →
          </Link>
        </div>
        <div className="space-y-3">
          {companies.map((c) => {
            const companyConnectors = connectors.filter(cn => cn.company_id === c.id)
            const hasError = companyConnectors.some(cn => cn.status === 'error')
            return (
              <Link
                key={c.id}
                href={`/tenants/${c.slug}`}
                className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-background p-4 hover:border-brand-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      hasError ? 'bg-brand-warning' : companyConnectors.length > 0 ? 'bg-brand-success' : 'bg-brand-text-muted'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-brand-text">{c.name}</p>
                    <p className="text-xs text-brand-text-muted">{c.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-brand-text-muted">{t('Connectors')}</p>
                    <p className="text-sm font-medium text-brand-text">{companyConnectors.length}</p>
                  </div>
                  <div className="flex gap-1">
                    {companyConnectors.map((cn) => (
                      <span
                        key={cn.id}
                        title={`${cn.name} (${cn.status})`}
                        className={`h-1.5 w-1.5 rounded-full ${
                          cn.status === 'active' ? 'bg-brand-success' : cn.status === 'error' ? 'bg-brand-error' : 'bg-brand-text-muted'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </Link>
            )
          })}
          {companies.length === 0 && (
            <p className="text-sm text-brand-text-muted text-center py-8">{t('No tenants created yet.')}</p>
          )}
        </div>
      </div>

      {/* Connector Status Overview */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Connector Status')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {connectors.map((c) => {
            const company = companies.find(co => co.id === c.company_id)
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-background p-3"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    c.status === 'active' ? 'bg-brand-success' : c.status === 'error' ? 'bg-brand-error' : 'bg-brand-warning'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-brand-text">{c.name}</p>
                  <p className="text-[10px] text-brand-text-muted">
                    {company?.name ?? t('Unknown')} · {c.type}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  c.status === 'active'
                    ? 'bg-brand-success/10 text-brand-success'
                    : c.status === 'error'
                      ? 'bg-brand-error/10 text-brand-error'
                      : 'bg-brand-warning/10 text-brand-warning'
                }`}>
                  {c.status}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  subColor,
}: {
  label: string
  value: string | number
  sub?: string
  subColor?: string
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-brand-text">{value}</p>
      {sub && <p className={`mt-1 text-xs ${subColor ?? 'text-brand-text-muted'}`}>{sub}</p>}
    </div>
  )
}
