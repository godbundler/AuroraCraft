import type { FastifyInstance } from 'fastify'
import { sql, eq, desc } from 'drizzle-orm'
import { access, constants } from 'fs/promises'
import { db } from '../db/index.js'
import { users } from '../db/schema/users.js'
import { projects } from '../db/schema/projects.js'
import { agentSessions } from '../db/schema/agent-sessions.js'
import { authMiddleware, adminGuard } from '../middleware/auth.js'

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)
  app.addHook('preHandler', adminGuard)

  // Admin stats
  app.get('/api/admin/stats', async () => {
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
    const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projects)
    const [sessionCount] = await db.select({ count: sql<number>`count(*)::int` }).from(agentSessions)

    return {
      totalUsers: userCount.count,
      totalProjects: projectCount.count,
      totalAgentSessions: sessionCount.count,
    }
  })

  // List all users (admin view)
  app.get('/api/admin/users', async () => {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))

    return allUsers
  })

  // List all projects with owner info (admin view)
  app.get('/api/admin/projects', async () => {
    const allProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        software: projects.software,
        language: projects.language,
        compiler: projects.compiler,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ownerUsername: users.username,
      })
      .from(projects)
      .leftJoin(users, eq(projects.userId, users.id))
      .orderBy(desc(projects.createdAt))

    return allProjects
  })

  // Check Kiro CLI authentication status for a user
  app.get('/api/admin/kiro/status/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const [user] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      return reply.status(404).send({ message: 'User not found', statusCode: 404 })
    }

    const systemUser = `auroracraft-${user.username}`
    const configDir = `/home/${systemUser}/.config/kiro`

    let systemUserExists = false
    try {
      await access(`/home/${systemUser}`, constants.F_OK)
      systemUserExists = true
    } catch {
      // System user home directory doesn't exist
    }

    let credentialsExist = false
    if (systemUserExists) {
      try {
        await access(configDir, constants.F_OK)
        credentialsExist = true
      } catch {
        // No Kiro config directory
      }
    }

    return {
      userId: user.id,
      username: user.username,
      systemUser,
      systemUserExists,
      authenticated: credentialsExist,
      configDir,
    }
  })

  // Initiate Kiro CLI authentication for a user
  app.post('/api/admin/kiro/authenticate/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const [user] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      return reply.status(404).send({ message: 'User not found', statusCode: 404 })
    }

    const systemUser = `auroracraft-${user.username}`
    const homeDir = `/home/${systemUser}`
    const configDir = `${homeDir}/.config/kiro`

    // Verify system user exists
    let systemUserExists = false
    try {
      await access(homeDir, constants.F_OK)
      systemUserExists = true
    } catch {
      return reply.status(400).send({
        message: `System user ${systemUser} does not exist. Create the user's project first.`,
        statusCode: 400,
      })
    }

    // Check if already authenticated
    let alreadyAuthenticated = false
    try {
      await access(configDir, constants.F_OK)
      alreadyAuthenticated = true
    } catch {
      // Not authenticated yet
    }

    return {
      userId: user.id,
      username: user.username,
      systemUser,
      systemUserExists,
      authenticated: alreadyAuthenticated,
      configDir,
      instructions: alreadyAuthenticated
        ? 'Kiro CLI is already authenticated for this user.'
        : `To authenticate, SSH into the server and run: su - ${systemUser} -c "kiro-cli login"`,
    }
  })
}
