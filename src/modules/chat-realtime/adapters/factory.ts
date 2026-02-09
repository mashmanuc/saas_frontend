/**
 * Chat Transport Factory
 *
 * Factory for creating appropriate transport adapter based on feature flags.
 *
 * Usage:
 *   const factory = new ChatTransportFactory({
 *     realtimeChatEnabled: true  // Feature flag
 *   })
 *   const transport = factory.createTransport(config)
 *
 * Rules:
 * - Default: HttpPollingAdapter (legacy-compatible)
 * - Flag=true: WebSocketAdapter with automatic fallback
 * - No auto-detect: Explicit flag only
 */
import { ref, type Ref } from 'vue'
import type {
  ChatTransport,
  TransportConfig,
  TransportState,
  TransportType,
  TransportCallbacks,
  RealtimeFeatureFlags,
} from '../types'
import { HttpPollingAdapter } from './http-polling.adapter'
import { WebSocketAdapter } from './websocket.adapter'

export type { TransportType } from '../types'

/**
 * Factory for creating transport adapters
 */
export class ChatTransportFactory {
  private flags: RealtimeFeatureFlags

  constructor(flags: RealtimeFeatureFlags) {
    this.flags = flags
  }

  /**
   * Create transport adapter based on feature flags
   *
   * Logic:
   * - If realtimeChatEnabled=false or undefined → HttpPollingAdapter
   * - If realtimeChatEnabled=true → WebSocketAdapter (with fallback capability)
   */
  createTransport(
    config: TransportConfig,
    callbacks?: TransportCallbacks
  ): ChatTransport {
    // Explicit feature flag check - NO auto-detect
    const useWebSocket = this.flags.realtimeChatEnabled === true

    if (useWebSocket) {
      // WebSocket with automatic fallback capability
      return new WebSocketAdapter(config, callbacks, {
        immediateFallback: this.flags.immediateFallback ?? false,
        wsUrl: this.flags.wsUrl,
        onFallback: () => {
          // Notify that fallback occurred
          console.log('[ChatTransportFactory] WebSocket failed, fallback to polling')
        }
      })
    }

    // Default: HTTP Polling (legacy-compatible, no WebSocket)
    return new HttpPollingAdapter(config, callbacks)
  }

  /**
   * Check if WebSocket is enabled
   */
  isWebSocketEnabled(): boolean {
    return this.flags.realtimeChatEnabled === true
  }

  /**
   * Update feature flags
   */
  updateFlags(flags: Partial<RealtimeFeatureFlags>): void {
    this.flags = { ...this.flags, ...flags }
  }
}

/**
 * Singleton factory instance (optional)
 * Use with feature flags from your config store
 */
let globalFactory: ChatTransportFactory | null = null

export function initChatTransportFactory(flags: RealtimeFeatureFlags): ChatTransportFactory {
  globalFactory = new ChatTransportFactory(flags)
  return globalFactory
}

export function getChatTransportFactory(): ChatTransportFactory | null {
  return globalFactory
}
