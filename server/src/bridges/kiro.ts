import type { BridgeInterface, BridgeTask, BridgeResult, BridgeStreamEvent, MessagePart } from './types.js'
import { kiroProcessManager } from './kiro-process-manager.js'
import { KiroFileWatcher } from './kiro-file-watcher.js'
import { parseKiroOutput, extractTextContent, stripAnsi } from './kiro-output-parser.js'
import { sessionEventBus } from './session-event-bus.js'
import { execSync } from 'child_process'

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

      // Start file watcher for detecting file changes
      const fileWatcher = new KiroFileWatcher(directory)
      fileWatcher.onChange = (event) => {
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
        onEvent({
          type: 'file-op',
          content: `${event.type}d ${event.path}`,
          timestamp: new Date().toISOString(),
          metadata: { action: event.type, path: event.path, status: 'completed' },
        })
      }
      await fileWatcher.start()

      // Spawn Kiro CLI process
      onEvent({ type: 'status', content: 'Sending prompt to Kiro...', timestamp: new Date().toISOString() })

      const execution = kiroProcessManager.execute(
        directory,
        contextPrompt,
        username,
        controller.signal,
      )

      // Read stdout in real-time
      const collectedOutput: string[] = []
      const reader = execution.stdout.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (controller.signal.aborted) break

          const chunk = stripAnsi(decoder.decode(value, { stream: true }))
          if (!chunk) continue
          collectedOutput.push(chunk)

          // Emit text-delta events for real-time streaming
          sessionEventBus.emit(task.sessionId, { type: 'text-delta', content: chunk })
          onEvent({ type: 'text-delta', content: chunk, timestamp: new Date().toISOString() })
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[KiroBridge] Error reading stdout:', err instanceof Error ? err.message : err)
        }
      }

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

      // Handle cancellation
      if (controller.signal.aborted) {
        sessionEventBus.emitComplete(task.sessionId)
        return { success: false, output: '', error: 'Execution cancelled', metadata: { kiroSessionId: task.sessionId } }
      }

      // Parse output
      const rawOutput = collectedOutput.join('')
      const outputText = extractTextContent(rawOutput)
      const parts = parseKiroOutput(rawOutput)

      // Add file changes that weren't detected in the output parser
      for (const change of fileChanges) {
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

  private buildContextPrompt(task: BridgeTask): string {
    const ctx = task.context
    if (!ctx?.projectName) return task.prompt

    const lines: string[] = []
    lines.push(`[Project: ${ctx.projectName}]`)
    if (ctx.software) lines.push(`Software: ${ctx.software}`)
    if (ctx.language) lines.push(`Language: ${ctx.language}`)
    if (ctx.compiler) lines.push(`Build: ${ctx.compiler}`)
    if (ctx.javaVersion) lines.push(`Java: ${ctx.javaVersion}`)
    if (ctx.projectDirectory) lines.push(`Dir: ${ctx.projectDirectory}`)
    lines.push('')
    lines.push(`Request: ${task.prompt}`)

    return lines.join('\n')
  }
}
