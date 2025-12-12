// F4: Storage Engine - Local autosave and offline queue

const STORAGE_PREFIX = 'classroom_'
const AUTOSAVE_KEY = 'autosave_'
const QUEUE_KEY = 'offline_queue_'

export interface QueuedOperation {
  id: string
  type: string
  data: Record<string, unknown>
  timestamp: number
  retries: number
}

export interface AutosaveData {
  sessionId: string
  boardState: Record<string, unknown>
  version: number
  savedAt: number
}

export class StorageEngine {
  private sessionId: string
  private autosaveInterval: number | null = null
  private autosaveIntervalMs: number = 30000 // 30 seconds

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  // Autosave methods
  startAutosave(
    getState: () => Record<string, unknown>,
    getVersion: () => number
  ): void {
    this.stopAutosave()
    
    this.autosaveInterval = window.setInterval(() => {
      this.saveState(getState(), getVersion())
    }, this.autosaveIntervalMs)
  }

  stopAutosave(): void {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval)
      this.autosaveInterval = null
    }
  }

  setAutosaveInterval(ms: number): void {
    this.autosaveIntervalMs = ms
  }

  saveState(boardState: Record<string, unknown>, version: number): void {
    const data: AutosaveData = {
      sessionId: this.sessionId,
      boardState,
      version,
      savedAt: Date.now(),
    }

    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${AUTOSAVE_KEY}${this.sessionId}`,
        JSON.stringify(data)
      )
    } catch (error) {
      console.error('[StorageEngine] Failed to save state:', error)
    }
  }

  loadState(): AutosaveData | null {
    try {
      const raw = localStorage.getItem(
        `${STORAGE_PREFIX}${AUTOSAVE_KEY}${this.sessionId}`
      )
      if (!raw) return null
      return JSON.parse(raw) as AutosaveData
    } catch (error) {
      console.error('[StorageEngine] Failed to load state:', error)
      return null
    }
  }

  clearState(): void {
    localStorage.removeItem(`${STORAGE_PREFIX}${AUTOSAVE_KEY}${this.sessionId}`)
  }

  // Offline queue methods
  queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>): void {
    const queue = this.getQueue()
    
    const queuedOp: QueuedOperation = {
      id: this.generateId(),
      type: operation.type,
      data: operation.data,
      timestamp: Date.now(),
      retries: 0,
    }

    queue.push(queuedOp)
    this.saveQueue(queue)
  }

  getQueue(): QueuedOperation[] {
    try {
      const raw = localStorage.getItem(
        `${STORAGE_PREFIX}${QUEUE_KEY}${this.sessionId}`
      )
      if (!raw) return []
      return JSON.parse(raw) as QueuedOperation[]
    } catch {
      return []
    }
  }

  private saveQueue(queue: QueuedOperation[]): void {
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${QUEUE_KEY}${this.sessionId}`,
        JSON.stringify(queue)
      )
    } catch (error) {
      console.error('[StorageEngine] Failed to save queue:', error)
    }
  }

  dequeueOperation(): QueuedOperation | null {
    const queue = this.getQueue()
    if (queue.length === 0) return null

    const operation = queue.shift()!
    this.saveQueue(queue)
    return operation
  }

  markRetry(operationId: string): void {
    const queue = this.getQueue()
    const idx = queue.findIndex((op) => op.id === operationId)
    
    if (idx !== -1) {
      queue[idx].retries++
      this.saveQueue(queue)
    }
  }

  removeOperation(operationId: string): void {
    const queue = this.getQueue()
    const filtered = queue.filter((op) => op.id !== operationId)
    this.saveQueue(filtered)
  }

  clearQueue(): void {
    localStorage.removeItem(`${STORAGE_PREFIX}${QUEUE_KEY}${this.sessionId}`)
  }

  getQueueSize(): number {
    return this.getQueue().length
  }

  hasOfflineData(): boolean {
    return this.loadState() !== null || this.getQueueSize() > 0
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  // Cleanup
  destroy(): void {
    this.stopAutosave()
  }
}
