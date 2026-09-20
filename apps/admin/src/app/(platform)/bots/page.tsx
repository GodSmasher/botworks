export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { botsApiFetch, botsApiLabel } from '@/lib/bots-api'
import { getT, getLocale } from '@/i18n/server'
import type { TFunction } from '@/i18n'


interface BotInfo {
  id: string
  name: string
  description: string
  version: string
  tier: string
  requiredConnectors?: string[]
  optionalConnectors?: string[]
}

function timeAgo(date: string | null, t: TFunction): string {
  if (!date) return '—'
  const ms = Date.now() - new Date(date).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n}m ago').replace('{n}', String(mins))
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('{n}h ago').replace('{n}', String(hours))
  const days = Math.floor(hours / 24)
  return t('{n}d ago').replace('{n}', String(days))
}

function fmtDate(date: string | null, fmtLocale: string): string {
  if (!date) return '—'
  const d = new Date(date)
  return `${d.toLocaleDateString(fmtLocale)} ${d.toLocaleTimeString(fmtLocale, { hour: '2-digit', minute: '2-digit' })}`
}

export default async function BotsPage() {
  const t = getT()
  const fmtLocale = getLocale() === 'de' ? 'de-DE' : 'en-GB'
  const supabase = createServiceClient()

  // Try external Bot API (optional — may not be running)
  let bots: BotInfo[] = []
  let apiReachable = false
  try {
    const res = await botsApiFetch('/api/bots')
    if (res.ok) {
      const data = await res.json()
      bots = Array.isArray(data) ? data : (data.data ?? data.bots ?? [])
      apiReachable = true
    }
  } catch {}

  // Always fetch live status from Supabase
  const [statusRes, logsRes, kpisRes] = await Promise.all([
    supabase.from('bot_status').select('*').order('last_heartbeat', { ascending: false }),
    supabase.from('bot_logs').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('bot_kpis').select('*').order('taken_at', { ascending: false }).limit(20),
  ])
  const botStatuses = (statusRes.data ?? []) as Array<{
    bot_name: string; status: string; last_heartbeat: string;
    last_action: string; last_action_at: string; last_error: string | null;
    details: Record<string, unknown>
  }>
  const botLogs = (logsRes.data ?? []) as Array<{
    id: string; bot_name: string; aktion: string; status: string;
    created_at: string; details: Record<string, unknown>
  }>
  const botKpis = (kpisRes.data ?? []) as Array<{
    id: string; taken_at: string; scope: string; scope_key: string;
    metric: string; value: number; source: string
  }>

  const botsOnline = botStatuses.filter(
    s => s.last_heartbeat && Date.now() - new Date(s.last_heartbeat).getTime() < 24 * 60 * 60 * 1000
  ).length
  const errorsToday = botLogs.filter(l =>
    l.status === 'error' && Date.now() - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000
  ).length
  const successToday = botLogs.filter(l =>
    l.status === 'success' && Date.now() - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000
  ).length

  // Group bots by tier (from API)
  const tiers: Record<string, BotInfo[]> = {}
  for (const bot of bots) {
    const tier = bot.tier ?? 'unknown'
    if (!tiers[tier]) tiers[tier] = []
    tiers[tier].push(bot)
  }
  const TIER_LABELS: Record<string, { label: string; color: string }> = {
    tier1: { label: 'Tier 1 — MVP', color: 'text-brand-primary bg-brand-primary/10' },
    tier2: { label: 'Tier 2 — Standard', color: 'text-brand-accent bg-brand-accent/10' },
    tier3: { label: t('Tier 3 — Industry'), color: 'text-brand-warning bg-brand-warning/10' },
    unknown: { label: t('Other'), color: 'text-brand-text-muted bg-brand-text-muted/10' },
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Bot Fleet</h1>
          <p className="text-sm text-brand-text-secondary mt-1">{t('All registered bots and their status')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            apiReachable ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${apiReachable ? 'bg-brand-success' : 'bg-brand-error'}`} />
            Bot API {apiReachable ? t('Online') : t('Offline')}
          </span>
          <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
            {botStatuses.length} {t('instances')}
          </span>
        </div>
      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">{t('Registered')}</p>
          <p className="mt-2 text-2xl font-bold text-brand-text">{botStatuses.length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">{t('Online')}</p>
          <p className="mt-2 text-2xl font-bold text-brand-success">{botsOnline}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">{t('Successes (24h)')}</p>
          <p className="mt-2 text-2xl font-bold text-brand-text">{successToday}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">{t('Errors (24h)')}</p>
          <p className="mt-2 text-2xl font-bold text-brand-error">{errorsToday}</p>
        </div>
      </div>

      {/* Live Bot Status Cards */}
      {botStatuses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-brand-text mb-4">{t('Live status')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {botStatuses.filter(s => s.bot_name !== 'test-bot').map(s => {
              const online = !!s.last_heartbeat && Date.now() - new Date(s.last_heartbeat).getTime() < 24 * 60 * 60 * 1000
              return (
                <div key={s.bot_name} className="rounded-xl border border-brand-border bg-brand-surface p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-success opacity-75" />}
                        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? 'bg-brand-success' : 'bg-brand-error'}`} />
                      </span>
                      <span className="text-sm font-semibold text-brand-text capitalize">{s.bot_name}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      online ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-error/10 text-brand-error'
                    }`}>
                      {online ? t('Online') : t('Offline')}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-brand-text-muted">
                      <span>Heartbeat</span>
                      <span className="text-brand-text font-medium">{timeAgo(s.last_heartbeat, t)}</span>
                    </div>
                    <div className="flex justify-between text-brand-text-muted">
                      <span>{t('Last action')}</span>
                      <span className="text-brand-text font-medium">{s.last_action || '—'}</span>
                    </div>
                    {s.last_action_at && (
                      <div className="flex justify-between text-brand-text-muted">
                        <span>{t('Action at')}</span>
                        <span className="text-brand-text font-medium">{fmtDate(s.last_action_at, fmtLocale)}</span>
                      </div>
                    )}
                    {s.last_error && (
                      <div className="mt-2 rounded-lg bg-brand-error/5 border border-brand-error/10 px-3 py-2">
                        <p className="text-[11px] text-brand-error">{s.last_error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bot API fleet (if reachable) */}
      {apiReachable && Object.entries(tiers).map(([tier, tierBots]) => {
        const tierInfo = TIER_LABELS[tier] ?? TIER_LABELS.unknown
        return (
          <div key={tier} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold text-brand-text">Tier: {tierInfo.label}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tierInfo.color}`}>
                {tierBots.length} Bots
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tierBots.map((bot) => (
                <div key={bot.id} className="rounded-xl border border-brand-border bg-brand-surface p-5 hover:border-brand-primary/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
                      <span className="text-brand-primary text-lg">🤖</span>
                    </div>
                    <span className="text-[10px] text-brand-text-muted">v{bot.version}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-brand-text mb-1">{bot.name}</h3>
                  <p className="text-xs text-brand-text-secondary mb-3 line-clamp-2">{bot.description}</p>
                  {(() => {
                    const allConn = [...(bot.requiredConnectors ?? []), ...(bot.optionalConnectors ?? [])]
                    return allConn.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {allConn.map((c) => (
                          <span key={c} className="rounded-full bg-brand-background px-2 py-0.5 text-[10px] text-brand-text-muted border border-brand-border">{c}</span>
                        ))}
                      </div>
                    ) : null
                  })()}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {!apiReachable && botStatuses.length === 0 && (
        <div className="rounded-xl border border-brand-warning/30 bg-brand-warning/5 p-4 mb-6">
          <p className="text-sm text-brand-warning">
            {t('Bot API at {url} is not reachable and there is no bot data in Supabase.').replace('{url}', botsApiLabel)}
          </p>
        </div>
      )}

      {/* Activity Log */}
      {botLogs.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-text">{t('Activity log')}</h2>
            <span className="text-xs text-brand-text-muted">{botLogs.length} {t('entries')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                  <th className="text-left px-6 py-3">{t('Time')}</th>
                  <th className="text-left px-4 py-3">Bot</th>
                  <th className="text-left px-4 py-3">{t('Action')}</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {botLogs.map(log => {
                  const detailStr = log.details
                    ? Object.entries(log.details).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${v}`).join(', ')
                    : ''
                  return (
                    <tr key={log.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                      <td className="px-6 py-3 text-xs text-brand-text-muted whitespace-nowrap">{fmtDate(log.created_at, fmtLocale)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-brand-text capitalize">{log.bot_name}</td>
                      <td className="px-4 py-3 text-xs text-brand-text-secondary">{log.aktion}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          log.status === 'success' ? 'bg-brand-success/10 text-brand-success' :
                          log.status === 'error' ? 'bg-brand-error/10 text-brand-error' :
                          'bg-brand-warning/10 text-brand-warning'
                        }`}>
                          {log.status === 'success' ? t('Success') : log.status === 'error' ? t('Error') : log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-text-muted max-w-[250px] truncate">{detailStr || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bot KPIs */}
      {botKpis.length > 0 && (
        <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-border">
            <h2 className="text-lg font-semibold text-brand-text">{t('Bot KPIs')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[10px] font-semibold text-brand-text-muted uppercase tracking-wide">
                  <th className="text-left px-6 py-3">{t('Time')}</th>
                  <th className="text-left px-4 py-3">Scope</th>
                  <th className="text-left px-4 py-3">{t('Metric')}</th>
                  <th className="text-right px-4 py-3">{t('Value')}</th>
                  <th className="text-left px-4 py-3">{t('Source')}</th>
                </tr>
              </thead>
              <tbody>
                {botKpis.map(kpi => (
                  <tr key={kpi.id} className="border-b border-brand-border/50 hover:bg-brand-surface-hover transition-colors">
                    <td className="px-6 py-3 text-xs text-brand-text-muted whitespace-nowrap">{fmtDate(kpi.taken_at, fmtLocale)}</td>
                    <td className="px-4 py-3 text-xs text-brand-text">{kpi.scope_key || kpi.scope}</td>
                    <td className="px-4 py-3 text-xs text-brand-text font-medium">{kpi.metric}</td>
                    <td className="px-4 py-3 text-xs text-brand-text font-mono text-right">{kpi.value}</td>
                    <td className="px-4 py-3 text-xs text-brand-text-muted">{kpi.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
