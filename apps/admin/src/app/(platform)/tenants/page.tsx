export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { getT } from '@/i18n/server'

export default async function TenantsPage() {
  const t = getT()
  const supabase = createServiceClient()

  const [companiesRes, connectorsRes, featuresRes] = await Promise.all([
    supabase.from('companies').select('*').order('name'),
    supabase.from('connectors').select('company_id, type, name, status, last_synced_at'),
    supabase.from('company_feature_flags').select('company_id, finanzplanung_enabled'),
  ])

  const companies = companiesRes.data ?? []
  const connectors = connectorsRes.data ?? []
  const features = featuresRes.data ?? []

  const connectorsByCompany = connectors.reduce<Record<string, typeof connectors>>((acc, c) => {
    if (!acc[c.company_id]) acc[c.company_id] = []
    acc[c.company_id].push(c)
    return acc
  }, {})

  const featuresByCompany = features.reduce<Record<string, typeof features[0]>>((acc, f) => {
    acc[f.company_id] = f
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">{t('Tenants')}</h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            {t('All registered companies and their configuration')}
          </p>
        </div>
        <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
          {companies.length} {t('Tenants')}
        </span>
      </div>

      <div className="space-y-4">
        {companies.map((company) => {
          const companyConnectors = connectorsByCompany[company.id] ?? []
          const companyFeatures = featuresByCompany[company.id]
          const activeCount = companyConnectors.filter(c => c.status === 'active').length
          const errorCount = companyConnectors.filter(c => c.status === 'error').length

          return (
            <Link
              key={company.id}
              href={`/tenants/${company.slug}`}
              className="block rounded-xl border border-brand-border bg-brand-surface p-5 hover:border-brand-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${company.status === 'active' ? 'bg-brand-success' : 'bg-brand-text-muted'}`} />
                    <h3 className="text-base font-semibold text-brand-text">{company.name}</h3>
                    <span className="text-xs text-brand-text-muted">({company.slug})</span>
                  </div>
                  <div className="mt-2 flex items-center gap-4">
                    <span className="text-xs text-brand-text-muted">
                      {activeCount}/{companyConnectors.length} {t('connectors active')}
                    </span>
                    {errorCount > 0 && (
                      <span className="text-xs text-brand-error">{errorCount} {t('errors')}</span>
                    )}
                    {companyFeatures?.finanzplanung_enabled && (
                      <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-[10px] font-medium text-brand-accent">
                        {t('Financial planning')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-brand-text-muted">{t('Connectors')}</p>
                  <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                    {companyConnectors.map((cn) => (
                      <span
                        key={`${cn.company_id}-${cn.type}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          cn.status === 'active'
                            ? 'bg-brand-success/10 text-brand-success'
                            : cn.status === 'error'
                              ? 'bg-brand-error/10 text-brand-error'
                              : 'bg-brand-text-muted/10 text-brand-text-muted'
                        }`}
                      >
                        <span className={`h-1 w-1 rounded-full ${
                          cn.status === 'active' ? 'bg-brand-success' : cn.status === 'error' ? 'bg-brand-error' : 'bg-brand-text-muted'
                        }`} />
                        {cn.name}
                      </span>
                    ))}
                    {companyConnectors.length === 0 && (
                      <span className="text-[10px] text-brand-text-muted">{t('None')}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
