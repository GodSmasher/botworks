// Offline (mock mode) inventory analysis: plain arithmetic on the given stock data.

export interface MockItem {
  id: string
  name: string
  currentStock: number
  reorderThreshold?: number
  unit: string
  avgDailyConsumption?: number
  expiryDate?: string
  lastMovementDate?: string
  unitPrice?: number
}

interface MockAlert {
  itemId: string
  itemName: string
  type: 'low_stock' | 'expiring' | 'slow_moving' | 'out_of_stock'
  urgency: 'critical' | 'warning' | 'info'
  message: string
  suggestedAction: string
  daysUntilIssue?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days from `from` to `to` (negative if `to` is in the past); null for unparsable dates. */
function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / DAY_MS)
}

/** Reorder suggestion: 30 days of consumption, or twice the threshold if consumption is unknown. */
function reorderQuantity(item: MockItem): number {
  if (item.avgDailyConsumption && item.avgDailyConsumption > 0) return Math.ceil(item.avgDailyConsumption * 30)
  if (item.reorderThreshold && item.reorderThreshold > 0) return Math.ceil(item.reorderThreshold * 2)
  return 10
}

function alertsForItem(item: MockItem, checkDate: string, expiryWarningDays: number, slowMovingDays: number): MockAlert[] {
  const alerts: MockAlert[] = []
  const base = { itemId: item.id, itemName: item.name }
  const daysOfStock = item.avgDailyConsumption && item.avgDailyConsumption > 0
    ? Math.floor(item.currentStock / item.avgDailyConsumption)
    : undefined

  if (item.currentStock <= 0) {
    alerts.push({
      ...base,
      type: 'out_of_stock',
      urgency: 'critical',
      message: `Out of stock (0 ${item.unit})`,
      suggestedAction: `Reorder ${reorderQuantity(item)} ${item.unit} immediately`,
      daysUntilIssue: 0,
    })
  } else if (item.reorderThreshold !== undefined && item.currentStock <= item.reorderThreshold) {
    const critical = daysOfStock !== undefined && daysOfStock <= 3
    alerts.push({
      ...base,
      type: 'low_stock',
      urgency: critical ? 'critical' : 'warning',
      message: `Stock at ${item.currentStock} ${item.unit}, reorder threshold is ${item.reorderThreshold}`,
      suggestedAction: `Reorder ${reorderQuantity(item)} ${item.unit}`,
      ...(daysOfStock !== undefined ? { daysUntilIssue: daysOfStock } : {}),
    })
  }

  if (item.expiryDate && item.currentStock > 0) {
    const daysLeft = daysBetween(checkDate, item.expiryDate)
    if (daysLeft !== null && daysLeft <= expiryWarningDays) {
      const expired = daysLeft < 0
      alerts.push({
        ...base,
        type: 'expiring',
        urgency: daysLeft <= 7 ? 'critical' : 'warning',
        message: expired
          ? `Expired ${-daysLeft} day(s) ago (${item.expiryDate}), ${item.currentStock} ${item.unit} affected`
          : `Expires in ${daysLeft} day(s) (${item.expiryDate}), ${item.currentStock} ${item.unit} on hand`,
        suggestedAction: expired ? 'Remove from stock and write off' : 'Use or sell first (FEFO), consider a discount',
        daysUntilIssue: Math.max(0, daysLeft),
      })
    }
  }

  if (item.lastMovementDate && item.currentStock > 0) {
    const idleDays = daysBetween(item.lastMovementDate, checkDate)
    if (idleDays !== null && idleDays >= slowMovingDays) {
      alerts.push({
        ...base,
        type: 'slow_moving',
        urgency: 'info',
        message: `No movement for ${idleDays} days (last: ${item.lastMovementDate})`,
        suggestedAction: 'Review demand, reduce reorder quantity or clear stock',
      })
    }
  }

  return alerts
}

const URGENCY_ORDER = { critical: 0, warning: 1, info: 2 } as const

export function mockInventoryAnalysis(
  items: MockItem[],
  checkDate: string,
  expiryWarningDays: number,
  slowMovingDays: number,
) {
  const alerts = items
    .flatMap((item) => alertsForItem(item, checkDate, expiryWarningDays, slowMovingDays))
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency])

  const flaggedIds = new Set(alerts.map((a) => a.itemId))
  const totalStockValue = items.reduce((sum, i) => sum + i.currentStock * (i.unitPrice ?? 0), 0)

  return {
    alerts,
    summary: {
      totalItems: items.length,
      criticalAlerts: alerts.filter((a) => a.urgency === 'critical').length,
      warningAlerts: alerts.filter((a) => a.urgency === 'warning').length,
      healthyItems: items.length - flaggedIds.size,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
    },
  }
}
