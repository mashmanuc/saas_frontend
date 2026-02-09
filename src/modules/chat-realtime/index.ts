/**
 * Chat Realtime Module
 *
 * PARALLEL REALTIME LAYER - Legacy-safe extension
 *
 * Architecture:
 *   ChatDomain (SSOT)
 *    ├── Legacy HttpPolling (chatStore.js) - FROZEN, DO NOT MODIFY
 *    └── Realtime Layer (this module) - NEW, OPTIONAL
 *
 * Principles:
 * - Zero changes to legacy chat code
 * - Feature flag controlled (explicit, no auto-detect)
 * - Automatic fallback to polling on WebSocket failure
 * - Adapter pattern for transport abstraction
 *
 * @module chat-realtime
 */

export { ChatTransportFactory, TransportType } from './factory'
export { useChatTransportV2 } from './composables/useChatTransportV2'
export type {
  ChatTransport,
  ChatMessage,
  TransportState,
  TransportConfig,
  TransportCallbacks,
  SendMessagePayload,
  EditMessagePayload,
  DeleteMessagePayload,
} from './types'
