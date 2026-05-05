import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema/users.js'
import { projects } from '../db/schema/projects.js'
import { authMiddleware } from '../middleware/auth.js'
import { env } from '../env.js'

export async function githubRoutes(app: FastifyInstance) {
  // Initiate GitHub OAuth flow
  app.get('/api/auth/github/connect', { preHandler: [authMiddleware] }, async (request, reply) => {
    if (!env.GITHUB_CLIENT_ID) {
      return reply.status(500).send({ error: 'GitHub OAuth not configured' })
    }

    const { returnTo } = request.query as { returnTo?: string }
    const state = JSON.stringify({ userId: request.user!.id, returnTo: returnTo || '/dashboard' })
    const redirectUri = env.GITHUB_CALLBACK_URL || `${env.CLIENT_URL}/api/auth/github/callback`
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
    
    return reply.redirect(authUrl)
  })

  // Handle GitHub OAuth callback
  app.get('/api/auth/github/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string }

    if (!code || !state) {
      return reply.redirect(`${env.CLIENT_URL}/dashboard?github_error=missing_code`)
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return reply.redirect(`${env.CLIENT_URL}/dashboard?github_error=not_configured`)
    }

    let userId: string
    let returnTo = '/dashboard'
    
    try {
      const parsed = JSON.parse(decodeURIComponent(state))
      userId = parsed.userId
      returnTo = parsed.returnTo || '/dashboard'
    } catch {
      userId = state
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      })

      const tokenData = await tokenResponse.json() as { access_token?: string; error?: string }

      if (!tokenData.access_token) {
        return reply.redirect(`${env.CLIENT_URL}${returnTo}?github_error=token_failed`)
      }

      // Get GitHub user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      })

      const githubUser = await userResponse.json() as { login?: string }

      if (!githubUser.login) {
        return reply.redirect(`${env.CLIENT_URL}${returnTo}?github_error=user_failed`)
      }

      // Update user with GitHub credentials
      await db
        .update(users)
        .set({
          githubAccessToken: tokenData.access_token,
          githubUsername: githubUser.login,
          githubConnectedAt: new Date(),
        })
        .where(eq(users.id, userId))

      return reply.redirect(`${env.CLIENT_URL}${returnTo}?github_connected=true`)
    } catch (err) {
      app.log.error({ err }, 'GitHub OAuth callback error')
      return reply.redirect(`${env.CLIENT_URL}${returnTo}?github_error=unknown`)
    }
  })

  // Check GitHub connection status
  app.get('/api/auth/github/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const [user] = await db
      .select({ githubUsername: users.githubUsername, githubConnectedAt: users.githubConnectedAt })
      .from(users)
      .where(eq(users.id, request.user!.id))
      .limit(1)

    return {
      connected: !!user.githubUsername,
      username: user.githubUsername || null,
      connectedAt: user.githubConnectedAt || null,
    }
  })

  // Disconnect GitHub account
  app.post('/api/auth/github/disconnect', { preHandler: [authMiddleware] }, async (request, reply) => {
    await db
      .update(users)
      .set({
        githubAccessToken: null,
        githubUsername: null,
        githubConnectedAt: null,
      })
      .where(eq(users.id, request.user!.id))

    return { success: true }
  })

  // Get git branches for a project
  app.get('/api/projects/:id/git/branches', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    
    if (!project || project.userId !== request.user!.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const projectDir = project.linkId ? `/home/auroracraft-${request.user!.username}/${project.linkId}` : null
    if (!projectDir) {
      return reply.status(404).send({ error: 'Project directory not found' })
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      // Check if git repo exists
      try {
        await execAsync('git rev-parse --git-dir', { cwd: projectDir })
      } catch {
        // Initialize git if not exists
        await execAsync('git init', { cwd: projectDir })
        await execAsync('git checkout -b main', { cwd: projectDir })
        return { branches: ['main'], currentBranch: 'main', needsRemote: true }
      }
      
      // Check if remote exists
      let hasRemote = false
      try {
        const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd: projectDir })
        hasRemote = !!remoteUrl.trim()
      } catch {}
      
      const { stdout } = await execAsync('git branch -a', { cwd: projectDir })
      const branches = stdout
        .split('\n')
        .map(b => b.trim().replace(/^\*\s+/, '').replace(/^remotes\/origin\//, ''))
        .filter(b => b && b !== 'HEAD' && !b.includes('->'))
        .filter((b, i, arr) => arr.indexOf(b) === i)
      
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectDir })
      
      return { 
        branches: branches.length > 0 ? branches : ['main'], 
        currentBranch: currentBranch.trim() || 'main',
        needsRemote: !hasRemote
      }
    } catch (err) {
      app.log.error({ err }, 'Failed to get git branches')
      return { branches: ['main'], currentBranch: 'main', needsRemote: true }
    }
  })

  // Set GitHub repository URL
  app.post('/api/projects/:id/git/remote', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { repoUrl } = request.body as { repoUrl: string }

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    
    if (!project || project.userId !== request.user!.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const projectDir = project.linkId ? `/home/auroracraft-${request.user!.username}/${project.linkId}` : null
    if (!projectDir) {
      return reply.status(404).send({ error: 'Project directory not found' })
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // Remove existing remote if any
      try {
        await execAsync('git remote remove origin', { cwd: projectDir })
      } catch {}

      // Add new remote
      await execAsync(`git remote add origin "${repoUrl}"`, { cwd: projectDir })

      return { success: true }
    } catch (err) {
      app.log.error({ err }, 'Failed to set git remote')
      return reply.status(500).send({ error: 'Failed to set repository URL' })
    }
  })

  // Push code to GitHub
  app.post('/api/projects/:id/git/push', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { branch, message, force } = request.body as { branch: string; message: string; force?: boolean }

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    
    if (!project || project.userId !== request.user!.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const [user] = await db
      .select({ githubAccessToken: users.githubAccessToken })
      .from(users)
      .where(eq(users.id, request.user!.id))
      .limit(1)

    if (!user.githubAccessToken) {
      return reply.status(400).send({ error: 'GitHub account not connected' })
    }

    const projectDir = project.linkId ? `/home/auroracraft-${request.user!.username}/${project.linkId}` : null
    if (!projectDir) {
      return reply.status(404).send({ error: 'Project directory not found' })
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // Configure git credentials
      await execAsync(`git config credential.helper store`, { cwd: projectDir })
      
      // Get remote URL and inject token
      const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd: projectDir })
      const url = remoteUrl.trim()
      
      if (url.includes('github.com')) {
        const tokenUrl = url.replace('https://github.com/', `https://oauth2:${user.githubAccessToken}@github.com/`)
        await execAsync(`git remote set-url origin "${tokenUrl}"`, { cwd: projectDir })
      }

      // Git add, commit, push
      await execAsync('git add .', { cwd: projectDir })
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}" || true`, { cwd: projectDir })
      await execAsync(`git push origin ${branch}${force ? ' --force' : ''}`, { cwd: projectDir })

      // Reset URL to remove token
      await execAsync(`git remote set-url origin "${url}"`, { cwd: projectDir })

      return { success: true }
    } catch (err) {
      app.log.error({ err }, 'Failed to push to GitHub')
      return reply.status(500).send({ error: 'Failed to push to GitHub' })
    }
  })

  // Reset project from Git
  app.post('/api/projects/:id/git/reset', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { branch, commit } = request.body as { branch?: string; commit?: string }

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
    
    if (!project || project.userId !== request.user!.id) {
      return reply.status(404).send({ error: 'Project not found' })
    }

    const projectDir = project.linkId ? `/home/auroracraft-${request.user!.username}/${project.linkId}` : null
    if (!projectDir) {
      return reply.status(404).send({ error: 'Project directory not found' })
    }

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      const { rm, mkdir } = await import('fs/promises')

      // Get remote URL before deleting
      const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd: projectDir })
      const repoUrl = remoteUrl.trim()

      if (!repoUrl) {
        return reply.status(400).send({ error: 'No Git remote configured' })
      }

      // Check if private repo (needs token)
      let cloneUrl = repoUrl
      if (repoUrl.includes('github.com')) {
        const [user] = await db
          .select({ githubAccessToken: users.githubAccessToken })
          .from(users)
          .where(eq(users.id, request.user!.id))
          .limit(1)

        if (user.githubAccessToken && !repoUrl.includes('@')) {
          cloneUrl = repoUrl.replace('https://github.com/', `https://oauth2:${user.githubAccessToken}@github.com/`)
        }
      }

      // Delete all files
      await rm(projectDir, { recursive: true, force: true })
      await mkdir(projectDir, { recursive: true })

      // Clone fresh
      const branchFlag = branch ? ` -b "${branch}"` : ''
      await execAsync(`git clone${branchFlag} "${cloneUrl}" "${projectDir}"`)

      // Checkout specific commit if provided
      if (commit) {
        await execAsync(`git checkout "${commit}"`, { cwd: projectDir })
      }

      return { success: true }
    } catch (err) {
      app.log.error({ err }, 'Failed to reset from Git')
      return reply.status(500).send({ error: 'Failed to reset from Git' })
    }
  })
}
