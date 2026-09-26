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

// Порядок важливий: Edge, Opera, Samsung і Яндекс теж пишуть «Chrome/», а Chrome — «Safari/».
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(?:A|iOS)?\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/YaBrowser\/(\d+)/, 'Yandex'],
  [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
  [/CriOS\/(\d+)/, 'Chrome'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+).*Safari/, 'Safari'],
]

export function getBrowserInfo(ua: string = navigator.userAgent): string {
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re)
    if (m) return `${name} ${m[1]}`
  }
  return ua.slice(0, 50)
}

function isIPadOnMacUA(ua: string, touchPoints: number): boolean {
  // iPadOS 13+ представляється як «Macintosh»; видає його лише сенсорний екран.
  return /Macintosh/.test(ua) && touchPoints > 1
}

/**
 * ОС за user-agent. До 2026-09-26 першим перевірявся `navigator.platform`, а на
 * Android він «Linux armv8l» — усі телефони Android записувались як «Linux»,
 * а iPad — як «macOS». Тепер спершу мобільні системи з UA.
 */
export function getPlatform(
  ua: string = navigator.userAgent,
  platform: string = navigator.platform || '',
  touchPoints: number = navigator.maxTouchPoints || 0,
): string {
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPod/i.test(ua)) return 'iOS'
  if (/iPad/i.test(ua) || isIPadOnMacUA(ua, touchPoints)) return 'iPadOS'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (platform.includes('Win') || /Windows/.test(ua)) return 'Windows'
  if (platform.includes('Mac') || /Macintosh/.test(ua)) return 'macOS'
  if (platform.includes('Linux') || /Linux/.test(ua)) return 'Linux'
  return platform
}

/** Тип пристрою тими ж словами, що й бекенд (`apps/diagnostics/device_info.py`). */
export function getDeviceKind(
  ua: string = navigator.userAgent,
  touchPoints: number = navigator.maxTouchPoints || 0,
): 'phone' | 'tablet' | 'computer' {
  if (/iPad/i.test(ua) || isIPadOnMacUA(ua, touchPoints)) return 'tablet'
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'phone' : 'tablet'
  if (/iPhone|iPod|Mobi/i.test(ua)) return 'phone'
  return 'computer'
}

function getClientContext(): Record<string, unknown> {
  try {
    return {
      // Сирий UA — бекенд розбирає його тим самим парсером, що й сесії входу: рукописний
      // розбір вище не бачить WebView Telegram/Instagram, а саме звідти прийде реклама.
      ua: navigator.userAgent.slice(0, 400),
      kind: getDeviceKind(),
      screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio || 1,
      touch: navigator.maxTouchPoints || 0,
    }
  } catch {
    return {}
  }
}

let lastImmediateFlush = 0

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
    app_version: getAppVersion(),
    browser: getBrowserInfo(),
    platform: getPlatform(),
    context: {
      route: currentRouteInfo,
      // Пристрій і екран: без них staff не відрізнить «зламалось на телефоні» від «на ПК».
      client: getClientContext(),
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
      // Помилку — одразу, не чекаючи 5-секундного таймера: після краху людина тисне
      // «Онови сторінку» за секунду-дві, а відправка при закритті сторінки
      // (sendBeacon) іде на m4sh.org без бекенду — звіт губився (рев'ю 2026-09-26).
      // Не частіше разу на секунду, щоб шквал помилок не став шквалом запитів.
      if (severity === 'error' && Date.now() - lastImmediateFlush > 1000) {
        lastImmediateFlush = Date.now()
        void diagnosticsApi.flush?.()
      }
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
        // `<script setup>` (переважна більшість компонентів) не має `name` — лише `__name`.
        const options = instance?.$options as { name?: string; __name?: string } | undefined
        const componentName = options?.name || options?.__name || 'Unknown'

        // Surface the REAL error (message + own stack + clickable source) to console.
        // handleError() below logs only meta {vue_component, vue_info}, which hid the
        // actual cause in production. Logging the raw `err` makes it diagnosable.
        console.error(
          '[Diagnostics] Vue error →', err,
          '| info:', info, '| component:', componentName,
        )

        handleError('error', error?.message || String(err), error?.stack, {
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
