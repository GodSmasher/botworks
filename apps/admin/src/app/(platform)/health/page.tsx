export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { botsApiFetch, botsApiLabel } from '@/lib/bots-api'
import { getT } from '@/i18n/server'


export default async function HealthPage() {
  const t = getT()
  const supabase = createServiceClient()

  // Check Supabase
  let supabaseOk = false
  try {
    const { count } = await supabase.from('companies').select('id', { count: 'exact', head: true })
    supabaseOk = count !== null
  } catch {}

  // Check Bot API
  let botApiOk = false
  let botCount = 0
  try {
    const res = await botsApiFetch('/health')
    botApiOk = res.ok
    if (res.ok) {
      const botsRes = await botsApiFetch('/api/bots')
      if (botsRes.ok) {
        const data = await botsRes.json()
        botCount = (data.bots ?? data ?? []).length
      }
    }
  } catch {}

  // Check Connectors
  const { data: connectors } = await supabase.from('connectors').select('id, status')
  const activeConnectors = (connectors ?? []).filter(c => c.status === 'active').length
  const errorConnectors = (connectors ?? []).filter(c => c.status === 'error').length

  const services = [
    { name: 'Supabase (PostgreSQL)', status: supabaseOk, detail: t('Database connection') },
    { name: 'Bot API (Hono)', status: botApiOk, detail: `${botCount} ${t('bots registered')}` },
    { name: t('Connectors'), status: errorConnectors === 0, detail: `${activeConnectors} ${t('active')}, ${errorConnectors} ${t('errors')}` },
  ]

  const allOk = services.every(s => s.status)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">System Health</h1>
          <p className="text-sm text-brand-text-secondary mt-1">{t('Status of all services')}</p>
        </div>
        <span className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium ${
          allOk ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-warning/10 text-brand-warning'
        }`}>
          <span className={`h-2 w-2 rounded-full ${allOk ? 'bg-brand-success' : 'bg-brand-warning'}`} />
          {allOk ? t('All systems OK') : t('Problems detected')}
        </span>
      </div>

      <div className="space-y-3">
        {services.map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-5"
          >
            <span className={`h-3 w-3 rounded-full shrink-0 ${s.status ? 'bg-brand-success' : 'bg-brand-error'}`} />
            <div className="flex-1">
              <p className="text-sm font-medium text-brand-text">{s.name}</p>
              <p className="text-xs text-brand-text-muted">{s.detail}</p>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${
              s.status ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'
            }`}>
              {s.status ? 'OK' : t('Error')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
