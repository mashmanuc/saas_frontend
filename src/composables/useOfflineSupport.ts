import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface OfflineQueueItem {
  id: string
  action: string
  payload: any
  timestamp: number
  retries: number
}

const STORAGE_KEY = 'offline_queue'
const MAX_RETRIES = 3
const QUEUE_LIMIT = 20

class OfflineQueue {
  private queue: OfflineQueueItem[] = []
  private processing = false

  constructor() {
    this.loadQueue()
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch (err) {
      console.error('[offline] Failed to load queue:', err)
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue))
    } catch (err) {
      console.error('[offline] Failed to save queue:', err)
    }
  }

  add(action: string, payload: any): boolean {
    if (this.queue.length >= QUEUE_LIMIT) {
      console.warn('[offline] Queue limit reached, cannot add more items')
      return false
    }
    
    const item: OfflineQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      payload,
      timestamp: Date.now(),
      retries: 0
    }
    this.queue.push(item)
    this.saveQueue()
    return true
  }

  async process(executor: (item: OfflineQueueItem) => Promise<void>) {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const item = this.queue[0]

      try {
        await executor(item)
        this.queue.shift()
        this.saveQueue()
      } catch (err) {
        console.error('[offline] Failed to process item:', item, err)
        item.retries++

        if (item.retries >= MAX_RETRIES) {
          console.error('[offline] Max retries reached, removing item:', item)
          this.queue.shift()
        } else {
          // Move to end of queue for retry
          this.queue.shift()
          this.queue.push(item)
        }
        this.saveQueue()
        break
      }
    }

    this.processing = false
  }

  getQueue() {
    return [...this.queue]
  }

  clear() {
    this.queue = []
    this.saveQueue()
  }

  size() {
    return this.queue.length
  }
}

const offlineQueue = new OfflineQueue()

export function useOfflineSupport() {
  const isOnline = ref(navigator.onLine)
  const queueSize = ref(offlineQueue.size())

  function handleOnline() {
    isOnline.value = true
  }

  function handleOffline() {
    isOnline.value = false
  }

  function addToQueue(action: string, payload: any): boolean {
    const added = offlineQueue.add(action, payload)
    queueSize.value = offlineQueue.size()
    
    if (!added && typeof window !== 'undefined' && (window as any).toast) {
      (window as any).toast.warning('Offline queue is full. Please clear the queue.')
    }
    
    return added
  }

  async function processQueue(executor: (item: OfflineQueueItem) => Promise<void>) {
    await offlineQueue.process(executor)
    queueSize.value = offlineQueue.size()
  }

  function clearQueue() {
    offlineQueue.clear()
    queueSize.value = 0
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  const isQueueFull = computed(() => queueSize.value >= QUEUE_LIMIT)
  const queuePercentage = computed(() => Math.round((queueSize.value / QUEUE_LIMIT) * 100))

  return {
    isOnline,
    queueSize,
    isQueueFull,
    queuePercentage,
    queueLimit: QUEUE_LIMIT,
    addToQueue,
    processQueue,
    clearQueue,
    getQueue: () => offlineQueue.getQueue()
  }
}

export function useOptimisticUpdate<T>(
  updateFn: (data: T) => Promise<void>,
  rollbackFn: (data: T) => void
) {
  const { isOnline, addToQueue } = useOfflineSupport()

  async function execute(data: T, optimisticUpdate?: () => void) {
    // Apply optimistic update immediately
    if (optimisticUpdate) {
      optimisticUpdate()
    }

    if (!isOnline.value) {
      // Queue for later if offline
      addToQueue('update', data)
      return
    }

    try {
      await updateFn(data)
    } catch (err) {
      // Rollback on error
      if (rollbackFn) {
        rollbackFn(data)
      }
      throw err
    }
  }

  return { execute }
}
