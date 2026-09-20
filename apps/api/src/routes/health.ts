import { Hono } from 'hono'
import { registry } from '@botworks/core'

export const healthRouter = new Hono()

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bots: registry.size,
    version: '0.1.0',
  })
})
