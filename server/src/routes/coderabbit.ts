import type { FastifyInstance } from 'fastify'
import { db } from '../db'
import { users } from '../db/schema/users'
import { projects } from '../db/schema/projects'
import { codeReviews } from '../db/schema/code-reviews'
import { eq, and, desc, or } from 'drizzle-orm'
import { authMiddleware, adminGuard } from '../middleware/auth'

export default async function coderabbitRoutes(app: FastifyInstance) {
  // Admin: Initiate CodeRabbit login
  app.post('/api/admin/users/:id/coderabbit/initiate', { preHandler: [authMiddleware, adminGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const userHome = `/home/auroracraft-${user.username}`
    const sessionName = `coderabbit-${id}`

    try {
      const { promisify } = await import('util')
      const { exec } = await import('child_process')
      const execAsync = promisify(exec)

      // Ensure user home directory exists
      await execAsync(`mkdir -p ${userHome}`)
      await execAsync(`chown -R auroracraft-${user.username}:auroracraft-${user.username} ${userHome} 2>/dev/null || true`)

      // Check if CodeRabbit CLI is installed for this user
      const coderabbitPath = `${userHome}/.local/bin/coderabbit`
      try {
        await execAsync(`test -f ${coderabbitPath}`)
      } catch {
        app.log.info(`Installing CodeRabbit CLI for user ${user.username}...`)
        await execAsync(`curl -fsSL https://cli.coderabbit.ai/install.sh | HOME=${userHome} sh`)
        await execAsync(`chown -R auroracraft-${user.username}:auroracraft-${user.username} ${userHome}/.local 2>/dev/null || true`)
      }

      // Ensure tmux server is running
      await execAsync(`tmux start-server 2>/dev/null || true`)

      // Kill any existing session
      await execAsync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`)

      // Start tmux session with coderabbit auth login (wide window to prevent URL wrapping)
      await execAsync(`tmux new-session -d -s ${sessionName} -x 200 -y 50 "HOME=${userHome} ${coderabbitPath} auth login"`)

      // Wait a bit for the URL to appear
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Capture the pane content to get the URL
      const { stdout } = await execAsync(`tmux capture-pane -t ${sessionName} -p`)
      
      const urlMatch = stdout.match(/https:\/\/app\.coderabbit\.ai\/login\?[^\s\n]+/)
      if (!urlMatch) {
        await execAsync(`tmux kill-session -t ${sessionName}`)
        throw new Error('Failed to capture login URL')
      }

      const loginUrl = urlMatch[0].replace(/\x1b\[[0-9;]*m/g, '')

      // Store session info
      global.coderabbitLoginProcesses = global.coderabbitLoginProcesses || {}
      global.coderabbitLoginProcesses[id] = { userHome, sessionName }

      return { loginUrl, userId: id }
    } catch (err) {
      app.log.error({ err }, 'Failed to initiate CodeRabbit login')
      return reply.status(500).send({ error: 'Failed to initiate login' })
    }
  })

  // Admin: Complete login with token
  app.post('/api/admin/users/:id/coderabbit/complete', { preHandler: [authMiddleware, adminGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { token } = request.body as { token: string }

    if (!token) {
      return reply.status(400).send({ error: 'Token is required' })
    }

    try {
      const processInfo = global.coderabbitLoginProcesses?.[id]
      if (!processInfo) {
        return reply.status(400).send({ error: 'No active login session' })
      }

      const { promisify } = await import('util')
      const { exec } = await import('child_process')
      const execAsync = promisify(exec)

      // Check if tmux session still exists
      try {
        await execAsync(`tmux has-session -t ${processInfo.sessionName}`)
      } catch {
        return reply.status(400).send({ error: 'Login session expired. Please generate a new login URL.' })
      }

      // Send token to tmux session
      await execAsync(`tmux send-keys -t ${processInfo.sessionName} "${token.trim()}" Enter`)

      // Wait for authentication to complete
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Capture output to check for errors
      const { stdout: tmuxOutput } = await execAsync(`tmux capture-pane -t ${processInfo.sessionName} -p`)
      
      app.log.info({ tmuxOutput: tmuxOutput.slice(-500) }, 'Tmux output after token')
      
      // Kill the session
      await execAsync(`tmux kill-session -t ${processInfo.sessionName}`)

      // Check if authentication failed in the output
      if (tmuxOutput.includes('Authentication failed') || tmuxOutput.includes('Invalid')) {
        app.log.error('CodeRabbit authentication failed in tmux output')
        return reply.status(400).send({ error: 'Authentication failed - invalid token or state mismatch' })
      }

      // Verify authentication
      const coderabbitPath = `${processInfo.userHome}/.local/bin/coderabbit`
      const { stdout } = await execAsync(`${coderabbitPath} auth status --agent`, {
        env: { ...process.env, HOME: processInfo.userHome }
      })

      app.log.info({ authStatus: stdout }, 'CodeRabbit auth status check')

      const lines = stdout.trim().split('\n')
      let authenticated = false
      for (const line of lines) {
        try {
          const obj = JSON.parse(line)
          if ((obj.type === 'auth_status' || obj.type === 'status') && obj.authenticated) {
            authenticated = true
            break
          }
        } catch {}
      }

      if (!authenticated) {
        app.log.error('CodeRabbit not authenticated after token submission')
        return reply.status(400).send({ error: 'Authentication failed' })
      }

      await db
        .update(users)
        .set({
          coderabbitEnabled: true,
          coderabbitGrantedBy: request.user!.id,
          coderabbitGrantedAt: new Date(),
        })
        .where(eq(users.id, id))

      // Fix ownership of all files in user home
      try {
        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
        if (user) {
          await execAsync(`chown -R auroracraft-${user.username}:auroracraft-${user.username} ${processInfo.userHome}`)
        }
      } catch (chownErr) {
        app.log.warn({ chownErr }, 'Failed to fix ownership, but authentication succeeded')
      }

      delete global.coderabbitLoginProcesses[id]

      return { success: true }
    } catch (err) {
      app.log.error({ err }, 'Failed to complete CodeRabbit login')
      return reply.status(500).send({ error: 'Failed to complete login' })
    }
  })

  // Admin: Logout user from CodeRabbit
  app.post('/api/admin/users/:id/coderabbit/revoke', { preHandler: [authMiddleware, adminGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const userHome = `/home/auroracraft-${user.username}`

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      await execAsync(`cd ${userHome} && ${userHome}/.local/bin/coderabbit auth logout`, {
        env: { ...process.env, HOME: userHome }
      })

      await db
        .update(users)
        .set({
          coderabbitEnabled: false,
          coderabbitGrantedBy: null,
          coderabbitGrantedAt: null,
        })
        .where(eq(users.id, id))

      return { success: true }
    } catch (err) {
      app.log.error({ err }, 'Failed to logout')
      return reply.status(500).send({ error: 'Failed to logout' })
    }
  })

  // Check if CodeRabbit is enabled for project
  app.get('/api/projects/:id/coderabbit/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    if (!project || project.userId !== request.user!.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const [user] = await db
      .select({ coderabbitEnabled: users.coderabbitEnabled })
      .from(users)
      .where(eq(users.id, request.user!.id))
      .limit(1)

    return { enabled: user.coderabbitEnabled || false }
  })

  // Start code review
  app.post('/api/projects/:id/coderabbit/review', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { scope } = request.body as { scope: 'full' | 'uncommitted' | 'recent' }

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    if (!project || project.userId !== request.user!.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const [user] = await db
      .select({ coderabbitEnabled: users.coderabbitEnabled, username: users.username })
      .from(users)
      .where(eq(users.id, request.user!.id))
      .limit(1)

    if (!user.coderabbitEnabled) {
      return reply.status(403).send({ error: 'CodeRabbit not enabled for your account' })
    }

    const projectDir = project.linkId ? `/home/auroracraft-${user.username}/${project.linkId}` : null
    if (!projectDir) {
      return reply.status(404).send({ error: 'Project directory not found' })
    }

    const userHome = `/home/auroracraft-${user.username}`

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // Mark previous pending reviews as superseded
      await db
        .update(codeReviews)
        .set({ status: 'superseded' })
        .where(and(
          eq(codeReviews.projectId, id),
          eq(codeReviews.userId, request.user!.id),
          eq(codeReviews.status, 'pending')
        ))

      // Also mark previous passed/failed reviews as superseded
      await db
        .update(codeReviews)
        .set({ status: 'superseded' })
        .where(and(
          eq(codeReviews.projectId, id),
          eq(codeReviews.userId, request.user!.id),
          or(eq(codeReviews.status, 'passed'), eq(codeReviews.status, 'failed'))
        ))

      // Create review record
      const [review] = await db
        .insert(codeReviews)
        .values({
          projectId: id,
          userId: request.user!.id,
          scope,
          status: 'pending',
        })
        .returning()

      // Run CodeRabbit review
      const coderabbitPath = `${userHome}/.local/bin/coderabbit`
      const typeFlag = 'uncommitted'
      const cmd = `cd "${projectDir}" && ${coderabbitPath} review --agent --type ${typeFlag}`
      
      const { stdout } = await execAsync(cmd, { 
        maxBuffer: 10 * 1024 * 1024,
        env: { 
          ...process.env, 
          HOME: userHome,
          PATH: `${userHome}/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}`
        }
      })
      
      // Parse JSON output
      const lines = stdout.trim().split('\n')
      const issues = lines
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter(obj => obj && obj.type === 'finding')

      const hasCritical = issues.some((i: any) => i.severity === 'critical' || i.severity === 'major')
      const status = issues.length === 0 ? 'passed' : hasCritical ? 'failed' : 'passed'

      await db
        .update(codeReviews)
        .set({ status, issuesJson: issues, resolvedAt: new Date() })
        .where(eq(codeReviews.id, review.id))

      return { reviewId: review.id, status, issuesCount: issues.length, issues }
    } catch (err) {
      app.log.error({ err }, 'Failed to run CodeRabbit review')
      return reply.status(500).send({ error: 'Failed to run code review' })
    }
  })

  // Get review history
  app.get('/api/projects/:id/coderabbit/reviews', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    if (!project || project.userId !== request.user!.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const reviews = await db
      .select()
      .from(codeReviews)
      .where(eq(codeReviews.projectId, id))
      .orderBy(desc(codeReviews.createdAt))

    return { reviews }
  })

  // Update review status
  app.patch('/api/projects/:id/coderabbit/reviews/:reviewId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id, reviewId } = request.params as { id: string; reviewId: string }
    const { status } = request.body as { status: string }

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    if (!project || project.userId !== request.user!.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    await db
      .update(codeReviews)
      .set({ status, resolvedAt: new Date() })
      .where(and(eq(codeReviews.id, reviewId), eq(codeReviews.projectId, id)))

    return { success: true }
  })
}
