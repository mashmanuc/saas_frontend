// Diagnostics module exports
export { diagnosticsApi } from './api/diagnostics'
export { useDiagnostics } from './composables/useDiagnostics'
export { createErrorCollector, setCurrentRoute } from './plugins/errorCollector'
export type { ErrorCollector } from './plugins/errorCollector'
export { default as DiagnosticsPanel } from './components/DiagnosticsPanel.vue'
export { default as LogItem } from './components/LogItem.vue'
export type {
  FrontendErrorPayload,
  LogResponse,
  LocalLogEntry,
  DiagnosticsMode,
  ErrorCollectorOptions,
  RouteInfo,
} from './types'
