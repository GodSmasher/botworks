import type {
  BotManifest,
  BotContext,
  JobPayload,
  JobResult,
  ConnectorType,
  ConnectorConfig,
} from '@botworks/types'
import { createLogger } from './logger.js'

/**
 * Abstract base class for all botworks bots.
 *
 * Every bot must:
 *   1. Define a static `manifest` describing its identity and connector requirements
 *   2. Implement `execute()` with the actual bot logic
 *
 * The runtime handles queue management, logging, and connector injection.
 */
export abstract class Bot {
  abstract readonly manifest: BotManifest

  /**
   * Core bot logic — called by the runtime with a fully-populated context.
   * Must return structured output or throw on unrecoverable errors.
   */
  abstract execute(
    ctx: BotContext,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>

  /**
   * Optional: validate input before execution.
   * Return an error string if invalid, or null if OK.
   */
  validate(_input: Record<string, unknown>): string | null {
    return null
  }

  /**
   * Optional: cleanup hook called after execution (success or failure).
   */
  async cleanup(_ctx: BotContext): Promise<void> {}

  /**
   * Called by the queue worker. Orchestrates validate → execute → cleanup.
   */
  async run(payload: JobPayload, connectors: Map<ConnectorType, ConnectorConfig>): Promise<JobResult> {
    const log = createLogger(`bot:${this.manifest.id}`)
    const startedAt = new Date().toISOString()
    const jobId = `${this.manifest.id}-${Date.now()}`

    const ctx: BotContext = {
      jobId,
      companyId: payload.companyId,
      botId: this.manifest.id,
      trigger: payload.trigger,
      connectors,
      log,
    }

    // Validate required connectors
    for (const required of this.manifest.requiredConnectors) {
      if (!connectors.has(required)) {
        return {
          jobId,
          botId: this.manifest.id,
          status: 'failed',
          error: `Missing required connector: ${required}`,
          startedAt,
          completedAt: new Date().toISOString(),
        }
      }
    }

    // Validate input
    const validationError = this.validate(payload.input)
    if (validationError) {
      return {
        jobId,
        botId: this.manifest.id,
        status: 'failed',
        error: `Validation failed: ${validationError}`,
        startedAt,
        completedAt: new Date().toISOString(),
      }
    }

    try {
      log('info', 'Execution started', { companyId: payload.companyId })
      const output = await this.execute(ctx, payload.input)
      const completedAt = new Date().toISOString()

      log('info', 'Execution completed', {
        durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      })

      return {
        jobId,
        botId: this.manifest.id,
        status: 'completed',
        output,
        startedAt,
        completedAt,
        durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      }
    } catch (err) {
      const completedAt = new Date().toISOString()
      const message = err instanceof Error ? err.message : String(err)
      log('error', 'Execution failed', { error: message })

      return {
        jobId,
        botId: this.manifest.id,
        status: 'failed',
        error: message,
        startedAt,
        completedAt,
        durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      }
    } finally {
      await this.cleanup(ctx).catch((err) => {
        log('warn', 'Cleanup failed', { error: (err as Error).message })
      })
    }
  }
}
