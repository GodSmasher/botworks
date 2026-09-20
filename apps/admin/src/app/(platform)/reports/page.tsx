export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { getT, getLocale } from '@/i18n/server'

function fmtNumWith(n: number, fmtLocale: string): string {
  return n.toLocaleString(fmtLocale)
}

function fmtMoneyWith(n: number, fmtLocale: string): string {
  return `EUR ${Math.round(n).toLocaleString(fmtLocale)}`
}

export default async function ReportsPage() {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const fmtNum = (n: number) => fmtNumWith(n, fmtLocale)
  const fmtMoney = (n: number) => fmtMoneyWith(n, fmtLocale)
  const supabase = createServiceClient()

  const [
    companiesRes, leadsRes, offersRes, projectsRes,
    wonLeadsRes, lostLeadsRes,
    suppliersRes, invoicesRes,
    connectorsRes, botLogsRes, syncLogRes,
  ] = await Promise.all([
    supabase.from('companies').select('id, name, slug'),
    supabase.from('leads').select('id, company_id, status, source, created_at'),
    supabase.from('offers').select('id, company_id, status, total_amount, created_at'),
    supabase.from('projects').select('id, company_id, phase, created_at'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'won'),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'lost'),
    supabase.from('suppliers').select('*', { count: 'exact', head: true }),
    supabase.from('invoices_incoming').select('id, gross_amount, status'),
    supabase.from('connectors').select('id, type, status'),
    supabase.from('bot_logs').select('id, status'),
    supabase.from('connector_sync_log').select('id, status, records_synced'),
  ])

  const companies = (companiesRes.data ?? []) as Array<{ id: string; name: string; slug: string }>
  const leads = (leadsRes.data ?? []) as Array<{ id: string; company_id: string; status: string; source: string; created_at: string }>
  const offers = (offersRes.data ?? []) as Array<{ id: string; company_id: string; status: string; total_amount: number | null; created_at: string }>
  const projects = (projectsRes.data ?? []) as Array<{ id: string; company_id: string; phase: string; created_at: string }>
  const invoices = (invoicesRes.data ?? []) as Array<{ id: string; gross_amount: number; status: string }>
  const botLogs = (botLogsRes.data ?? []) as Array<{ id: string; status: string }>
  const syncLogs = (syncLogRes.data ?? []) as Array<{ id: string; status: string; records_synced: number }>

  const totalWon = wonLeadsRes.count ?? 0
  const totalLost = lostLeadsRes.count ?? 0
  const totalSuppliers = suppliersRes.count ?? 0
  const totalPipeline = offers.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
  const totalInvoiceVolume = invoices.reduce((sum, i) => sum + (i.gross_amount ?? 0), 0)
  const paidInvoices = invoices.filter(i => i.status === 'paid').length

  // Lead sources
  const sourceCounts: Record<string, number> = {}
  for (const l of leads) {
    const src = l.source || t('unknown')
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)

  // Project phases
  const phaseCounts: Record<string, number> = {}
  for (const p of projects) {
    const phase = p.phase || t('unknown')
    phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1
  }
  const topPhases = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])

  // Sync stats
  const totalSynced = syncLogs.reduce((sum, s) => sum + (s.records_synced ?? 0), 0)
  const syncSuccessRate = syncLogs.length > 0
    ? Math.round((syncLogs.filter(s => s.status === 'success').length / syncLogs.length) * 100)
    : 0
  const botSuccessRate = botLogs.length > 0
    ? Math.round((botLogs.filter(l => l.status === 'success').length / botLogs.length) * 100)
    : 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-text mb-2">{t('Reports')}</h1>
      <p className="text-sm text-brand-text-secondary mb-8">{t('Platform analytics and metrics')}</p>

      {/* Executive Summary */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-8">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Executive Summary')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: t('Total leads'), value: fmtNum(leads.length) },
            { label: t('Won'), value: fmtNum(totalWon), color: 'text-brand-success' },
            { label: t('Lost'), value: fmtNum(totalLost), color: 'text-brand-error' },
            { label: t('Pipeline'), value: fmtMoney(totalPipeline) },
            { label: t('Invoice volume'), value: fmtMoney(totalInvoiceVolume) },
            { label: t('Suppliers'), value: fmtNum(totalSuppliers) },
          ].map(kpi => (
            <div key={kpi.label} className="text-center">
              <p className="text-[10px] text-brand-text-muted uppercase tracking-wide font-medium">{kpi.label}</p>
              <p className={`text-lg font-bold mt-1 ${kpi.color ?? 'text-brand-text'}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Lead-Quellen */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Lead sources')}</h2>
          <div className="space-y-3">
            {topSources.map(([source, count]) => {
              const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0
              return (
                <div key={source}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-brand-text capitalize">{source.replace(/_/g, ' ')}</span>
                    <span className="text-brand-text-muted">{fmtNum(count)} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-brand-background overflow-hidden">
                    <div className="h-full rounded-full bg-brand-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Projekt-Phasen */}
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
          <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Project phases')}</h2>
          <div className="space-y-3">
            {topPhases.map(([phase, count]) => {
              const pct = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0
              return (
                <div key={phase}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-brand-text capitalize">{phase.replace(/_/g, ' ')}</span>
                    <span className="text-brand-text-muted">{fmtNum(count)} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-brand-background overflow-hidden">
                    <div className="h-full rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* System Health Metrics */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 mb-8">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('System metrics')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-brand-border bg-brand-background p-4 text-center">
            <p className="text-[10px] text-brand-text-muted uppercase tracking-wide font-medium">{t('Sync success rate')}</p>
            <p className={`text-2xl font-bold mt-1 ${syncSuccessRate >= 90 ? 'text-brand-success' : syncSuccessRate >= 70 ? 'text-brand-warning' : 'text-brand-error'}`}>{syncSuccessRate}%</p>
          </div>
          <div className="rounded-lg border border-brand-border bg-brand-background p-4 text-center">
            <p className="text-[10px] text-brand-text-muted uppercase tracking-wide font-medium">{t('Bot success rate')}</p>
            <p className={`text-2xl font-bold mt-1 ${botSuccessRate >= 90 ? 'text-brand-success' : botSuccessRate >= 70 ? 'text-brand-warning' : 'text-brand-error'}`}>{botSuccessRate}%</p>
          </div>
          <div className="rounded-lg border border-brand-border bg-brand-background p-4 text-center">
            <p className="text-[10px] text-brand-text-muted uppercase tracking-wide font-medium">{t('Records synced')}</p>
            <p className="text-2xl font-bold mt-1 text-brand-text">{fmtNum(totalSynced)}</p>
          </div>
          <div className="rounded-lg border border-brand-border bg-brand-background p-4 text-center">
            <p className="text-[10px] text-brand-text-muted uppercase tracking-wide font-medium">{t('Invoices paid')}</p>
            <p className="text-2xl font-bold mt-1 text-brand-text">{paidInvoices} / {invoices.length}</p>
          </div>
        </div>
      </div>

      {/* Per-tenant breakdown */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="text-lg font-semibold text-brand-text">{t('Tenant comparison')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                <th className="text-left px-6 py-3">{t('Tenant')}</th>
                <th className="text-right px-4 py-3">{t('Leads')}</th>
                <th className="text-right px-4 py-3">{t('Offers')}</th>
                <th className="text-right px-4 py-3">{t('Projects')}</th>
                <th className="text-right px-4 py-3">{t('Pipeline (EUR)')}</th>
                <th className="text-right px-4 py-3">{t('Conversion')}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => {
                const cLeads = leads.filter(l => l.company_id === c.id).length
                const cOffers = offers.filter(o => o.company_id === c.id)
                const cProjects = projects.filter(p => p.company_id === c.id).length
                const cPipeline = cOffers.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
                const cWon = leads.filter(l => l.company_id === c.id && l.status === 'won').length
                const cConversion = cLeads > 0 ? ((cWon / cLeads) * 100).toFixed(1) : '0'
                return (
                  <tr key={c.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                    <td className="px-6 py-3 text-xs font-medium text-brand-text">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-brand-text text-right">{fmtNum(cLeads)}</td>
                    <td className="px-4 py-3 text-xs text-brand-text text-right">{fmtNum(cOffers.length)}</td>
                    <td className="px-4 py-3 text-xs text-brand-text text-right">{fmtNum(cProjects)}</td>
                    <td className="px-4 py-3 text-xs text-brand-text text-right font-mono">{fmtMoney(cPipeline)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium ${parseFloat(cConversion) > 5 ? 'text-brand-success' : 'text-brand-text-muted'}`}>
                        {cConversion}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
