import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: z.string().min(16),
  COOKIE_DOMAIN: z.string().default('localhost'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  OPENCODE_PORT_MIN: z.coerce.number().default(9000),
  OPENCODE_PORT_MAX: z.coerce.number().default(9999),
  OPENCODE_IDLE_TIMEOUT: z.coerce.number().default(120000),
})

export const env = envSchema.parse(process.env)
