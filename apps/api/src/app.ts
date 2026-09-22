import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'

import './register.js'

// ─── Routes ──────────────────────────────────────────────────────────────────
import { healthRouter } from './routes/health.js'
import { botsRouter } from './routes/bots.js'
import { authMiddleware } from './middleware/auth.js'

// ─── App Setup ───────────────────────────────────────────────────────────────
// The app is built here without binding a port, so tests can drive it
// in-process via `app.request()`; `server.ts` is the only place that listens.

export const app = new Hono()

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
