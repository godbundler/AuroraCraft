import { readdir, stat } from 'fs/promises'
import { watch, type FSWatcher } from 'fs'
import { join, relative } from 'path'

export interface FileChangeEvent {
  type: 'create' | 'update' | 'delete'
  path: string
}

type OnChangeCallback = (event: FileChangeEvent) => void

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.opencode', '.kiro', '.cache'])
const BUILD_ARTIFACT_PATTERNS = [
  /^target\//i,
  /^build\//i,
  /^out\//i,
  /^\.gradle\//i,
  /^\.mvn\//i,
  /(?:^|\/)(?:classes|generated|generated-sources|generated-test-sources|tmp|libs|reports|test-results)\//i,
  /\.(?:class|jar|war|ear|lst|properties|pom|sha1|md5)$/i,
  /(?:^|\/)(?:createdFiles|inputFiles)\.lst$/i,
  /(?:^|\/)consumer.*\.pom$/i,
]

export class KiroFileWatcher {
  private directory: string
  private snapshot = new Map<string, number>()
  private changes: FileChangeEvent[] = []
  private watcher: FSWatcher | null = null
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private stopped = false

  onChange: OnChangeCallback = () => {}

  constructor(directory: string) {
    this.directory = directory
  }

  async start(): Promise<void> {
    // Take initial snapshot of the directory tree
    try {
      await this.takeSnapshot()
    } catch (err) {
      // Directory might not exist yet — start with an empty snapshot
      console.warn(`[KiroFileWatcher] Could not snapshot directory ${this.directory}:`, err instanceof Error ? err.message : err)
    }

    // Start live file watching
    try {
      this.watcher = watch(this.directory, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        if (this.shouldIgnore(filename)) return
        this.handleFsEvent(filename)
      })

      this.watcher.on('error', (err) => {
        console.error(`[KiroFileWatcher] Watch error for ${this.directory}:`, err instanceof Error ? err.message : err)
      })
    } catch (err) {
      console.warn(`[KiroFileWatcher] Could not start watcher for ${this.directory}:`, err instanceof Error ? err.message : err)
    }
  }

  async stop(): Promise<void> {
    this.stopped = true

    // Stop the live watcher
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    // Clear pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // Do a final diff against the initial snapshot
    try {
      await this.diffAgainstSnapshot()
    } catch (err) {
      console.warn(`[KiroFileWatcher] Could not perform final diff for ${this.directory}:`, err instanceof Error ? err.message : err)
    }
  }

  getChanges(): FileChangeEvent[] {
    return [...this.changes]
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async takeSnapshot(): Promise<void> {
    this.snapshot.clear()
    const entries = await this.walkDirectory(this.directory)
    for (const entry of entries) {
      this.snapshot.set(entry.path, entry.mtime)
    }
  }

  private async diffAgainstSnapshot(): Promise<void> {
    const currentEntries = new Map<string, number>()

    try {
      const entries = await this.walkDirectory(this.directory)
      for (const entry of entries) {
        currentEntries.set(entry.path, entry.mtime)
      }
    } catch {
      // Directory may have been removed — treat all snapshot entries as deleted
    }

    // Detect created and updated files
    for (const [filePath, mtime] of currentEntries) {
      const originalMtime = this.snapshot.get(filePath)
      if (originalMtime === undefined) {
        this.recordChange({ type: 'create', path: filePath })
      } else if (mtime !== originalMtime) {
        this.recordChange({ type: 'update', path: filePath })
      }
    }

    // Detect deleted files
    for (const filePath of this.snapshot.keys()) {
      if (!currentEntries.has(filePath)) {
        this.recordChange({ type: 'delete', path: filePath })
      }
    }
  }

  private handleFsEvent(filename: string): void {
    // Debounce rapid events for the same file (editors often trigger multiple writes)
    const existing = this.debounceTimers.get(filename)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filename)
      this.resolveFileChange(filename)
    }, 100)

    this.debounceTimers.set(filename, timer)
  }

  private resolveFileChange(filename: string): void {
    if (this.stopped) return

    const absolutePath = join(this.directory, filename)
    const relativePath = filename

    stat(absolutePath)
      .then((stats) => {
        if (this.stopped) return
        if (!stats.isFile()) return
        const hadBefore = this.snapshot.has(relativePath)
        const type: FileChangeEvent['type'] = hadBefore ? 'update' : 'create'
        this.recordChange({ type, path: relativePath })
        // Update the snapshot so subsequent events for the same file are accurate
        this.snapshot.set(relativePath, stats.mtimeMs)
      })
      .catch(() => {
        if (this.stopped) return
        // File doesn't exist — it was deleted
        if (this.snapshot.has(relativePath)) {
          this.recordChange({ type: 'delete', path: relativePath })
          this.snapshot.delete(relativePath)
        }
      })
  }

  private recordChange(event: FileChangeEvent): void {
    if (this.isBuildArtifactPath(event.path)) return

    // Deduplicate: if we already have the same type+path, skip
    const isDuplicate = this.changes.some(
      (c) => c.type === event.type && c.path === event.path,
    )
    if (isDuplicate) return

    this.changes.push(event)
    this.onChange(event)
  }

  private async walkDirectory(dir: string): Promise<Array<{ path: string; mtime: number }>> {
    const results: Array<{ path: string; mtime: number }> = []

    const walk = async (currentDir: string): Promise<void> => {
      let entries
      try {
        entries = await readdir(currentDir, { withFileTypes: true })
      } catch {
        return // Directory not readable — skip
      }

      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue

        const absolutePath = join(currentDir, entry.name)
        const relativePath = relative(this.directory, absolutePath)

        if (entry.isDirectory()) {
          await walk(absolutePath)
        } else if (entry.isFile()) {
          try {
            const stats = await stat(absolutePath)
            results.push({ path: relativePath, mtime: stats.mtimeMs })
          } catch {
            // File may have been removed between readdir and stat — skip
          }
        }
      }
    }

    await walk(dir)
    return results
  }

  private shouldIgnore(filename: string): boolean {
    const segments = filename.split(/[/\\]/)
    return segments.some((segment) => IGNORED_DIRS.has(segment))
  }

  private isBuildArtifactPath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.?\//, '')
    return BUILD_ARTIFACT_PATTERNS.some((pattern) => pattern.test(normalized))
  }
}
