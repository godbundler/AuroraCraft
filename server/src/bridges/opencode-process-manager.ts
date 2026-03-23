import { spawn, type ChildProcess } from 'child_process'
import { env } from '../env.js'

interface OpenCodeInstance {
  process: ChildProcess
  port: number
  url: string
  directory: string
  refCount: number
  lastActivity: Date
  status: 'starting' | 'ready' | 'stopping' | 'stopped'
  idleTimer?: ReturnType<typeof setTimeout>
}

export class OpenCodeProcessManager {
  private instances = new Map<string, OpenCodeInstance>()
  private startPromises = new Map<string, Promise<OpenCodeInstance>>()
  private usedPorts = new Set<number>()
  private portMin: number
  private portMax: number
  private idleTimeoutMs: number

  constructor() {
    this.portMin = env.OPENCODE_PORT_MIN
    this.portMax = env.OPENCODE_PORT_MAX
    this.idleTimeoutMs = env.OPENCODE_IDLE_TIMEOUT
  }

  async acquire(directory: string): Promise<string> {
    const existing = this.instances.get(directory)
    if (existing && existing.status === 'ready') {
      this.cancelIdleTimer(existing)
      existing.refCount++
      existing.lastActivity = new Date()
      console.log(`[ProcessManager] Reusing OpenCode instance for ${directory} on port ${existing.port} (refCount: ${existing.refCount})`)
      return existing.url
    }

    const pending = this.startPromises.get(directory)
    if (pending) {
      console.log(`[ProcessManager] Waiting for pending OpenCode start for ${directory}`)
      const instance = await pending
      instance.refCount++
      instance.lastActivity = new Date()
      this.cancelIdleTimer(instance)
      return instance.url
    }

    const startPromise = this.startInstance(directory)
    this.startPromises.set(directory, startPromise)

    try {
      const instance = await startPromise
      instance.refCount++
      return instance.url
    } finally {
      this.startPromises.delete(directory)
    }
  }

  async release(directory: string): Promise<void> {
    const instance = this.instances.get(directory)
    if (!instance) return

    instance.refCount = Math.max(0, instance.refCount - 1)
    instance.lastActivity = new Date()
    console.log(`[ProcessManager] Released OpenCode instance for ${directory} (refCount: ${instance.refCount})`)

    if (instance.refCount === 0) {
      this.scheduleIdleShutdown(instance, directory)
    }
  }

  getInstanceUrl(directory: string): string | null {
    const instance = this.instances.get(directory)
    if (instance && instance.status === 'ready') {
      return instance.url
    }
    return null
  }

  async shutdown(): Promise<void> {
    console.log(`[ProcessManager] Shutting down all OpenCode instances (${this.instances.size} active)`)

    const stopPromises: Promise<void>[] = []
    for (const [directory] of this.instances) {
      stopPromises.push(this.stopInstance(directory))
    }
    await Promise.allSettled(stopPromises)
    this.instances.clear()
    this.usedPorts.clear()
    this.startPromises.clear()
  }

  private allocatePort(): number {
    for (let port = this.portMin; port <= this.portMax; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port)
        return port
      }
    }
    throw new Error(`No available ports in range ${this.portMin}-${this.portMax}. All ${this.portMax - this.portMin + 1} ports are in use.`)
  }

  private releasePort(port: number): void {
    this.usedPorts.delete(port)
  }

  private async startInstance(directory: string): Promise<OpenCodeInstance> {
    const port = this.allocatePort()
    const url = `http://localhost:${port}`

    console.log(`[ProcessManager] Starting OpenCode for ${directory} on port ${port}`)

    const child = spawn('opencode', ['serve', '--port', String(port), directory], {
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HOME: directory },
      detached: false,
    })

    const instance: OpenCodeInstance = {
      process: child,
      port,
      url,
      directory,
      refCount: 0,
      lastActivity: new Date(),
      status: 'starting',
    }

    this.instances.set(directory, instance)

    child.stdout?.on('data', (data: Buffer) => {
      console.log(`[OpenCode:${port}] ${data.toString().trim()}`)
    })

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[OpenCode:${port}] ${data.toString().trim()}`)
    })

    child.on('error', (err) => {
      console.error(`[ProcessManager] OpenCode process error for ${directory}:`, err.message)
      this.cleanupInstance(directory, instance)
    })

    child.on('exit', (code, signal) => {
      console.log(`[ProcessManager] OpenCode process exited for ${directory} (code: ${code}, signal: ${signal})`)
      this.cleanupInstance(directory, instance)
    })

    const ready = await this.waitForReady(url, 30000)
    if (!ready) {
      console.error(`[ProcessManager] OpenCode failed to start within 30s on port ${port}`)
      await this.stopInstance(directory)
      throw new Error(`OpenCode failed to start for ${directory}. Make sure 'opencode' is installed and accessible.`)
    }

    if (instance.status === 'stopped') {
      throw new Error(`OpenCode process exited before becoming ready for ${directory}`)
    }

    instance.status = 'ready'
    console.log(`[ProcessManager] OpenCode ready for ${directory} on port ${port}`)
    return instance
  }

  private async stopInstance(directory: string): Promise<void> {
    const instance = this.instances.get(directory)
    if (!instance) return

    instance.status = 'stopping'
    this.cancelIdleTimer(instance)

    console.log(`[ProcessManager] Stopping OpenCode for ${directory} on port ${instance.port}`)

    const child = instance.process

    try {
      child.kill('SIGTERM')

      await new Promise<void>((resolve) => {
        const forceKill = setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch { /* already dead */ }
          resolve()
        }, 5000)

        child.on('exit', () => {
          clearTimeout(forceKill)
          resolve()
        })
      })
    } catch {
      try { child.kill('SIGKILL') } catch { /* ignore */ }
    }

    this.cleanupInstance(directory, instance)
  }

  private cleanupInstance(directory: string, instance: OpenCodeInstance): void {
    if (instance.status === 'stopped') return
    instance.status = 'stopped'
    this.cancelIdleTimer(instance)
    this.releasePort(instance.port)
    this.instances.delete(directory)
    console.log(`[ProcessManager] Cleaned up instance for ${directory} (port ${instance.port} released)`)
  }

  private async waitForReady(url: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    const pollInterval = 500

    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${url}/session`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        })
        if (res.ok) return true
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, pollInterval))
    }
    return false
  }

  private scheduleIdleShutdown(instance: OpenCodeInstance, directory: string): void {
    this.cancelIdleTimer(instance)
    console.log(`[ProcessManager] Scheduling idle shutdown for ${directory} in ${this.idleTimeoutMs / 1000}s`)

    instance.idleTimer = setTimeout(() => {
      if (instance.refCount === 0 && instance.status === 'ready') {
        console.log(`[ProcessManager] Idle timeout reached for ${directory} — stopping`)
        this.stopInstance(directory).catch((err) => {
          console.error(`[ProcessManager] Error stopping idle instance for ${directory}:`, err)
        })
      }
    }, this.idleTimeoutMs)
  }

  private cancelIdleTimer(instance: OpenCodeInstance): void {
    if (instance.idleTimer) {
      clearTimeout(instance.idleTimer)
      instance.idleTimer = undefined
    }
  }
}

export const processManager = new OpenCodeProcessManager()
