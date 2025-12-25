/**
 * WebSocket Reconnection Manager
 * Керує повторними підключеннями з експонентним бекофом та метриками
 */

export interface ReconnectConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export interface ConnectionMetrics {
  totalDisconnects: number
  totalReconnects: number
  currentDisconnectDuration: number
  longestDisconnectDuration: number
  lastDisconnectTime: number | null
  lastReconnectTime: number | null
}

export class WebSocketReconnectManager {
  private retryCount = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private disconnectStartTime: number | null = null
  private metricsUpdateTimer: NodeJS.Timeout | null = null

  public metrics: ConnectionMetrics = {
    totalDisconnects: 0,
    totalReconnects: 0,
    currentDisconnectDuration: 0,
    longestDisconnectDuration: 0,
    lastDisconnectTime: null,
    lastReconnectTime: null,
  }

  constructor(
    private config: ReconnectConfig = {
      maxRetries: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
    },
    private onReconnect: () => Promise<void>,
    private onMetricsUpdate?: (metrics: ConnectionMetrics) => void
  ) {}

  /**
   * Розпочати процес повторного підключення
   */
  startReconnect(): void {
    if (this.reconnectTimer) {
      return // Already reconnecting
    }

    if (this.retryCount >= this.config.maxRetries) {
      console.error('[WS Reconnect] Max retries reached')
      this.notifyLongDisconnect()
      return
    }

    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, this.retryCount),
      this.config.maxDelay
    )

    console.log(`[WS Reconnect] Attempting reconnect in ${delay}ms (attempt ${this.retryCount + 1}/${this.config.maxRetries})`)

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      this.retryCount++

      try {
        await this.onReconnect()
        this.onReconnectSuccess()
      } catch (error) {
        console.error('[WS Reconnect] Failed:', error)
        this.startReconnect() // Try again
      }
    }, delay)
  }

  /**
   * Зупинити процес повторного підключення
   */
  stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.metricsUpdateTimer) {
      clearInterval(this.metricsUpdateTimer)
      this.metricsUpdateTimer = null
    }
  }

  /**
   * Обробити відключення
   */
  onDisconnect(): void {
    this.metrics.totalDisconnects++
    this.metrics.lastDisconnectTime = Date.now()
    this.disconnectStartTime = Date.now()

    // Start metrics update timer
    this.metricsUpdateTimer = setInterval(() => {
      this.updateDisconnectDuration()
    }, 1000)

    this.startReconnect()
  }

  /**
   * Обробити успішне підключення
   */
  onConnect(): void {
    this.retryCount = 0
    this.stopReconnect()

    if (this.disconnectStartTime) {
      const disconnectDuration = Date.now() - this.disconnectStartTime
      this.metrics.longestDisconnectDuration = Math.max(
        this.metrics.longestDisconnectDuration,
        disconnectDuration
      )
      this.disconnectStartTime = null
      this.metrics.currentDisconnectDuration = 0
    }
  }

  /**
   * Успішне повторне підключення
   */
  private onReconnectSuccess(): void {
    this.metrics.totalReconnects++
    this.metrics.lastReconnectTime = Date.now()
    this.onConnect()
    console.log('[WS Reconnect] Successfully reconnected')
  }

  /**
   * Оновити тривалість відключення
   */
  private updateDisconnectDuration(): void {
    if (this.disconnectStartTime) {
      this.metrics.currentDisconnectDuration = Date.now() - this.disconnectStartTime

      // Notify if disconnected > 10 seconds
      if (this.metrics.currentDisconnectDuration > 10000 && this.onMetricsUpdate) {
        this.onMetricsUpdate(this.metrics)
      }
    }
  }

  /**
   * Повідомити про довге відключення
   */
  private notifyLongDisconnect(): void {
    console.error('[WS Reconnect] Long disconnect detected', {
      duration: this.metrics.currentDisconnectDuration,
      totalDisconnects: this.metrics.totalDisconnects,
    })

    if (this.onMetricsUpdate) {
      this.onMetricsUpdate(this.metrics)
    }

    // Show user notification
    if (typeof window !== 'undefined' && (window as any).toast) {
      (window as any).toast.error('Втрачено зв\'язок з сервером. Спробуйте перезавантажити сторінку.')
    }
  }

  /**
   * Отримати поточні метрики
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics }
  }

  /**
   * Скинути метрики
   */
  resetMetrics(): void {
    this.metrics = {
      totalDisconnects: 0,
      totalReconnects: 0,
      currentDisconnectDuration: 0,
      longestDisconnectDuration: 0,
      lastDisconnectTime: null,
      lastReconnectTime: null,
    }
  }
}
