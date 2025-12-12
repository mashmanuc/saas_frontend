/**
 * Vue plugin for collecting and reporting errors.
 *
 * Features:
 * - Vue error handler (component errors)
 * - window.onerror (global JS errors)
 * - window.onunhandledrejection (Promise rejections)
 */
import type { App, ComponentPublicInstance } from 'vue'
import { diagnosticsApi } from '../api/diagnostics'
import { useDiagnostics } from '../composables/useDiagnostics'
import type {
  DiagnosticsMode,
  ErrorCollectorOptions,
  FrontendErrorPayload,
  RouteInfo,
} from '../types'

// Current route info (updated by router)
let currentRouteInfo: RouteInfo = {}

export function setCurrentRoute(info: RouteInfo): void {
  currentRouteInfo = info
}

function getAppVersion(): string {
  return (import.meta.env.VITE_APP_VERSION as string) || 'unknown'
}

function getBrowserInfo(): string {
  const ua = navigator.userAgent
  if (ua.includes('Chrome')) return `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1]}`
  if (ua.includes('Firefox')) return `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1]}`
  if (ua.includes('Safari')) return `Safari ${ua.match(/Version\/(\d+)/)?.[1]}`
  return ua.slice(0, 50)
}

function getPlatform(): string {
  const platform = navigator.platform || ''
  if (platform.includes('Win')) return 'Windows'
  if (platform.includes('Mac')) return 'macOS'
  if (platform.includes('Linux')) return 'Linux'
  if (/Android/i.test(navigator.userAgent)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'iOS'
  return platform
}

function shouldIgnore(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message))
}

function createPayload(
  severity: 'info' | 'warning' | 'error',
  message: string,
  stack?: string,
  extraContext?: Record<string, unknown>
): FrontendErrorPayload {
  return {
    severity,
    message,
    stack,
    url: window.location.href,
    appVersion: getAppVersion(),
    browser: getBrowserInfo(),
    platform: getPlatform(),
    context: {
      route: currentRouteInfo,
      ...extraContext,
    },
  }
}

export function createErrorCollector(options: ErrorCollectorOptions = {}) {
  const {
    mode = (import.meta.env.DEV ? 'console+remote' : 'console+remote') as DiagnosticsMode,
    ignorePatterns = [
      /ResizeObserver loop/i,
      /Loading chunk/i,
      /Network Error/i,
    ],
  } = options

  const { addLocalLog } = useDiagnostics()

  function handleError(
    severity: 'info' | 'warning' | 'error',
    message: string,
    stack?: string,
    context?: Record<string, unknown>
  ): void {
    // Check ignore patterns
    if (shouldIgnore(message, ignorePatterns)) return

    const payload = createPayload(severity, message, stack, context)

    // Console logging
    if (mode === 'console' || mode === 'console+remote') {
      if (severity === 'error') {
        console.error('[Diagnostics]', message, context)
      } else if (severity === 'warning') {
        console.warn('[Diagnostics]', message, context)
      } else {
        console.info('[Diagnostics]', message, context)
      }
    }

    // Add to local buffer (for dev panel)
    if (import.meta.env.DEV) {
      addLocalLog({
        timestamp: Date.now(),
        severity,
        message,
        stack,
        context,
      })
    }

    // Send to backend
    if (mode === 'console+remote') {
      diagnosticsApi.queueError(payload)
    }
  }

  return {
    install(app: App): void {
      // Vue error handler
      app.config.errorHandler = (
        err: unknown,
        instance: ComponentPublicInstance | null,
        info: string
      ) => {
        const error = err as Error
        const componentName = instance?.$options?.name || 'Unknown'

        handleError('error', error.message || String(err), error.stack, {
          vue_component: componentName,
          vue_info: info,
          vue_version: app.version,
        })
      }

      // Vue warning handler (dev only)
      if (import.meta.env.DEV) {
        app.config.warnHandler = (msg, instance, trace) => {
          const componentName = instance?.$options?.name || 'Unknown'

          handleError('warning', msg, trace, {
            vue_component: componentName,
            vue_version: app.version,
          })
        }
      }

      // Global error handler
      window.onerror = (message, source, lineno, colno, error) => {
        handleError(
          'error',
          String(message),
          error?.stack || `at ${source}:${lineno}:${colno}`,
          {
            source,
            lineno,
            colno,
          }
        )
        return false // Don't prevent default handling
      }

      // Unhandled promise rejection
      window.onunhandledrejection = (event: PromiseRejectionEvent) => {
        const error = event.reason
        const message = error?.message || String(error)

        handleError(
          'error',
          `Unhandled Promise Rejection: ${message}`,
          error?.stack,
          {
            type: 'unhandledrejection',
          }
        )
      }

      // Expose for manual logging
      app.config.globalProperties.$diagnostics = {
        log: (message: string, context?: Record<string, unknown>) =>
          handleError('info', message, undefined, context),
        warn: (message: string, context?: Record<string, unknown>) =>
          handleError('warning', message, undefined, context),
        error: (message: string, stack?: string, context?: Record<string, unknown>) =>
          handleError('error', message, stack, context),
      }
    },

    // Export for direct use
    handleError,
  }
}

export type ErrorCollector = ReturnType<typeof createErrorCollector>
