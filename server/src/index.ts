import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from './env.js'
import corsPlugin from './plugins/cors.js'
import cookiePlugin from './plugins/cookie.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
  },
})

// Plugins
await app.register(corsPlugin)
await app.register(cookiePlugin)

// Routes
await app.register(authRoutes)
await app.register(healthRoutes)

// Serve built client in production
const clientDist = path.resolve(__dirname, '../../client/dist')
await app.register(fastifyStatic, {
  root: clientDist,
  prefix: '/',
  wildcard: false,
})

// SPA fallback — serve index.html for non-API routes
app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api')) {
    return reply.status(404).send({ message: 'Not found', statusCode: 404 })
  }
  return reply.sendFile('index.html')
})

// Start
try {
  await app.listen({ port: env.PORT, host: env.HOST })
  console.log(`Server running at http://${env.HOST}:${env.PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
