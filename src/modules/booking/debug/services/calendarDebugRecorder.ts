/**
 * Calendar Debug Recorder - Flight Recorder для API/WS активності
 * FE-55.DEBUG - Діагностичний модуль календаря v0.55
 */

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { ApiLogEntry, WebSocketLogEntry } from '../types/calendarDebug'

const MAX_LOGS = 100
const MAX_RESPONSE_PREVIEW_SIZE = 50 * 1024 // 50KB

export class CalendarDebugRecorder {
  private apiLogs: ApiLogEntry[] = []
  private wsLogs: WebSocketLogEntry[] = []
  private isActive = false
  private requestTimestamps = new Map<string, number>()

  constructor() {
    this.isActive = import.meta.env.VITE_CALENDAR_DEBUG === 'true'
  }

  /**
   * Підключити axios interceptors для логування
   */
  attachAxiosInterceptors(axiosInstance: AxiosInstance) {
    if (!this.isActive) return

    axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const requestId = this.generateRequestId()
        config.headers['X-Debug-Request-Id'] = requestId
        this.requestTimestamps.set(requestId, Date.now())
        return config
      },
      (error) => Promise.reject(error)
    )

    axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        this.recordApiResponse(response)
        return response
      },
      (error) => {
        this.recordApiError(error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Записати успішну відповідь API
   */
  private recordApiResponse(response: AxiosResponse) {
    if (!this.isActive) return
    if (!response || !response.config) return

    const requestId = response.config.headers?.['X-Debug-Request-Id'] as string
    const startTime = this.requestTimestamps.get(requestId) || Date.now()
    const durationMs = Date.now() - startTime

    const logEntry: ApiLogEntry = {
      id: requestId || this.generateRequestId(),
      at: new Date().toISOString(),
      method: response.config.method?.toUpperCase() || 'GET',
      url: response.config.url || '',
      params: response.config.params,
      status: response.status,
      durationMs,
      payloadSize: this.calculatePayloadSize(response.data),
      responsePreview: this.truncatePayload(response.data),
    }

    this.addApiLog(logEntry)
    if (requestId) {
      this.requestTimestamps.delete(requestId)
    }
  }

  /**
   * Записати помилку API
   */
  private recordApiError(error: any) {
    if (!this.isActive) return

    const requestId = error.config?.headers?.['X-Debug-Request-Id'] as string
    const startTime = this.requestTimestamps.get(requestId) || Date.now()
    const durationMs = Date.now() - startTime

    const logEntry: ApiLogEntry = {
      id: requestId || this.generateRequestId(),
      at: new Date().toISOString(),
      method: error.config?.method?.toUpperCase() || 'GET',
      url: error.config?.url || '',
      params: error.config?.params,
      status: error.response?.status || 0,
      durationMs,
      payloadSize: 0,
      error: error.message || 'Unknown error',
    }

    this.addApiLog(logEntry)
    if (requestId) {
      this.requestTimestamps.delete(requestId)
    }
  }

  /**
   * Записати WebSocket подію
   */
  recordWebSocketEvent(type: WebSocketLogEntry['type'], payload?: any, error?: string) {
    if (!this.isActive) return

    const logEntry: WebSocketLogEntry = {
      id: this.generateRequestId(),
      at: new Date().toISOString(),
      type,
      payload: this.truncatePayload(payload),
      error,
    }

    this.addWsLog(logEntry)
  }

  /**
   * Додати API лог з FIFO обмеженням
   */
  private addApiLog(entry: ApiLogEntry) {
    this.apiLogs.push(entry)
    if (this.apiLogs.length > MAX_LOGS) {
      this.apiLogs.shift()
    }
  }

  /**
   * Додати WS лог з FIFO обмеженням
   */
  private addWsLog(entry: WebSocketLogEntry) {
    this.wsLogs.push(entry)
    if (this.wsLogs.length > MAX_LOGS) {
      this.wsLogs.shift()
    }
  }

  /**
   * Отримати всі API логи
   */
  getApiLogs(): ApiLogEntry[] {
    return [...this.apiLogs]
  }

  /**
   * Отримати всі WS логи
   */
  getWsLogs(): WebSocketLogEntry[] {
    return [...this.wsLogs]
  }

  /**
   * Очистити всі логи
   */
  clearLogs() {
    this.apiLogs = []
    this.wsLogs = []
    this.requestTimestamps.clear()
  }

  /**
   * Обчислити розмір payload
   */
  private calculatePayloadSize(data: any): number {
    try {
      return JSON.stringify(data).length
    } catch {
      return 0
    }
  }

  /**
   * Обрізати payload до максимального розміру
   */
  private truncatePayload(data: any): any {
    if (!data) return data

    try {
      const jsonString = JSON.stringify(data)
      if (jsonString.length <= MAX_RESPONSE_PREVIEW_SIZE) {
        return data
      }

      return {
        __truncated: true,
        __originalSize: jsonString.length,
        __preview: jsonString.substring(0, MAX_RESPONSE_PREVIEW_SIZE),
      }
    } catch {
      return { __error: 'Failed to serialize payload' }
    }
  }

  /**
   * Маскувати чутливі дані (PII)
   */
  maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data

    const masked = { ...data }
    const sensitiveKeys = ['email', 'phone', 'password', 'token', 'apiKey']

    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        masked[key] = '***'
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key])
      }
    }

    return masked
  }

  /**
   * Генерувати унікальний ID запиту
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Перевірити, чи активний recorder
   */
  isRecording(): boolean {
    return this.isActive
  }
}

export const calendarDebugRecorder = new CalendarDebugRecorder()
