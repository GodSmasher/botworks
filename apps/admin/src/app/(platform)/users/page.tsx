export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { getLocale, getT } from '@/i18n/server'

export default async function UsersPage() {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const supabase = createServiceClient()

  const [profilesRes, companiesRes] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, display_name, company_id, is_active, last_sign_in_at').order('last_sign_in_at', { ascending: false }),
    supabase.from('companies').select('id, name'),
  ])

  const profiles = profilesRes.data ?? []
  const companyMap = (companiesRes.data ?? []).reduce<Record<string, string>>((acc, c) => { acc[c.id] = c.name; return acc }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">{t('Users')}</h1>
          <p className="text-sm text-brand-text-secondary mt-1">{t('All users across all tenants')}</p>
        </div>
        <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
          {profiles.length} {t('Users')}
        </span>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-text-muted font-medium">{t('Name')}</th>
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-text-muted font-medium">{t('Tenant')}</th>
              <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-text-muted font-medium">{t('Status')}</th>
              <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-brand-text-muted font-medium">{t('Last login')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {profiles.map((p) => (
              <tr key={p.id} className="hover:bg-brand-surface-hover transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-brand-text">
                    {p.display_name ?? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || t('Unknown'))}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm text-brand-text-secondary">
                  {p.company_id ? companyMap[p.company_id] ?? '—' : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs ${p.is_active ? 'text-brand-success' : 'text-brand-text-muted'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${p.is_active ? 'bg-brand-success' : 'bg-brand-text-muted'}`} />
                    {p.is_active ? t('Active') : t('Inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-brand-text-muted">
                  {p.last_sign_in_at ? new Date(p.last_sign_in_at).toLocaleString(fmtLocale) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
