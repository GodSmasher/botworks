export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { getT, getLocale } from '@/i18n/server'

export default async function SettingsPage() {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const supabase = createServiceClient()

  const [companiesRes, connectorsRes, featureFlagsRes] = await Promise.all([
    supabase.from('companies').select('id, name, slug, status, holding_id, created_at'),
    supabase.from('connectors').select('id, company_id, type, name, status, sync_interval_minutes'),
    supabase.from('company_feature_flags').select('*'),
  ])

  const companies = (companiesRes.data ?? []) as Array<{ id: string; name: string; slug: string; status: string; holding_id: string | null; created_at: string }>
  const connectors = (connectorsRes.data ?? []) as Array<{ id: string; company_id: string; type: string; name: string; status: string; sync_interval_minutes: number | null }>
  const featureFlags = (featureFlagsRes.data ?? []) as Array<{ company_id: string; finanzplanung_enabled: boolean; [key: string]: unknown }>

  const flagMap = new Map(featureFlags.map(f => [f.company_id, f]))

  // Environment info
  const envInfo = [
    { label: t('Supabase URL'), value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '—', masked: false },
    { label: t('Service-role key'), value: process.env.SUPABASE_SERVICE_ROLE_KEY ? '••••••' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-4) : '—', masked: true },
    { label: t('Bot API URL'), value: process.env.BOTWORKS_API_URL ?? `http://localhost:4000 (${t('default')})`, masked: false },
    { label: t('Node env'), value: process.env.NODE_ENV ?? '—', masked: false },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-text mb-2">{t('Settings')}</h1>
      <p className="text-sm text-brand-text-secondary mb-8">{t('Platform configuration and environment')}</p>

      {/* Environment */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-8">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Environment')}</h2>
        <div className="space-y-3">
          {envInfo.map(env => (
            <div key={env.label} className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-background px-4 py-3">
              <span className="text-xs font-medium text-brand-text-muted">{env.label}</span>
              <span className="text-xs font-mono text-brand-text">{env.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Connector Configuration */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="text-lg font-semibold text-brand-text">{t('Connector configuration')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                <th className="text-left px-6 py-3">{t('Connector')}</th>
                <th className="text-left px-4 py-3">{t('Type')}</th>
                <th className="text-left px-4 py-3">{t('Tenant')}</th>
                <th className="text-right px-4 py-3">{t('Interval (min)')}</th>
                <th className="text-left px-4 py-3">{t('Status')}</th>
                <th className="text-left px-4 py-3">{t('ID')}</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map(c => {
                const company = companies.find(co => co.id === c.company_id)
                return (
                  <tr key={c.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                    <td className="px-6 py-3 text-xs font-medium text-brand-text">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-brand-text-secondary">{c.type}</td>
                    <td className="px-4 py-3 text-xs text-brand-text-secondary">{company?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-brand-text text-right font-mono">{c.sync_interval_minutes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.status === 'active' ? 'bg-brand-success/10 text-brand-success' :
                        c.status === 'error' ? 'bg-brand-error/10 text-brand-error' :
                        'bg-brand-warning/10 text-brand-warning'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-brand-text-muted font-mono">{c.id.slice(0, 8)}…</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-8">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Feature Flags')}</h2>
        <div className="space-y-3">
          {companies.map(c => {
            const flags = flagMap.get(c.id)
            return (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-background px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-brand-text">{c.name}</p>
                  <p className="text-[10px] text-brand-text-muted">{c.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${flags?.finanzplanung_enabled ? 'bg-brand-success' : 'bg-brand-text-muted'}`} />
                    <span className="text-[10px] text-brand-text-muted">{t('Financial planning')}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tenant Config */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="text-lg font-semibold text-brand-text">{t('Tenant overview')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                <th className="text-left px-6 py-3">{t('Tenant')}</th>
                <th className="text-left px-4 py-3">{t('Slug')}</th>
                <th className="text-left px-4 py-3">{t('Status')}</th>
                <th className="text-left px-4 py-3">{t('Holding')}</th>
                <th className="text-left px-4 py-3">{t('Created')}</th>
                <th className="text-left px-4 py-3">{t('ID')}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                  <td className="px-6 py-3 text-xs font-medium text-brand-text">{c.name}</td>
                  <td className="px-4 py-3 text-xs text-brand-text-muted font-mono">{c.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      c.status === 'active' ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-text-muted/10 text-brand-text-muted'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-brand-text-muted font-mono">{c.holding_id ? c.holding_id.slice(0, 8) + '…' : '—'}</td>
                  <td className="px-4 py-3 text-xs text-brand-text-muted">{new Date(c.created_at).toLocaleDateString(fmtLocale)}</td>
                  <td className="px-4 py-3 text-[10px] text-brand-text-muted font-mono">{c.id.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
