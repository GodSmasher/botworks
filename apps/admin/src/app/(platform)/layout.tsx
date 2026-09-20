export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import { PlatformSidebar } from '@/components/platform-sidebar'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServiceClient()

  // Fetch all companies (tenants) with their connector counts
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, slug, status')
    .eq('status', 'active')
    .order('name')

  const { data: connectors } = await supabase
    .from('connectors')
    .select('company_id, status')

  const connectorsByCompany = (connectors ?? []).reduce<Record<string, { total: number; errors: number }>>((acc, c) => {
    if (!acc[c.company_id]) acc[c.company_id] = { total: 0, errors: 0 }
    acc[c.company_id].total++
    if (c.status === 'error') acc[c.company_id].errors++
    return acc
  }, {})

  const tenants = (companies ?? []).map((c) => {
    const stats = connectorsByCompany[c.id]
    return {
      name: c.name,
      slug: c.slug,
      status: !stats
        ? 'offline' as const
        : stats.errors > 0
          ? 'warning' as const
          : 'online' as const,
      connectorCount: stats?.total ?? 0,
    }
  })

  return (
    <div className="min-h-screen bg-brand-background">
      <PlatformSidebar tenants={tenants} />
      <main className="pl-64">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
