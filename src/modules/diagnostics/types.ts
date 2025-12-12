// Diagnostics module type definitions

export interface FrontendErrorPayload {
  severity: 'info' | 'warning' | 'error'
  message: string
  stack?: string
  url: string
  userId?: number
  sessionId?: string
  browser?: string
  platform?: string
  appVersion: string
  context?: Record<string, unknown>
}

export interface LogResponse {
  status: 'ok'
  id?: number
  count?: number
}

export interface LocalLogEntry {
  id: number
  timestamp: number
  severity: 'info' | 'warning' | 'error'
  message: string
  stack?: string
  context?: Record<string, unknown>
}

export type DiagnosticsMode = 'silent' | 'console' | 'console+remote'

export interface ErrorCollectorOptions {
  mode?: DiagnosticsMode
  appVersion?: string
  ignorePatterns?: RegExp[]
}

export interface RouteInfo {
  name?: string
  path?: string
  params?: Record<string, string>
  query?: Record<string, string>
}
