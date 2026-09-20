export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { getT, getLocale } from '@/i18n/server'

function fmtNumWith(n: number, fmtLocale: string): string {
  return n.toLocaleString(fmtLocale)
}

export default async function BillingPage() {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const fmtNum = (n: number) => fmtNumWith(n, fmtLocale)
  const supabase = createServiceClient()

  const [companiesRes, connectorsRes, leadsRes, projectsRes, offersRes, profilesRes, botStatusRes] = await Promise.all([
    supabase.from('companies').select('id, name, slug, status, created_at'),
    supabase.from('connectors').select('id, company_id, type, status'),
    supabase.from('leads').select('company_id', { count: 'exact' }),
    supabase.from('projects').select('company_id', { count: 'exact' }),
    supabase.from('offers').select('company_id, total_amount', { count: 'exact' }),
    supabase.from('profiles').select('company_id', { count: 'exact' }),
    supabase.from('bot_status').select('bot_name'),
  ])

  const companies = (companiesRes.data ?? []) as Array<{ id: string; name: string; slug: string; status: string; created_at: string }>
  const connectors = (connectorsRes.data ?? []) as Array<{ id: string; company_id: string; type: string; status: string }>
  const leads = (leadsRes.data ?? []) as Array<{ company_id: string }>
  const projects = (projectsRes.data ?? []) as Array<{ company_id: string }>
  const offers = (offersRes.data ?? []) as Array<{ company_id: string; total_amount: number | null }>
  const profiles = (profilesRes.data ?? []) as Array<{ company_id: string }>
  const botCount = (botStatusRes.data ?? []).length

  // Per-company usage
  const tenantUsage = companies.map(c => {
    const cLeads = leads.filter(l => l.company_id === c.id).length
    const cProjects = projects.filter(p => p.company_id === c.id).length
    const cOffers = offers.filter(o => o.company_id === c.id)
    const cPipeline = cOffers.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
    const cUsers = profiles.filter(p => p.company_id === c.id).length
    const cConnectors = connectors.filter(cn => cn.company_id === c.id)
    const activeConn = cConnectors.filter(cn => cn.status === 'active').length

    return {
      ...c,
      leads: cLeads,
      projects: cProjects,
      offers: cOffers.length,
      pipeline: cPipeline,
      users: cUsers,
      connectors: cConnectors.length,
      activeConnectors: activeConn,
    }
  })

  const totalLeads = leadsRes.count ?? 0
  const totalProjects = projectsRes.count ?? 0
  const totalOffers = offersRes.count ?? 0
  const totalUsers = profilesRes.count ?? 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-text mb-2">{t('Billing & Usage')}</h1>
      <p className="text-sm text-brand-text-secondary mb-8">{t('Resource consumption and billing overview per tenant')}</p>

      {/* Platform totals */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: t('Tenants'), value: companies.length },
          { label: t('Users'), value: totalUsers },
          { label: t('Leads'), value: fmtNum(totalLeads) },
          { label: t('Projects'), value: fmtNum(totalProjects) },
          { label: t('Bots'), value: botCount },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-brand-border bg-brand-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold text-brand-text">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Per-tenant usage table */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-border">
          <h2 className="text-lg font-semibold text-brand-text">{t('Usage per tenant')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                <th className="text-left px-6 py-3">{t('Tenant')}</th>
                <th className="text-right px-4 py-3">{t('Users')}</th>
                <th className="text-right px-4 py-3">{t('Leads')}</th>
                <th className="text-right px-4 py-3">{t('Projects')}</th>
                <th className="text-right px-4 py-3">{t('Offers')}</th>
                <th className="text-right px-4 py-3">{t('Pipeline (EUR)')}</th>
                <th className="text-right px-4 py-3">{t('Connectors')}</th>
                <th className="text-left px-4 py-3">{t('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {tenantUsage.map(tu => (
                <tr key={tu.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-brand-text">{tu.name}</p>
                    <p className="text-[10px] text-brand-text-muted">{tu.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text text-right font-medium">{tu.users}</td>
                  <td className="px-4 py-3 text-xs text-brand-text text-right">{fmtNum(tu.leads)}</td>
                  <td className="px-4 py-3 text-xs text-brand-text text-right">{fmtNum(tu.projects)}</td>
                  <td className="px-4 py-3 text-xs text-brand-text text-right">{fmtNum(tu.offers)}</td>
                  <td className="px-4 py-3 text-xs text-brand-text text-right font-mono">
                    {tu.pipeline > 0 ? `${fmtNum(Math.round(tu.pipeline))}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-text text-right">
                    <span className="text-brand-success">{tu.activeConnectors}</span>
                    <span className="text-brand-text-muted"> / {tu.connectors}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      tu.status === 'active' ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-text-muted/10 text-brand-text-muted'
                    }`}>
                      {tu.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Billing note */}
      <div className="mt-6 rounded-xl border border-brand-border bg-brand-surface p-6">
        <h3 className="text-sm font-semibold text-brand-text mb-2">{t('Billing note')}</h3>
        <p className="text-xs text-brand-text-secondary leading-relaxed">
          {t('Billing is based on active tenants, number of users and connectors in use.')}{' '}
          {t('Detailed invoicing and payment history will be available in a future version.')}
        </p>
      </div>
    </div>
  )
}
