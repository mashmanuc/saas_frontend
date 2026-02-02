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

const RESOURCE_ERROR_TAGS = new Set(['IMG', 'SCRIPT', 'LINK', 'VIDEO', 'AUDIO', 'SOURCE'])

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

type ResourceErrorContext = {
  tag: string
  url?: string
}

function getResourceErrorContext(event: Event): ResourceErrorContext | null {
  const target = event?.target as (EventTarget & {
    tagName?: string
    src?: string
    currentSrc?: string
    href?: string
  }) | null

  if (!target || !target.tagName) {
    return null
  }

  const tag = target.tagName.toUpperCase()
  if (!RESOURCE_ERROR_TAGS.has(tag)) {
    return null
  }

  const url = target.currentSrc || target.src || target.href
  return { tag, url }
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
      /giveFreely\.tsx/i,
      /Cannot read properties of undefined \(reading 'payload'\)/i,
      /Cannot read properties of undefined \(reading 'slice'\)/i,
      /Invalid prop: type check failed for prop/i,
      /Extraneous non-props attributes/i,
      /Extraneous non-emits event listeners/i,
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

      // Global error handler (capture to avoid being overwritten)
      window.addEventListener(
        'error',
        (event: Event) => {
          if (event instanceof ErrorEvent) {
            const msg = String(event.message || event.error?.message || event.error || 'Unknown error')
            if (shouldIgnore(msg, ignorePatterns)) {
              event.preventDefault?.()
              event.stopImmediatePropagation?.()
              return
            }
            handleError('error', msg, event.error?.stack || undefined, {
              source: event.filename,
              lineno: event.lineno,
              colno: event.colno,
            })
            return
          }

          // Handle resource loading errors (img/script/link/etc.) separately to avoid noisy "Unknown error" logs
          const resourceContext = getResourceErrorContext(event)
          if (resourceContext) {
            handleError('warning', `Resource load error (${resourceContext.tag})`, undefined, {
              resource_tag: resourceContext.tag,
              resource_url: resourceContext.url,
            })
          }
        },
        true
      )

      // Unhandled promise rejection (capture to avoid being overwritten)
      window.addEventListener(
        'unhandledrejection',
        (event: PromiseRejectionEvent) => {
          const error = event.reason
          const message = error?.message || String(error)
          if (shouldIgnore(message, ignorePatterns)) {
            event.preventDefault()
            ;(event as any).stopImmediatePropagation?.()
            return
          }
          handleError('error', `Unhandled Promise Rejection: ${message}`, error?.stack, {
            type: 'unhandledrejection',
          })
        },
        true
      )

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
