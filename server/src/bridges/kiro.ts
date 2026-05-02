import type { BridgeInterface, BridgeTask, BridgeResult, BridgeStreamEvent, MessagePart } from './types.js'
import { kiroProcessManager } from './kiro-process-manager.js'
import { KiroFileWatcher } from './kiro-file-watcher.js'
import { parseKiroOutput, extractTextContent, stripAnsi } from './kiro-output-parser.js'
import { sessionEventBus } from './session-event-bus.js'
import { AGENT_SYSTEM_PROMPT } from './system-prompt.js'
import { execSync } from 'child_process'

const ACTION_TAG_INLINE_RE = /(\s*)\[(Created|Updated|Read|Deleted|Renamed)\]\s+([^\s`"']+|`[^`]+`)/g
const RUN_TAG_LINE_RE = /^\s*\[Run\]\s*(.+)$/gim
const ORPHAN_ANSI_RE = /(?:^|[\s.])\[[0-9;]{1,20}m/g

function normalizeAssistantText(text: string): string {
  if (!text) return ''
  return text
    .replace(ACTION_TAG_INLINE_RE, (_m, ws) => ws || ' ')
    .replace(/\[Run\]\s+[^\n]*/g, '')
    .replace(ORPHAN_ANSI_RE, ' ')
    .replace(/(\S)\s+(#{2,6}\s)/g, '$1\n\n$2')
    .replace(/(#{2,6})([A-Za-z])/g, '$1 $2')
    .replace(/Files:-/g, 'Files:\n- ')
    .replace(/\n{3,}/g, '\n\n')
}

function stripInlineActionTags(text: string): string {
  return normalizeAssistantText(text)
}

// ── Stream filter ────────────────────────────────────────────────────

class KiroStreamFilter {
  private buffer = ''
  private inResponseBlock = false

  processChunk(chunk: string): string {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    let output = ''
    for (const line of lines) {
      const wasInResponse = this.inResponseBlock
      const result = this.classifyLine(line)
      if (result !== null) {
        const cleaned = stripInlineActionTags(result)
        if (this.inResponseBlock) {
          // The `script` PTY wrapper outputs each LLM token on its own line.
          // Empty lines = word boundaries (spaces), non-empty = token parts.
          if (!wasInResponse && output) output += '\n\n'
          output += cleaned === '' ? ' ' : cleaned
        } else {
          output += cleaned + '\n'
        }
      }
    }
    return output
  }

  flush(): string {
    const line = this.buffer
    this.buffer = ''
    if (!line) return ''
    const result = this.classifyLine(line)
    if (result === null) return ''
    const cleaned = stripInlineActionTags(result)
    return this.inResponseBlock ? (cleaned === '' ? ' ' : cleaned) : cleaned
  }

  private classifyLine(line: string): string | null {
    const trimmed = line.trim()

    if (!trimmed) {
      return this.inResponseBlock ? '' : null
    }

    if (trimmed.startsWith('> ') || trimmed === '>') {
      this.inResponseBlock = true
      return trimmed.length > 2 ? trimmed.slice(2) : ''
    }

    if (this.isSuppressed(trimmed)) {
      this.inResponseBlock = false
      return null
    }

    if (this.inResponseBlock) return line

    return null
  }

  private isSuppressed(line: string): boolean {
    if (line.includes('tools are now trusted')) return true
    if (/^I.ll create the following file:/.test(line)) return true
    if (/^\+\s+\d+:/.test(line)) return true
    if (line.startsWith('✓')) return true
    if (/^Reading (directory|file):/.test(line)) return true
    if (line.startsWith('Creating:')) return true
    if (line.includes('- Completed in')) return true
    if (line.includes('▸ Credits:')) return true
    if (line.includes('(using tool:')) return true
    if (line.includes('Agents can sometimes do unexpected')) return true
    if (line.includes('Learn more at https://kiro')) return true
    if (/^\[(?:Created|Updated|Read|Deleted|Renamed)\]/.test(line)) return true
    return false
  }
}

// ── Kiro Bridge ──────────────────────────────────────────────────────

export class KiroBridge implements BridgeInterface {
  name = 'kiro'
  private activeSessions = new Map<string, AbortController>()

  async initialize(): Promise<void> {
    // Verify kiro-cli binary exists
    try {
      execSync('which kiro-cli', { stdio: 'ignore' })
      console.log('[KiroBridge] kiro-cli binary found')
    } catch {
      console.warn('[KiroBridge] kiro-cli binary not found — bridge will be unavailable')
    }
  }

  isAvailable(): boolean {
    try {
      execSync('which kiro-cli', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  async executeTask(task: BridgeTask): Promise<BridgeResult> {
    return this.streamResponse(task, () => {})
  }

  async streamResponse(task: BridgeTask, onEvent: (event: BridgeStreamEvent) => void): Promise<BridgeResult> {
    const controller = new AbortController()
    this.activeSessions.set(task.sessionId, controller)

    const directory = task.context?.projectDirectory ?? '.'
    const username = task.context?.username ?? ''

    if (!username) {
      this.activeSessions.delete(task.sessionId)
      return { success: false, output: '', error: 'Username is required for Kiro CLI execution' }
    }

    try {
      console.log('[KiroBridge] Starting execution for session:', task.sessionId, 'dir:', directory)
      onEvent({ type: 'status', content: 'Starting Kiro CLI...', timestamp: new Date().toISOString() })
      sessionEventBus.emit(task.sessionId, { type: 'status', status: 'running' })

      // Build context prompt
      const contextPrompt = this.buildContextPrompt(task)
      const orderedParts: MessagePart[] = []
      let pendingText = ''
      let buildPartIndex: number | null = null

      const flushPendingText = () => {
        const cleaned = normalizeAssistantText(pendingText).trim()
        if (!cleaned) {
          pendingText = ''
          return
        }

        let cursor = 0
        for (const match of cleaned.matchAll(RUN_TAG_LINE_RE)) {
          const start = match.index ?? 0
          const before = cleaned.slice(cursor, start).trim()
          if (before) orderedParts.push({ type: 'text', content: before })

          const runText = String(match[1] ?? '').trim()
          if (runText) {
            orderedParts.push({ type: 'tool', tool: 'run', path: runText })
          }
          cursor = start + match[0].length
        }

        const tail = cleaned.slice(cursor).trim()
        if (tail) orderedParts.push({ type: 'text', content: tail })
        pendingText = ''
      }

      // Start file watcher for detecting file changes
      const fileWatcher = new KiroFileWatcher(directory)
      fileWatcher.onChange = (event) => {
        if (this.isBuildArtifact(event.path)) return
        console.log(`[KiroBridge] File change detected: ${event.type} ${event.path}`)
        flushPendingText()
        const fileOpId = `kiro-${event.type}-${event.path}-${Date.now()}`
        const streamEvent = {
          type: 'file-op' as const,
          id: fileOpId,
          action: event.type,
          path: event.path,
          status: 'completed' as const,
          tool: 'kiro-cli',
        }
        sessionEventBus.emit(task.sessionId, streamEvent)
        sessionEventBus.emit(task.sessionId, { type: 'file-change', file: event.path })
        onEvent({
          type: 'file-op',
          content: `${event.type}d ${event.path}`,
          timestamp: new Date().toISOString(),
          metadata: { action: event.type, path: event.path, status: 'completed' },
        })
        orderedParts.push({ type: 'file', action: event.type, path: event.path })
      }
      console.log(`[KiroBridge] Starting file watcher for: ${directory}`)
      await fileWatcher.start()
      console.log(`[KiroBridge] File watcher started successfully`)

      // Spawn Kiro CLI process
      onEvent({ type: 'status', content: 'Sending prompt to Kiro...', timestamp: new Date().toISOString() })

      // Extract kiro model ID by stripping 'kiro/' prefix (e.g. 'kiro/claude-sonnet-4' → 'claude-sonnet-4')
      const rawModel = task.context?.model ?? ''
      const kiroModel = rawModel.startsWith('kiro/') ? rawModel.slice(5) : rawModel

      const execution = kiroProcessManager.execute(
        directory,
        contextPrompt,
        username,
        controller.signal,
        kiroModel || undefined,
      )

      // Read stdout in real-time
      const collectedOutput: string[] = []
      const reader = execution.stdout.getReader()
      const decoder = new TextDecoder()
      const filter = new KiroStreamFilter()
      let activeBuildId: string | null = null
      const buildLines: string[] = []
      let buildCommand = ''
      let buildStartTime = 0
      let buildBuffer = ''
      type BuildSummary = {
        id: string
        command: string
        status: 'running' | 'success' | 'failed'
        lines: string[]
        artifactName?: string
        artifactPath?: string
        durationMs?: number
        error?: string
      }
      let lastBuildSummary: BuildSummary | null = null
      let lastBuildEmitAt = 0

      const detectBuildCommand = (text: string): string | null => {
        const runMatch = text.match(/\[Run\]\s+([^\n\r]+)/i)
        if (runMatch?.[1]) return runMatch[1].trim()
        const dollarMatch = text.match(/^\$\s+(.+)$/m)
        if (dollarMatch?.[1]) return dollarMatch[1].trim()
        return null
      }

      const isBuildCommand = (command: string): boolean => {
        return /(^|\s)(?:\.\/)?(?:mvn|mvnw|gradle|gradlew)(?:\s|$)/i.test(command)
      }

      const extractArtifact = (allLines: string[]) => {
        const joined = allLines.join('\n')
        const artifactMatch =
          joined.match(/Building jar:\s+(.+?\.jar)\b/i)
          ?? joined.match(/((?:target|build|out)\/[^\s'"]+\.jar)\b/i)
        const artifactPath = artifactMatch?.[1]?.trim()
        const artifactName = artifactPath ? artifactPath.split('/').pop() : undefined
        return { artifactPath, artifactName }
      }

      const emitBuild = (status: BuildSummary['status'], extra?: Partial<BuildSummary>) => {
        if (!activeBuildId) return
        const now = Date.now()
        if (status === 'running' && now - lastBuildEmitAt < 200) return
        lastBuildEmitAt = now
        const durationMs = buildStartTime ? now - buildStartTime : undefined
        const { artifactName, artifactPath } = extractArtifact(buildLines)
        const payload: BuildSummary = {
          id: activeBuildId,
          command: buildCommand,
          status,
          lines: [...buildLines].slice(-400),
          artifactName,
          artifactPath,
          durationMs,
          ...(extra ?? {}),
        }
        sessionEventBus.emit(task.sessionId, { type: 'build', ...payload })
        lastBuildSummary = payload
        if (buildPartIndex !== null && orderedParts[buildPartIndex]?.type === 'build') {
          orderedParts[buildPartIndex] = {
            type: 'build',
            id: payload.id,
            command: payload.command,
            status: payload.status,
            lines: payload.lines,
            artifactName: payload.artifactName,
            artifactPath: payload.artifactPath,
            durationMs: payload.durationMs,
            error: payload.error,
          }
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (controller.signal.aborted) break

          const chunk = stripAnsi(decoder.decode(value, { stream: true }))
          if (!chunk) continue
          collectedOutput.push(chunk)

          // Detect build command (matches screenshots: "[Run] mvn package")
          if (!activeBuildId) {
            const maybeCmd = detectBuildCommand(chunk)
            if (maybeCmd && isBuildCommand(maybeCmd)) {
              flushPendingText()
              activeBuildId = `build-${task.sessionId}-${Date.now()}`
              buildCommand = maybeCmd
              buildLines.length = 0
              buildStartTime = Date.now()
              buildBuffer = ''
              orderedParts.push({
                type: 'build',
                id: activeBuildId,
                command: buildCommand,
                status: 'running',
                lines: [],
              })
              buildPartIndex = orderedParts.length - 1
              emitBuild('running', { lines: [] })
            }
          }

          // If we are in a build, collect stdout lines and emit incremental updates.
          if (activeBuildId) {
            buildBuffer += chunk
            const lines = buildBuffer.split(/\r?\n/)
            buildBuffer = lines.pop() ?? ''

            for (const line of lines) {
              const trimmedLine = line.trimEnd()
              if (!trimmedLine) continue

              // Keep typical build output lines only (avoid tokenized LLM output)
              if (
                /^\[(?:INFO|WARNING|ERROR|DEBUG)\]/.test(trimmedLine)
                || /BUILD (?:SUCCESS|FAILURE|SUCCESSFUL|FAILED)/i.test(trimmedLine)
                || /Downloading|Downloaded|Compiling|Building|Executing|Tests run|FAILURE|SUCCESS/i.test(trimmedLine)
              ) {
                buildLines.push(trimmedLine)
                if (buildLines.length > 600) buildLines.splice(0, buildLines.length - 600)
                emitBuild('running')
              }

              if (/BUILD SUCCESS|BUILD SUCCESSFUL|build completed successfully/i.test(trimmedLine)) {
                emitBuild('success')
                activeBuildId = null
                buildPartIndex = null
              } else if (/BUILD FAILURE|BUILD FAILED|Compilation failed/i.test(trimmedLine)) {
                emitBuild('failed', { error: trimmedLine })
                activeBuildId = null
                buildPartIndex = null
              }
            }
          }

          const filtered = filter.processChunk(chunk)
          if (filtered) {
            sessionEventBus.emit(task.sessionId, { type: 'text-delta', content: filtered })
            onEvent({ type: 'text-delta', content: filtered, timestamp: new Date().toISOString() })
            pendingText += filtered
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[KiroBridge] Error reading stdout:', err instanceof Error ? err.message : err)
        }
      }

      const remaining = filter.flush()
      if (remaining) {
        sessionEventBus.emit(task.sessionId, { type: 'text-delta', content: remaining })
        onEvent({ type: 'text-delta', content: remaining, timestamp: new Date().toISOString() })
        pendingText += remaining
      }
      flushPendingText()

      // Read any stderr
      let stderrOutput = ''
      try {
        const errReader = execution.stderr.getReader()
        const errDecoder = new TextDecoder()
        while (true) {
          const { done, value } = await errReader.read()
          if (done) break
          stderrOutput += errDecoder.decode(value, { stream: true })
        }
      } catch { /* ignore stderr read errors */ }

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        execution.process.on('exit', () => resolve())
        // In case it already exited
        if (execution.process.exitCode !== null) resolve()
      })

      // Stop file watcher and get final changes
      await fileWatcher.stop()
      const fileChanges = fileWatcher.getChanges()
      
      console.log(`[KiroBridge] File watcher detected ${fileChanges.length} changes`)
      
      // Emit file-op events for all detected changes (excluding build artifacts)
      for (const change of fileChanges) {
        // Skip build artifacts
        if (this.isBuildArtifact(change.path)) {
          console.log(`[KiroBridge] Skipping build artifact: ${change.path}`)
          continue
        }
        
        console.log(`[KiroBridge] Emitting file-op event: ${change.type} ${change.path}`)
        const fileOpId = `kiro-${change.type}-${change.path}-${Date.now()}`
        const streamEvent = {
          type: 'file-op' as const,
          id: fileOpId,
          action: change.type,
          path: change.path,
          status: 'completed' as const,
          tool: 'kiro-cli',
        }
        sessionEventBus.emit(task.sessionId, streamEvent)
        sessionEventBus.emit(task.sessionId, { type: 'file-change', file: change.path })
        onEvent({
          type: 'file-op',
          content: `${change.type}d ${change.path}`,
          timestamp: new Date().toISOString(),
          metadata: { action: change.type, path: change.path, status: 'completed' },
        })
      }

      // Handle cancellation
      if (controller.signal.aborted) {
        sessionEventBus.emitComplete(task.sessionId)
        return { success: false, output: '', error: 'Execution cancelled', metadata: { kiroSessionId: task.sessionId } }
      }

      // Parse output
      const rawOutput = collectedOutput.join('')
      const outputText = extractTextContent(rawOutput)
      const parsedParts = parseKiroOutput(rawOutput)
      const thinkingParts = parsedParts.filter((p) => p.type === 'thinking')
      const parts: MessagePart[] = [...thinkingParts, ...orderedParts]

      // Fallback: if build was tracked but not inserted into ordered parts for any reason.
      if (lastBuildSummary && !parts.some((p) => p.type === 'build')) {
        const b = lastBuildSummary as BuildSummary
        parts.push({
          type: 'build',
          id: b.id,
          command: b.command,
          status: b.status,
          lines: b.lines,
          artifactName: b.artifactName,
          artifactPath: b.artifactPath,
          durationMs: b.durationMs,
          error: b.error,
        })
      }

      // Add file changes that weren't already tracked (excluding build artifacts)
      for (const change of fileChanges) {
        if (this.isBuildArtifact(change.path)) continue
        
        const alreadyTracked = parts.some(
          (p) => p.type === 'file' && p.path === change.path && p.action === change.type,
        )
        if (!alreadyTracked) {
          parts.push({ type: 'file', action: change.type, path: change.path })
        }
      }

      // Emit file-change events for tree refresh
      for (const change of fileChanges) {
        sessionEventBus.emit(task.sessionId, { type: 'file-change', file: change.path })
      }

      // Check for errors
      const exitCode = execution.process.exitCode
      if (exitCode !== 0 && exitCode !== null) {
        const errorMsg = stderrOutput.trim() || `Kiro CLI exited with code ${exitCode}`
        console.error('[KiroBridge] Process failed:', errorMsg)
        // If a build was in progress but never emitted a terminal status, mark it failed.
        if (activeBuildId) {
          emitBuild('failed', { error: errorMsg })
          activeBuildId = null
          buildPartIndex = null
        }
        sessionEventBus.emitError(task.sessionId, errorMsg)
        onEvent({ type: 'error', content: errorMsg, timestamp: new Date().toISOString() })
        sessionEventBus.emitComplete(task.sessionId)
        onEvent({ type: 'complete', content: 'Done', timestamp: new Date().toISOString() })
        return {
          success: false,
          output: outputText || rawOutput,
          error: errorMsg,
          metadata: { kiroSessionId: task.sessionId, parts: parts.length > 0 ? parts : undefined },
        }
      }

      console.log('[KiroBridge] Execution completed for session:', task.sessionId, 'output length:', outputText.length, 'parts:', parts.length)

      // If a build was in progress but never emitted a terminal status, mark it success.
      if (activeBuildId) {
        emitBuild('success')
        activeBuildId = null
        buildPartIndex = null
      }

      sessionEventBus.emitComplete(task.sessionId)
      onEvent({ type: 'complete', content: 'Done', timestamp: new Date().toISOString() })

      return {
        success: true,
        output: outputText || rawOutput,
        metadata: {
          kiroSessionId: task.sessionId,
          parts: parts.length > 0 ? parts : undefined,
        },
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, output: '', error: 'Execution cancelled' }
      }
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[KiroBridge] Bridge error for session:', task.sessionId, msg)
      sessionEventBus.emitError(task.sessionId, msg)
      return { success: false, output: '', error: `Kiro bridge error: ${msg}` }
    } finally {
      this.activeSessions.delete(task.sessionId)
    }
  }

  async cancelExecution(sessionId: string): Promise<void> {
    const controller = this.activeSessions.get(sessionId)
    if (controller) {
      controller.abort()
      this.activeSessions.delete(sessionId)
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  private isBuildArtifact(path: string): boolean {
    // Skip files in build directories
    if (path.includes('/build/') || path.includes('/target/') || path.includes('/.gradle/') || path.includes('/out/')) {
      return true
    }
    
    // Skip compiler-generated files
    const buildExtensions = ['.class', '.lst', '.jar', '.pom', '.properties']
    const ext = path.substring(path.lastIndexOf('.')).toLowerCase()
    if (buildExtensions.includes(ext)) {
      return true
    }
    
    // Skip specific build artifact files
    const buildFiles = ['inputFiles.lst', 'createdFiles.lst', 'dependency-reduced-pom.xml']
    const filename = path.split('/').pop() ?? ''
    if (buildFiles.includes(filename)) {
      return true
    }
    
    return false
  }

  private buildContextPrompt(task: BridgeTask): string {
    const ctx = task.context
    
    const lines: string[] = []
    
    // Add system prompt first
    lines.push(AGENT_SYSTEM_PROMPT)
    lines.push('')
    lines.push('---')
    lines.push('')
    
    // Add project context
    if (ctx?.projectName) {
      lines.push(`[Project: ${ctx.projectName}]`)
      if (ctx.software) lines.push(`Software: ${ctx.software}`)
      if (ctx.language) lines.push(`Language: ${ctx.language}`)
      if (ctx.compiler) lines.push(`Build: ${ctx.compiler}`)
      if (ctx.javaVersion) lines.push(`Java: ${ctx.javaVersion}`)
      if (ctx.projectDirectory) lines.push(`Dir: ${ctx.projectDirectory}`)
      lines.push('')
    }
    
    lines.push(`Request: ${task.prompt}`)

    return lines.join('\n')
  }
}
