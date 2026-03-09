import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { env } from '../env.js'

export default fp(async (app) => {
  await app.register(cors, {
    origin: env.CLIENT_URL,
    credentials: true,
  })
})
