import { shell } from './shell'
import { analytics } from './analytics'
import { billing } from './billing'
import { bots } from './bots'
import { compliance } from './compliance'
import { connectors } from './connectors'
import { dashboard } from './dashboard'
import { health } from './health'
import { reports } from './reports'
import { routeBot } from './routeBot'
import { settings } from './settings'
import { tenantDetail } from './tenantDetail'
import { tenants } from './tenants'
import { users } from './users'

/** German dictionary — one file per page, merged here. Keys are the English source strings. */
export const de: Record<string, string> = {
  ...shell,
  ...analytics,
  ...billing,
  ...bots,
  ...compliance,
  ...connectors,
  ...dashboard,
  ...health,
  ...reports,
  ...routeBot,
  ...settings,
  ...tenantDetail,
  ...tenants,
  ...users,
}
