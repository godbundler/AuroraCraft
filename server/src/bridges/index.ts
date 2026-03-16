import type { BridgeInterface } from './types.js'
import { OpenCodeBridge } from './opencode.js'

class BridgeRegistry {
  private bridges = new Map<string, BridgeInterface>()

  register(bridge: BridgeInterface) {
    this.bridges.set(bridge.name, bridge)
  }

  get(name: string): BridgeInterface | undefined {
    return this.bridges.get(name)
  }

  getDefault(): BridgeInterface | undefined {
    // Return the first available bridge, or first bridge overall
    const available = this.getAvailable()
    return available.length > 0 ? available[0] : this.bridges.values().next().value
  }

  getAvailable(): BridgeInterface[] {
    return Array.from(this.bridges.values()).filter((b) => b.isAvailable())
  }

  getAll(): BridgeInterface[] {
    return Array.from(this.bridges.values())
  }
}

export const bridgeRegistry = new BridgeRegistry()

// Register built-in bridges
export const opencodeBridge = new OpenCodeBridge()
bridgeRegistry.register(opencodeBridge)

// Try to initialize bridges on startup (non-blocking)
opencodeBridge.initialize().catch(() => {
  // OpenCode might not be running yet, that's fine
})

export type { BridgeInterface, BridgeTask, BridgeResult, BridgeStreamEvent, MessagePart, TodoItem, StreamEvent, StreamTodoItem } from './types.js'
export { SubscriptionManager } from './opencode.js'
