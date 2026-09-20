import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { registry, createLogger, isMockMode } from '@botworks/core'

import './register.js'

// ─── Routes ──────────────────────────────────────────────────────────────────
import { healthRouter } from './routes/health.js'
import { botsRouter } from './routes/bots.js'
import { authMiddleware } from './middleware/auth.js'

const log = createLogger('server')

// ─── App Setup ───────────────────────────────────────────────────────────────

const app = new Hono()

// Global middleware
app.use('*', cors())
app.use('*', honoLogger())

// Public routes
app.route('/health', healthRouter)

// Protected routes
app.use('/api/*', authMiddleware)
app.route('/api/bots', botsRouter)

// Root
app.get('/', (c) =>
  c.json({
    name: 'botworks API',
    version: '0.1.0',
    docs: '/health',
    bots: '/api/bots',
  }),
)

// ─── Start Server ────────────────────────────────────────────────────────────

const port = Number(process.env.API_PORT ?? 4000)

serve({ fetch: app.fetch, port }, () => {
  log('info', `botworks API running on http://localhost:${port}`)
  log('info', isMockMode() ? 'AI: mock mode (deterministic offline answers) — set BOTWORKS_MOCK=false for the live model' : 'AI: live model')
  log('info', `Registered bots: ${registry.list().map((b) => b.id).join(', ')}`)
})
