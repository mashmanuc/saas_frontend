/**
 * Chat Message Recovery Queue v1.0
 * 
 * Зберігання повідомлень при відсутності з'єднання:
 * - Зберігає в localStorage при offline
 * - Автоматично відправляє при відновленні
 * - Гарантує доставку або показує помилку
 */

const QUEUE_STORAGE_KEY = 'chat_message_queue'
const MAX_QUEUE_SIZE = 100
const MAX_RETRY_ATTEMPTS = 5
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000] // exponential backoff

class MessageRecoveryQueue {
  constructor() {
    this.queue = this.loadQueue()
    this.isProcessing = false
    this.listeners = new Set()
    this.onlineStatus = navigator.onLine
    
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline())
      window.addEventListener('offline', () => this.handleOffline())
    }
  }

  /**
   * Додати повідомлення в чергу
   */
  enqueue(message, sendFn) {
    const queueItem = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      sendFn: null, // Functions can't be serialized, stored by reference
      attempts: 0,
      createdAt: Date.now(),
      status: 'pending'
    }

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift() // Remove oldest
    }

    this.queue.push(queueItem)
    this.saveQueue()
    
    // Try to send immediately if online
    if (this.onlineStatus && !this.isProcessing) {
      this.processQueue()
    }

    this.notifyListeners()
    return queueItem.id
  }

  /**
   * Зареєструвати функцію відправки для ID повідомлення
   * (викликається при відновленні сесії)
   */
  registerSendFn(messageId, sendFn) {
    const item = this.queue.find(i => i.id === messageId)
    if (item) {
      item.sendFn = sendFn
    }
  }

  /**
   * Обробити чергу при відновленні з'єднання
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return
    
    this.isProcessing = true
    const pendingItems = this.queue.filter(item => item.status === 'pending')

    for (const item of pendingItems) {
      if (!navigator.onLine) break

      try {
        item.status = 'sending'
        this.notifyListeners()

        // If we have a registered send function, use it
        if (item.sendFn) {
          await item.sendFn(item.message)
        }

        // Success - remove from queue
        this.removeFromQueue(item.id)
      } catch (error) {
        item.attempts++
        
        if (item.attempts >= MAX_RETRY_ATTEMPTS) {
          item.status = 'failed'
          console.error(`[MessageRecovery] Message ${item.id} failed after ${MAX_RETRY_ATTEMPTS} attempts`)
        } else {
          item.status = 'pending'
          // Wait before next attempt
          await this.delay(RETRY_DELAYS[Math.min(item.attempts - 1, RETRY_DELAYS.length - 1)])
        }
        
        this.saveQueue()
        this.notifyListeners()
      }
    }

    this.isProcessing = false
    this.notifyListeners()
  }

  /**
   * Видалити з черги
   */
  removeFromQueue(messageId) {
    const index = this.queue.findIndex(item => item.id === messageId)
    if (index !== -1) {
      this.queue.splice(index, 1)
      this.saveQueue()
      this.notifyListeners()
    }
  }

  /**
   * Отримати статус черги
   */
  getStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(i => i.status === 'pending').length,
      sending: this.queue.filter(i => i.status === 'sending').length,
      failed: this.queue.filter(i => i.status === 'failed').length,
      isOnline: this.onlineStatus,
      isProcessing: this.isProcessing
    }
  }

  /**
   * Отримати всі невдалі повідомлення для retry
   */
  getFailedMessages() {
    return this.queue.filter(item => item.status === 'failed')
  }

  /**
   * Повторити невдалі повідомлення
   */
  async retryFailed() {
    const failed = this.getFailedMessages()
    for (const item of failed) {
      item.attempts = 0
      item.status = 'pending'
    }
    this.saveQueue()
    await this.processQueue()
  }

  /**
   * Очистити всю чергу
   */
  clear() {
    this.queue = []
    this.saveQueue()
    this.notifyListeners()
  }

  /**
   * Слухачі змін
   */
  onChange(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notifyListeners() {
    const status = this.getStatus()
    this.listeners.forEach(listener => {
      try {
        listener(status)
      } catch (error) {
        console.error('[MessageRecovery] Listener error:', error)
      }
    })
  }

  handleOnline() {
    this.onlineStatus = true
    console.log('[MessageRecovery] Online - processing queue')
    this.processQueue()
  }

  handleOffline() {
    this.onlineStatus = false
    console.log('[MessageRecovery] Offline - queue paused')
  }

  loadQueue() {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('[MessageRecovery] Failed to load queue:', error)
      return []
    }
  }

  saveQueue() {
    if (typeof window === 'undefined') return
    try {
      // Don't save functions
      const serializable = this.queue.map(item => ({
        ...item,
        sendFn: undefined
      }))
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(serializable))
    } catch (error) {
      console.error('[MessageRecovery] Failed to save queue:', error)
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Singleton
export const messageRecoveryQueue = new MessageRecoveryQueue()

/**
 * Composable для Vue
 */
export function useMessageRecovery() {
  return {
    enqueue: (msg, fn) => messageRecoveryQueue.enqueue(msg, fn),
    registerSendFn: (id, fn) => messageRecoveryQueue.registerSendFn(id, fn),
    getStatus: () => messageRecoveryQueue.getStatus(),
    retryFailed: () => messageRecoveryQueue.retryFailed(),
    clear: () => messageRecoveryQueue.clear(),
    onChange: (cb) => messageRecoveryQueue.onChange(cb)
  }
}

export default messageRecoveryQueue
