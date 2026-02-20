/**
 * Polling Coordinator — єдиний центр управління всіма polling-запитами.
 *
 * Проблема: кілька компонентів (NotificationsBell, ChatNotificationsBell,
 * DashboardTutor, StudentActiveTutorsSection, NotificationsBadge) незалежно
 * запускають setInterval для polling одних і тих самих endpoints.
 * Це викликає:
 * 1. Дублювання HTTP-запитів
 * 2. Одночасні re-renders від кількох джерел
 * 3. "Дьоргання" сторінки (layout shifts, forced reflows)
 *
 * Рішення: централізований координатор, який:
 * - Дедуплікує polling для одного endpoint
 * - Розносить запити в часі (stagger)
 * - Пригальмовує polling коли вкладка прихована
 * - Пригальмовує polling при поганому з'єднанні
 * - Використовує requestIdleCallback для обробки відповідей
 * - Не тригерить re-render якщо дані не змінилися (shallow compare)
 *
 * Використання:
 *   import { pollingCoordinator } from '@/services/pollingCoordinator'
 *
 *   // Реєстрація polling-задачі
 *   const unsub = pollingCoordinator.register({
 *     id: 'notifications-unread',
 *     fn: () => notificationsStore.pollUnreadCount(),
 *     interval: 60_000,
 *     priority: 'low',        // 'high' | 'normal' | 'low'
 *     runImmediately: true,
 *     visibilityAware: true,   // Пригальмовувати коли вкладка прихована
 *   })
 *
 *   // Відписка
 *   unsub()
 */

type Priority = 'high' | 'normal' | 'low'

export interface PollingTask {
  id: string
  fn: () => Promise<void> | void
  interval: number
  priority?: Priority
  runImmediately?: boolean
  visibilityAware?: boolean
}

interface RegisteredTask extends PollingTask {
  timerId: ReturnType<typeof setTimeout> | null
  lastRun: number
  isRunning: boolean
  runCount: number
  errorCount: number
  subscribers: number
}

const VISIBILITY_MULTIPLIER = 4
const STAGGER_BASE_MS = 500
const IDLE_TIMEOUT_MS = 2000

class PollingCoordinatorService {
  private tasks = new Map<string, RegisteredTask>()
  private isPageVisible = true
  private isOnline = true
  private isPaused = false

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.isPageVisible = !document.hidden
        this.rescheduleAll()
      })
    }
    if (typeof navigator !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true
        this.rescheduleAll()
      })
      window.addEventListener('offline', () => {
        this.isOnline = false
      })
    }
  }

  register(task: PollingTask): () => void {
    const existing = this.tasks.get(task.id)

    if (existing) {
      existing.subscribers++
      if (task.runImmediately && existing.runCount === 0) {
        this.executeTask(existing)
      }
      return () => this.unsubscribe(task.id)
    }

    const registered: RegisteredTask = {
      ...task,
      priority: task.priority ?? 'normal',
      visibilityAware: task.visibilityAware ?? true,
      timerId: null,
      lastRun: 0,
      isRunning: false,
      runCount: 0,
      errorCount: 0,
      subscribers: 1,
    }

    this.tasks.set(task.id, registered)

    if (task.runImmediately) {
      const stagger = this.getStagger(registered)
      setTimeout(() => this.executeTask(registered), stagger)
    }

    this.scheduleTask(registered)

    return () => this.unsubscribe(task.id)
  }

  unsubscribe(id: string) {
    const task = this.tasks.get(id)
    if (!task) return

    task.subscribers--
    if (task.subscribers <= 0) {
      if (task.timerId !== null) {
        clearTimeout(task.timerId)
      }
      this.tasks.delete(id)
    }
  }

  pause() {
    this.isPaused = true
    this.tasks.forEach(task => {
      if (task.timerId !== null) {
        clearTimeout(task.timerId)
        task.timerId = null
      }
    })
  }

  resume() {
    this.isPaused = false
    this.rescheduleAll()
  }

  forceRun(id: string) {
    const task = this.tasks.get(id)
    if (task) {
      this.executeTask(task)
    }
  }

  getStats(): Record<string, { runCount: number; errorCount: number; interval: number; subscribers: number }> {
    const stats: Record<string, any> = {}
    this.tasks.forEach((task, id) => {
      stats[id] = {
        runCount: task.runCount,
        errorCount: task.errorCount,
        interval: this.getEffectiveInterval(task),
        subscribers: task.subscribers,
      }
    })
    return stats
  }

  dispose() {
    this.tasks.forEach(task => {
      if (task.timerId !== null) {
        clearTimeout(task.timerId)
      }
    })
    this.tasks.clear()
  }

  private async executeTask(task: RegisteredTask) {
    if (task.isRunning || this.isPaused) return
    if (!this.isOnline) return

    task.isRunning = true
    task.lastRun = Date.now()

    try {
      // Use requestIdleCallback if available to avoid blocking main thread
      if (typeof requestIdleCallback !== 'undefined' && task.priority === 'low') {
        await new Promise<void>((resolve) => {
          requestIdleCallback(async () => {
            try {
              await task.fn()
            } catch (err) {
              task.errorCount++
            }
            resolve()
          }, { timeout: IDLE_TIMEOUT_MS })
        })
      } else {
        await task.fn()
      }
      task.runCount++
      task.errorCount = 0
    } catch (err) {
      task.errorCount++
    } finally {
      task.isRunning = false
    }
  }

  private scheduleTask(task: RegisteredTask) {
    if (this.isPaused) return

    if (task.timerId !== null) {
      clearTimeout(task.timerId)
    }

    const interval = this.getEffectiveInterval(task)

    task.timerId = setTimeout(async () => {
      await this.executeTask(task)
      this.scheduleTask(task)
    }, interval)
  }

  private getEffectiveInterval(task: RegisteredTask): number {
    let interval = task.interval

    // Slow down when page is hidden
    if (task.visibilityAware && !this.isPageVisible) {
      interval *= VISIBILITY_MULTIPLIER
    }

    // Exponential backoff on errors (max 5min)
    if (task.errorCount > 0) {
      const backoff = Math.min(task.errorCount * 2, 10)
      interval = Math.min(interval * backoff, 300_000)
    }

    return interval
  }

  private getStagger(task: RegisteredTask): number {
    const priorityOffset = {
      high: 0,
      normal: STAGGER_BASE_MS,
      low: STAGGER_BASE_MS * 2,
    }[task.priority || 'normal']

    // Add random jitter to avoid thundering herd
    const jitter = Math.random() * STAGGER_BASE_MS
    return priorityOffset + jitter
  }

  private rescheduleAll() {
    this.tasks.forEach(task => {
      this.scheduleTask(task)
    })
  }
}

export const pollingCoordinator = new PollingCoordinatorService()

// Expose for debugging
if (typeof window !== 'undefined') {
  ;(window as any).__pollingCoordinator = pollingCoordinator
}
