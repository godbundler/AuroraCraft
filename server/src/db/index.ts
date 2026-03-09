import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '../env.js'
import * as users from './schema/users.js'
import * as sessions from './schema/sessions.js'

const client = postgres(env.DATABASE_URL)

export const db = drizzle(client, {
  schema: { ...users, ...sessions },
})

export type Database = typeof db
