import type { FastifyInstance } from 'fastify'
import { eq, and, desc, asc, ilike, or } from 'drizzle-orm'
import { mkdir, stat, cp, readFile, realpath } from 'fs/promises'
import path from 'path'
import archiver from 'archiver'
import { db } from '../db/index.js'
import { projects } from '../db/schema/projects.js'
import { users } from '../db/schema/users.js'
import { agentSessions } from '../db/schema/agent-sessions.js'
import { agentMessages } from '../db/schema/agent-messages.js'
import { authMiddleware } from '../middleware/auth.js'
import { readFileTree, generateLinkId } from './projects.js'

const communityProjectSelect = {
  id: projects.id,
  name: projects.name,
  description: projects.description,
  software: projects.software,
  language: projects.language,
  javaVersion: projects.javaVersion,
  compiler: projects.compiler,
  visibility: projects.visibility,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  ownerUsername: users.username,
}

function getProjectDir(ownerUsername: string, linkId: string): string {
  return `/home/auroracraft-${ownerUsername}/${linkId}`
}

async function getPublicProject(id: string) {
  const [row] = await db
    .select({ ...communityProjectSelect, linkId: projects.linkId })
    .from(projects)
    .innerJoin(users, eq(projects.userId, users.id))
    .where(and(eq(projects.id, id), eq(projects.visibility, 'public'), eq(projects.status, 'active')))
    .limit(1)
  return row ?? null
}

export async function communityRoutes(app: FastifyInstance) {
  // List public projects
  app.get('/api/community/projects', async (request) => {
    const { search, software, language, sort } = request.query as {
      search?: string
      software?: string
      language?: string
      sort?: string
    }

    const conditions = [eq(projects.visibility, 'public'), eq(projects.status, 'active')]

    if (search) {
      const searchCondition = or(
        ilike(projects.name, `%${search}%`),
        ilike(projects.description, `%${search}%`),
      )
      if (searchCondition) conditions.push(searchCondition)
    }

    if (software) {
      conditions.push(eq(projects.software, software))
    }

    if (language && (language === 'java' || language === 'kotlin')) {
      conditions.push(eq(projects.language, language))
    }

    const orderBy = sort === 'oldest' ? asc(projects.createdAt) : desc(projects.createdAt)

    const rows = await db
      .select(communityProjectSelect)
      .from(projects)
      .innerJoin(users, eq(projects.userId, users.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(100)

    return rows
  })

  // Get single public project
  app.get('/api/community/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const project = await getPublicProject(id)
    if (!project) {
      return reply.status(404).send({ message: 'Project not found', statusCode: 404 })
    }

    const { linkId: _, ...publicFields } = project
    return publicFields
  })

  // Get file tree for public project
  app.get('/api/community/projects/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string }

    const project = await getPublicProject(id)
    if (!project) {
      return reply.status(404).send({ message: 'Project not found', statusCode: 404 })
    }

    if (!project.linkId) {
      return { files: [] }
    }

    const projectDir = getProjectDir(project.ownerUsername, project.linkId)
    const files = await readFileTree(projectDir, projectDir, 10)
    return { files }
  })

  // Read file content for public project
  app.get('/api/community/projects/:id/files/content', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { path: filePath } = request.query as { path?: string }

    if (!filePath) {
      return reply.status(400).send({ message: 'Missing path query parameter', statusCode: 400 })
    }

    const project = await getPublicProject(id)
    if (!project) {
      return reply.status(404).send({ message: 'Project not found', statusCode: 404 })
    }

    if (!project.linkId) {
      return reply.status(404).send({ message: 'Project directory not found', statusCode: 404 })
    }

    const projectDir = getProjectDir(project.ownerUsername, project.linkId)
    const fullPath = path.resolve(projectDir, filePath)

    if (!fullPath.startsWith(projectDir + '/')) {
      return reply.status(403).send({ message: 'Access denied', statusCode: 403 })
    }

    try {
      const realProjectDir = await realpath(projectDir)
      const realFullPath = await realpath(fullPath)

      if (!realFullPath.startsWith(realProjectDir + '/')) {
        return reply.status(403).send({ message: 'Access denied', statusCode: 403 })
      }

      const fileStat = await stat(realFullPath)
      if (!fileStat.isFile()) {
        return reply.status(400).send({ message: 'Path is not a file', statusCode: 400 })
      }
      const content = await readFile(realFullPath, 'utf-8')
      return { content, path: filePath }
    } catch {
      return reply.status(404).send({ message: 'File not found', statusCode: 404 })
    }
  })

  // Get chat messages for public project
  app.get('/api/community/projects/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }

    const project = await getPublicProject(id)
    if (!project) {
      return reply.status(404).send({ message: 'Project not found', statusCode: 404 })
    }

    const messages = await db
      .select({
        id: agentMessages.id,
        sessionId: agentMessages.sessionId,
        role: agentMessages.role,
        content: agentMessages.content,
        metadata: agentMessages.metadata,
        createdAt: agentMessages.createdAt,
      })
      .from(agentMessages)
      .innerJoin(agentSessions, eq(agentMessages.sessionId, agentSessions.id))
      .where(eq(agentSessions.projectId, id))
      .orderBy(asc(agentMessages.createdAt))

    return { messages }
  })

  // Fork a public project
  app.post('/api/community/projects/:id/fork', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Get the source project (must be public)
    const [sourceProject] = await db
      .select({
        id: projects.id,
        name: projects.name,
        linkId: projects.linkId,
        description: projects.description,
        software: projects.software,
        language: projects.language,
        javaVersion: projects.javaVersion,
        compiler: projects.compiler,
        ownerUsername: users.username,
      })
      .from(projects)
      .innerJoin(users, eq(projects.userId, users.id))
      .where(and(eq(projects.id, id), eq(projects.visibility, 'public'), eq(projects.status, 'active')))
      .limit(1)

    if (!sourceProject) {
      return reply.status(404).send({ message: 'Project not found', statusCode: 404 })
    }

    const newLinkId = generateLinkId(sourceProject.name)

    const [newProject] = await db
      .insert(projects)
      .values({
        userId: request.user!.id,
        name: `${sourceProject.name.slice(0, 121)} (Fork)`,
        linkId: newLinkId,
        description: sourceProject.description,
        software: sourceProject.software,
        language: sourceProject.language,
        javaVersion: sourceProject.javaVersion,
        compiler: sourceProject.compiler,
        visibility: 'private',
      })
      .returning()

    // Copy filesystem
    if (sourceProject.linkId) {
      const srcDir = getProjectDir(sourceProject.ownerUsername, sourceProject.linkId)
      const destDir = getProjectDir(request.user!.username, newLinkId)

      try {
        await stat(srcDir)
        await cp(srcDir, destDir, { recursive: true })
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          await mkdir(destDir, { recursive: true })
        } else {
          app.log.warn({ err, srcDir, destDir }, 'Failed to copy project files during fork')
          await mkdir(destDir, { recursive: true })
        }
      }
    } else {
      const destDir = getProjectDir(request.user!.username, newLinkId)
      await mkdir(destDir, { recursive: true })
    }

    return reply.status(201).send(newProject)
  })

  // Download project as ZIP
  app.get('/api/community/projects/:id/download/zip', async (request, reply) => {
    const { id } = request.params as { id: string }

    const project = await getPublicProject(id)
    if (!project) {
      return reply.status(404).send({ message: 'Project not found', statusCode: 404 })
    }

    if (!project.linkId) {
      return reply.status(404).send({ message: 'Project files not found', statusCode: 404 })
    }

    const projectDir = getProjectDir(project.ownerUsername, project.linkId)

    try {
      await stat(projectDir)
    } catch {
      return reply.status(404).send({ message: 'Project files not found', statusCode: 404 })
    }

    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_')
    const archive = archiver('zip', { zlib: { level: 6 } })

    archive.on('error', (err) => {
      app.log.error({ err, projectId: id }, 'Archive error')
    })

    archive.directory(projectDir, false)
    void archive.finalize()

    reply.header('Content-Type', 'application/zip')
    reply.header('Content-Disposition', `attachment; filename="${safeName}.zip"`)

    return reply.send(archive)
  })
}
