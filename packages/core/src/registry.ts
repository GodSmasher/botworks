import type { BotManifest, BotId } from '@botworks/types'
import type { Bot } from './bot.js'
import { createLogger } from './logger.js'

const log = createLogger('registry')

/**
 * Central registry of all available bots.
 * Bots register themselves at startup; the API and queue use this to look them up.
 */
class BotRegistry {
  private bots = new Map<BotId, Bot>()

  register(bot: Bot): void {
    if (this.bots.has(bot.manifest.id)) {
      log('warn', `Bot "${bot.manifest.id}" already registered — overwriting`)
    }
    this.bots.set(bot.manifest.id, bot)
    log('info', `Registered bot: ${bot.manifest.id} (${bot.manifest.name})`)
  }

  get(id: BotId): Bot | undefined {
    return this.bots.get(id)
  }

  has(id: BotId): boolean {
    return this.bots.has(id)
  }

  list(): BotManifest[] {
    return Array.from(this.bots.values()).map((b) => b.manifest)
  }

  listByTier(tier: BotManifest['tier']): BotManifest[] {
    return this.list().filter((m) => m.tier === tier)
  }

  get size(): number {
    return this.bots.size
  }
}

/** Singleton bot registry */
export const registry = new BotRegistry()
