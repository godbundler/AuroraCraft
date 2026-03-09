import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { users } from './schema/users.js'
import { hashPassword } from '../utils/password.js'
import { eq } from 'drizzle-orm'

async function seed() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  const client = postgres(connectionString, { max: 1 })
  const db = drizzle(client)

  console.log('Seeding database...')

  // Check if admin already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1)

  if (existing) {
    console.log('Admin user already exists, skipping seed')
  } else {
    const passwordHash = await hashPassword('admin123')
    await db.insert(users).values({
      username: 'admin',
      email: 'admin@auroracraft.dev',
      passwordHash,
      role: 'admin',
    })
    console.log('Admin user created (username: admin, password: admin123)')
  }

  await client.end()
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
