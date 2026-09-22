import { isMockMode } from '@botworks/core'
import type { Bot } from '@botworks/core'
import type { ConnectorConfig, ConnectorType } from '@botworks/types'

/**
 * Connector configuration handed to a bot at run time.
 *
 * In mock mode every connector the manifest mentions is considered configured,
 * so the API can run any bot without tenant setup. In live mode this is where
 * the tenant's stored connector credentials would be loaded.
 */
export function connectorsFor(bot: Bot, companyId: string): Map<ConnectorType, ConnectorConfig> {
  const map = new Map<ConnectorType, ConnectorConfig>()
  if (!isMockMode()) return map
  for (const type of [...bot.manifest.requiredConnectors, ...(bot.manifest.optionalConnectors ?? [])]) {
    map.set(type, { type, companyId, credentials: {}, settings: {} } as unknown as ConnectorConfig)
  }
  return map
}
