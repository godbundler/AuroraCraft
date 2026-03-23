import type { StreamEvent } from './types.js'

// ── Bridge-agnostic session event bus ────────────────────────────────
//
// Any bridge (OpenCode, Kiro, …) can emit StreamEvent events through
// this bus, and the SSE endpoint can subscribe to them without knowing
// which bridge produced them.

type Callback = (event: StreamEvent) => void

const MAX_BUFFER_SIZE = 500
const AUTO_CLEANUP_DELAY = 60_000 // 60s after last listener leaves

export class SessionEventBus {
  private listeners = new Map<string, Set<Callback>>()
  private buffers = new Map<string, StreamEvent[]>()
  private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Subscribe to events for a given session.
   * Any buffered (non-terminal) events are replayed immediately.
   * Returns an unsubscribe function.
   */
  subscribe(sessionId: string, callback: Callback): () => void {
    // Cancel any pending auto-cleanup for this session
    this.cancelCleanupTimer(sessionId)

    let set = this.listeners.get(sessionId)
    if (!set) {
      set = new Set()
      this.listeners.set(sessionId, set)
    }
    set.add(callback)

    // Replay buffered events to the new subscriber
    const buffered = this.buffers.get(sessionId)
    if (buffered && buffered.length > 0) {
      for (const event of buffered) {
        callback(event)
      }
    }

    return () => {
      this.removeListener(sessionId, callback)
    }
  }

  /**
   * Emit a StreamEvent to all current listeners for a session.
   * Non-terminal events are buffered for late-joining subscribers.
   */
  emit(sessionId: string, event: StreamEvent): void {
    // Buffer non-terminal events so late-joining listeners can catch up.
    // 'complete' is terminal and should only be dispatched live.
    if (event.type !== 'complete') {
      let buffer = this.buffers.get(sessionId)
      if (!buffer) {
        buffer = []
        this.buffers.set(sessionId, buffer)
      }
      buffer.push(event)
      if (buffer.length > MAX_BUFFER_SIZE) {
        buffer.splice(0, buffer.length - MAX_BUFFER_SIZE)
      }
    }

    // Dispatch to live listeners
    const set = this.listeners.get(sessionId)
    if (set) {
      for (const cb of [...set]) cb(event)
    }
  }

  /** Convenience: emit a `complete` event for a session. */
  emitComplete(sessionId: string): void {
    this.emit(sessionId, { type: 'complete' })
  }

  /** Convenience: emit an `error` event for a session. */
  emitError(sessionId: string, message: string): void {
    this.emit(sessionId, { type: 'error', message })
  }

  /** Clear the event buffer for a session (e.g. before a new prompt). */
  clearBuffer(sessionId: string): void {
    this.buffers.delete(sessionId)
  }

  /**
   * Fully clean up a session — remove all listeners, buffers, and timers.
   */
  cleanup(sessionId: string): void {
    this.cancelCleanupTimer(sessionId)
    this.listeners.delete(sessionId)
    this.buffers.delete(sessionId)
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private removeListener(sessionId: string, callback: Callback): void {
    const set = this.listeners.get(sessionId)
    if (!set) return

    set.delete(callback)

    if (set.size === 0) {
      this.listeners.delete(sessionId)
      this.scheduleCleanup(sessionId)
    }
  }

  /**
   * Schedule auto-cleanup of the buffer after no listeners remain for
   * {@link AUTO_CLEANUP_DELAY} ms.  This prevents unbounded memory
   * growth for sessions that are no longer observed.
   */
  private scheduleCleanup(sessionId: string): void {
    this.cancelCleanupTimer(sessionId)

    const timer = setTimeout(() => {
      this.cleanupTimers.delete(sessionId)

      // Only clean up if there are still no listeners
      const set = this.listeners.get(sessionId)
      if (!set || set.size === 0) {
        this.buffers.delete(sessionId)
        this.listeners.delete(sessionId)
      }
    }, AUTO_CLEANUP_DELAY)

    this.cleanupTimers.set(sessionId, timer)
  }

  private cancelCleanupTimer(sessionId: string): void {
    const timer = this.cleanupTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.cleanupTimers.delete(sessionId)
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────

export const sessionEventBus = new SessionEventBus()
