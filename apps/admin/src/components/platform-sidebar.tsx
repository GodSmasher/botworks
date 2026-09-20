'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Bot,
  BarChart3,
  Settings,
  Plug,
  Users,
  Shield,
  CreditCard,
  FileText,
  Activity,
  LogOut,
  MapPin,
} from 'lucide-react'
import { useLocale, useT } from '@/i18n/client'

const NAV_SECTIONS = [
  {
    label: 'OVERVIEW',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/tenants', label: 'Tenants', icon: Building2 },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'AUTOMATION',
    items: [
      { href: '/bots', label: 'Bot Fleet', icon: Bot },
      { href: '/connectors', label: 'Connectors', icon: Plug },
      { href: '/route-bot', label: 'Route Bot', icon: MapPin },
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { href: '/users', label: 'Users', icon: Users },
      { href: '/billing', label: 'Billing', icon: CreditCard },
      { href: '/compliance', label: 'Compliance', icon: Shield },
      { href: '/reports', label: 'Reports', icon: FileText },
      { href: '/health', label: 'System Health', icon: Activity },
    ],
  },
]

interface TenantStatus {
  name: string
  slug: string
  status: 'online' | 'warning' | 'offline'
  connectorCount: number
}

export function PlatformSidebar({ tenants }: { tenants?: TenantStatus[] }) {
  const pathname = usePathname()
  const t = useT()
  const locale = useLocale()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-brand-border bg-brand-surface">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-brand-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary text-white font-bold text-sm">
          b
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-text">botworks</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-brand-primary">{t('AI Platform')}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted">
              {t(section.label)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-brand-primary/10 text-brand-primary font-medium'
                          : 'text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {t(item.label)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Live Tenant Status */}
        {tenants && tenants.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted">
              {t('Active tenants')}
            </p>
            <ul className="space-y-0.5">
              {tenants.map((tenant) => (
                <li key={tenant.slug}>
                  <Link
                    href={`/tenants/${tenant.slug}`}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text transition-colors"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        tenant.status === 'online'
                          ? 'bg-brand-success'
                          : tenant.status === 'warning'
                            ? 'bg-brand-warning'
                            : 'bg-brand-error'
                      }`}
                    />
                    <span className="truncate">{tenant.name}</span>
                    <span className="ml-auto text-[10px] text-brand-text-muted">{tenant.connectorCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Settings + Footer */}
      <div className="border-t border-brand-border p-3">
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
            pathname.startsWith('/settings')
              ? 'bg-brand-primary/10 text-brand-primary font-medium'
              : 'text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text'
          }`}
        >
          <Settings className="h-4 w-4" />
          {t('Settings')}
        </Link>
        {/* Language switch — plain links, so it works without client state */}
        <div className="mt-2 flex items-center gap-1 px-2.5" aria-label={t('Language')}>
          {(['en', 'de'] as const).map((l) => (
            <a
              key={l}
              href={`/lang?to=${l}&next=${encodeURIComponent(pathname)}`}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                locale === l ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-text-muted hover:text-brand-text'
              }`}
            >
              {l}
            </a>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 px-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/20 text-xs font-semibold text-brand-primary">
            PA
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-brand-text">botworks Admin</p>
            <p className="truncate text-[10px] text-brand-text-muted">Platform Admin</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
