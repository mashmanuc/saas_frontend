import type { TypedEventEmitter } from './types'

export class EventEmitter<TEvents extends Record<string, (...args: any[]) => void>> implements TypedEventEmitter<TEvents> {
  private listeners = new Map<keyof TEvents, Set<TEvents[keyof TEvents]>>()

  on<T extends keyof TEvents>(event: T, handler: TEvents[T]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off<T extends keyof TEvents>(event: T, handler: TEvents[T]): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit<T extends keyof TEvents>(event: T, ...args: Parameters<TEvents[T]>): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      handler(...args)
    }
  }

  removeAll(): void {
    this.listeners.clear()
  }
}
