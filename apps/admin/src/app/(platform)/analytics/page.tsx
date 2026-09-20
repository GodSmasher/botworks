export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { getT } from '@/i18n/server'

export default async function AnalyticsPage() {
  const t = getT()
  const supabase = createServiceClient()

  const [offersRes, leadsRes, connectorsRes] = await Promise.all([
    supabase.from('offers').select('id, status, total_amount, company_id'),
    supabase.from('leads').select('id, company_id', { count: 'exact', head: true }),
    supabase.from('connectors').select('id, status'),
  ])

  const offers = offersRes.data ?? []
  const totalLeads = leadsRes.count ?? 0
  const connectors = connectorsRes.data ?? []

  const totalPipeline = offers.filter(o => o.status === 'draft' || o.status === 'sent').reduce((s, o) => s + Number(o.total_amount ?? 0), 0)
  const wonOffers = offers.filter(o => o.status === 'won')
  const totalWon = wonOffers.reduce((s, o) => s + Number(o.total_amount ?? 0), 0)
  const closeRate = offers.length > 0 ? Math.round((wonOffers.length / offers.length) * 100) : 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-text">{t('Platform Analytics')}</h1>
        <p className="text-sm text-brand-text-secondary mt-1">{t('Key metrics across all tenants')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Total pipeline')}</p>
          <p className="text-2xl font-bold text-brand-text mt-2">EUR {(totalPipeline / 1_000_000).toFixed(1)}M</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Total won')}</p>
          <p className="text-2xl font-bold text-brand-success mt-2">EUR {(totalWon / 1_000_000).toFixed(1)}M</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Total leads')}</p>
          <p className="text-2xl font-bold text-brand-text mt-2">{totalLeads}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">{t('Close rate')}</p>
          <p className="text-2xl font-bold text-brand-primary mt-2">{closeRate}%</p>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
        <h2 className="text-lg font-semibold text-brand-text mb-4">{t('System metrics')}</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-brand-border bg-brand-background p-4 text-center">
            <p className="text-2xl font-bold text-brand-text">{offers.length}</p>
            <p className="text-xs text-brand-text-muted mt-1">{t('Total offers')}</p>
          </div>
          <div className="rounded-lg border border-brand-border bg-brand-background p-4 text-center">
            <p className="text-2xl font-bold text-brand-success">{connectors.filter(c => c.status === 'active').length}</p>
            <p className="text-xs text-brand-text-muted mt-1">{t('Active connectors')}</p>
          </div>
          <div className="rounded-lg border border-brand-border bg-brand-background p-4 text-center">
            <p className="text-2xl font-bold text-brand-text">{wonOffers.length}</p>
            <p className="text-xs text-brand-text-muted mt-1">{t('Won deals')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
