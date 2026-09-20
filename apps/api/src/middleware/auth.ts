import type { MiddlewareHandler } from 'hono'
import { createLogger } from '@botworks/core'

const log = createLogger('auth')

/**
 * Simple API key auth middleware.
 * In production, this would validate against the botworks platform API.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const apiKey = c.req.header('X-API-Key') ?? c.req.header('Authorization')?.replace('Bearer ', '')
  const expectedKey = process.env.API_SECRET

  if (!expectedKey) {
    log('warn', 'API_SECRET not set — auth disabled in development')
    await next()
    return
  }

  if (!apiKey || apiKey !== expectedKey) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }

  await next()
}
