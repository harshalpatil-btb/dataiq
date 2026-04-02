// dealiq/backend/src/index.js
// Main server entry point

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import 'dotenv/config'

// Routes
import authRoutes from './routes/auth.js'
import dealRoutes from './routes/deals.js'
import roomRoutes from './routes/rooms.js'
import engagementRoutes from './routes/engagement.js'
import billingRoutes from './routes/billing.js'
import teamRoutes from './routes/team.js'
import contentRoutes from './routes/content.js'
import automationRoutes from './routes/automation.js'
import webhookRoutes from './routes/webhooks.js'
import aiRoutes from './routes/ai.js'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
  },
})

// ── PLUGINS ──────────────────────────────────────────────

await app.register(cors, {
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
  ],
  credentials: true,
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET,
})

await app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Slow down — try again in a minute.',
  }),
})

// ── AUTH DECORATOR ────────────────────────────────────────

// Verify JWT on protected routes
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token.' })
  }
})

// ── ROUTES ────────────────────────────────────────────────

// Health check
app.get('/health', async () => ({ status: 'ok', version: '1.0.0', ts: new Date().toISOString() }))

// API routes
app.register(authRoutes,       { prefix: '/auth' })
app.register(dealRoutes,       { prefix: '/deals' })
app.register(roomRoutes,       { prefix: '/rooms' })
app.register(engagementRoutes, { prefix: '/engagement' })
app.register(billingRoutes,    { prefix: '/billing' })
app.register(teamRoutes,       { prefix: '/team' })
app.register(contentRoutes,    { prefix: '/content' })
app.register(automationRoutes, { prefix: '/automation' })
app.register(aiRoutes,         { prefix: '/ai' })

// Webhooks — raw body needed for Stripe signature verification
app.register(webhookRoutes, { prefix: '/webhooks' })

// ── START ─────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '8080')
const HOST = '0.0.0.0'

try {
  await app.listen({ port: PORT, host: HOST })
  console.log(`🚀 DealIQ API running on ${HOST}:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
