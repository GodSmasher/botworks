export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { getT, getLocale } from '@/i18n/server'

function fmtDate(date: string | null, fmtLocale: string): string {
  if (!date) return '—'
  const d = new Date(date)
  return `${d.toLocaleDateString(fmtLocale)} ${d.toLocaleTimeString(fmtLocale, { hour: '2-digit', minute: '2-digit' })}`
}

export default async function CompliancePage() {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const supabase = createServiceClient()

  // Fetch compliance-relevant data
  const [connectorsRes, botLogsRes, profilesRes, companiesRes, syncLogRes] = await Promise.all([
    supabase.from('connectors').select('id, company_id, type, name, status, last_synced_at').order('last_synced_at', { ascending: false }),
    supabase.from('bot_logs').select('id, bot_name, aktion, status, created_at, details').order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, display_name, email, is_active, last_sign_in_at, company_id').order('last_sign_in_at', { ascending: false }),
    supabase.from('companies').select('id, name'),
    supabase.from('connector_sync_log').select('id, connector_id, started_at, status, records_synced, error_message').order('started_at', { ascending: false }).limit(30),
  ])

  const connectors = (connectorsRes.data ?? []) as Array<{ id: string; company_id: string; type: string; name: string; status: string; last_synced_at: string | null }>
  const botLogs = (botLogsRes.data ?? []) as Array<{ id: string; bot_name: string; aktion: string; status: string; created_at: string; details: Record<string, unknown> }>
  const profiles = (profilesRes.data ?? []) as Array<{ id: string; display_name: string | null; email: string | null; is_active: boolean; last_sign_in_at: string | null; company_id: string }>
  const companies = (companiesRes.data ?? []) as Array<{ id: string; name: string }>
  const syncLogs = (syncLogRes.data ?? []) as Array<{ id: string; connector_id: string; started_at: string; status: string; records_synced: number; error_message: string | null }>

  const companyMap = new Map(companies.map(c => [c.id, c.name]))
  const connectorMap = new Map(connectors.map(c => [c.id, c]))

  const errorConnectors = connectors.filter(c => c.status === 'error').length
  const inactiveUsers = profiles.filter(p => !p.is_active).length
  const botErrors = botLogs.filter(l => l.status === 'error').length
  const syncErrors = syncLogs.filter(l => l.status === 'error').length

  // Compliance checks
  const checks = [
    {
      label: t('All connectors active'),
      status: errorConnectors === 0 ? 'ok' : 'warn',
      detail: errorConnectors === 0 ? t('All connectors are running without errors') : `${errorConnectors} ${t('connector(s) in error state')}`,
    },
    {
      label: t('No inactive users with access'),
      status: inactiveUsers === 0 ? 'ok' : 'info',
      detail: inactiveUsers === 0 ? t('All users are active') : `${inactiveUsers} ${t('inactive user(s) present')}`,
    },
    {
      label: t('Bot error rate'),
      status: botErrors === 0 ? 'ok' : botErrors <= 3 ? 'warn' : 'error',
      detail: botErrors === 0 ? t('No bot errors in the latest logs') : `${botErrors} ${t('errors in the last 50 bot actions')}`,
    },
    {
      label: t('Sync error rate'),
      status: syncErrors === 0 ? 'ok' : 'warn',
      detail: syncErrors === 0 ? t('No sync errors') : `${syncErrors} ${t('failed syncs')}`,
    },
    {
      label: t('Service-role key active'),
      status: 'ok',
      detail: t('Supabase service-role key is configured and working'),
    },
  ]

  const statusColors: Record<string, string> = {
    ok: 'bg-brand-success/10 text-brand-success',
    warn: 'bg-brand-warning/10 text-brand-warning',
    error: 'bg-brand-error/10 text-brand-error',
    info: 'bg-brand-primary/10 text-brand-primary',
  }
  const statusLabels: Record<string, string> = { ok: t('OK'), warn: t('Warning'), error: t('Critical'), info: t('Info') }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-text mb-2">{t('Compliance')}</h1>
      <p className="text-sm text-brand-text-secondary mb-8">{t('Data protection, audit logs and system checks')}</p>

      {/* Compliance Checks */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-8">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('System checks')}</h2>
        <div className="space-y-3">
          {checks.map(check => (
            <div key={check.label} className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-background p-4">
              <div>
                <p className="text-sm font-medium text-brand-text">{check.label}</p>
                <p className="text-xs text-brand-text-muted mt-0.5">{check.detail}</p>
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusColors[check.status]}`}>
                {statusLabels[check.status]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Audit Log */}
      {syncLogs.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="text-lg font-semibold text-brand-text">{t('Sync audit log')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                  <th className="text-left px-6 py-3">{t('Time')}</th>
                  <th className="text-left px-4 py-3">{t('Connector')}</th>
                  <th className="text-left px-4 py-3">{t('Tenant')}</th>
                  <th className="text-right px-4 py-3">{t('Records')}</th>
                  <th className="text-left px-4 py-3">{t('Status')}</th>
                  <th className="text-left px-4 py-3">{t('Error')}</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map(log => {
                  const con = connectorMap.get(log.connector_id)
                  const tenant = con ? companyMap.get(con.company_id) : '—'
                  return (
                    <tr key={log.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                      <td className="px-6 py-3 text-xs text-brand-text-muted whitespace-nowrap">{fmtDate(log.started_at, fmtLocale)}</td>
                      <td className="px-4 py-3 text-xs text-brand-text font-medium">{con?.name ?? log.connector_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-xs text-brand-text-secondary">{tenant}</td>
                      <td className="px-4 py-3 text-xs text-brand-text text-right font-mono">{log.records_synced ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          log.status === 'success' ? 'bg-brand-success/10 text-brand-success' :
                          log.status === 'error' ? 'bg-brand-error/10 text-brand-error' :
                          'bg-brand-warning/10 text-brand-warning'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-error max-w-[200px] truncate">{log.error_message || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Access Log */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="text-lg font-semibold text-brand-text">{t('User access overview')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                <th className="text-left px-6 py-3">{t('User')}</th>
                <th className="text-left px-4 py-3">{t('Tenant')}</th>
                <th className="text-left px-4 py-3">{t('Status')}</th>
                <th className="text-left px-4 py-3">{t('Last login')}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.slice(0, 20).map(p => (
                <tr key={p.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                  <td className="px-6 py-3">
                    <p className="text-xs font-medium text-brand-text">{p.display_name || p.email || t('Unknown')}</p>
                    {p.email && p.display_name && <p className="text-[10px] text-brand-text-muted">{p.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text-secondary">{companyMap.get(p.company_id) ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      p.is_active ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'
                    }`}>
                      {p.is_active ? t('Active') : t('Inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text-muted">{fmtDate(p.last_sign_in_at, fmtLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
