// Board Event Emitter

type EventHandler<T = unknown> = (data: T) => void

export class BoardEventEmitter<Events extends { [key: string]: unknown }> {
  private listeners: Map<keyof Events, Set<EventHandler<unknown>>> = new Map()

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>)

    return () => this.off(event, handler)
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>)
    }
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data)
        } catch (err) {
          console.error(`[BoardEventEmitter] Error in handler for ${String(event)}:`, err)
        }
      })
    }
  }

  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    const wrapper: EventHandler<Events[K]> = (data) => {
      this.off(event, wrapper)
      handler(data)
    }
    return this.on(event, wrapper)
  }

  removeAll(): void {
    this.listeners.clear()
  }

  removeAllForEvent<K extends keyof Events>(event: K): void {
    this.listeners.delete(event)
  }
}

export default BoardEventEmitter
