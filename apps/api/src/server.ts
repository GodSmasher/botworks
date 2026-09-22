import 'dotenv/config'
import { serve } from '@hono/node-server'
import { registry, createLogger, isMockMode } from '@botworks/core'
import { app } from './app.js'

const log = createLogger('server')

// ─── Start Server ────────────────────────────────────────────────────────────

const port = Number(process.env.API_PORT ?? 4000)

serve({ fetch: app.fetch, port }, () => {
  log('info', `botworks API running on http://localhost:${port}`)
  log('info', isMockMode() ? 'AI: mock mode (deterministic offline answers) — set BOTWORKS_MOCK=false for the live model' : 'AI: live model')
  log('info', `Registered bots: ${registry.list().map((b) => b.id).join(', ')}`)
})
