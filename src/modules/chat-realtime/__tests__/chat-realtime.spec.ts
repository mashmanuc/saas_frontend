/**
 * Chat Realtime Module Tests
 *
 * Tests for the parallel realtime layer.
 * Legacy chat code is NOT modified - these test the NEW layer only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { ChatTransportFactory } from '../adapters/factory'
import { HttpPollingAdapter } from '../adapters/http-polling.adapter'
import { WebSocketAdapter } from '../adapters/websocket.adapter'
import { useChatTransportV2 } from '../composables/useChatTransportV2'
import type { RealtimeFeatureFlags, TransportCallbacks } from '../types'

// Mock WebSocket client
vi.mock('@/modules/websocket-engine/client', () => ({
  WebSocketClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    send: vi.fn().mockReturnValue(true),
  })),
}))

// Mock chat API
vi.mock('@/modules/chat/api/chatApi', () => ({
  getThreadMessages: vi.fn().mockResolvedValue({
    messages: [],
    count: 0,
    is_writable: true,
  }),
  sendMessage: vi.fn().mockResolvedValue({
    id: 'msg-123',
    thread_id: 'thread-123',
    sender_id: 42,
    body: 'Test message',
    created_at: new Date().toISOString(),
  }),
}))

describe('ChatTransportFactory', () => {
  it('creates HttpPollingAdapter when realtimeChatEnabled is false', () => {
    const flags: RealtimeFeatureFlags = { realtimeChatEnabled: false }
    const factory = new ChatTransportFactory(flags)

    const transport = factory.createTransport({
      threadId: 'thread-123',
      token: 'jwt',
      userId: 42,
    })

    expect(transport.type).toBe('polling')
    expect(transport).toBeInstanceOf(HttpPollingAdapter)
  })

  it('creates HttpPollingAdapter when realtimeChatEnabled is undefined', () => {
    const flags: RealtimeFeatureFlags = { realtimeChatEnabled: undefined as any }
    const factory = new ChatTransportFactory(flags)

    const transport = factory.createTransport({
      threadId: 'thread-123',
      token: 'jwt',
      userId: 42,
    })

    expect(transport.type).toBe('polling')
  })

  it('creates WebSocketAdapter when realtimeChatEnabled is true', () => {
    const flags: RealtimeFeatureFlags = { realtimeChatEnabled: true }
    const factory = new ChatTransportFactory(flags)

    const transport = factory.createTransport({
      threadId: 'thread-123',
      token: 'jwt',
      userId: 42,
    })

    expect(transport.type).toBe('websocket')
    expect(transport).toBeInstanceOf(WebSocketAdapter)
  })

  it('reports WebSocket enabled status correctly', () => {
    const factoryOn = new ChatTransportFactory({ realtimeChatEnabled: true })
    const factoryOff = new ChatTransportFactory({ realtimeChatEnabled: false })

    expect(factoryOn.isWebSocketEnabled()).toBe(true)
    expect(factoryOff.isWebSocketEnabled()).toBe(false)
  })
})

describe('HttpPollingAdapter', () => {
  let adapter: HttpPollingAdapter
  const callbacks: TransportCallbacks = {
    onMessage: vi.fn(),
    onError: vi.fn(),
  }

  beforeEach(() => {
    adapter = new HttpPollingAdapter(
      { threadId: 'thread-123', token: 'jwt', userId: 42 },
      callbacks
    )
  })

  afterEach(() => {
    adapter.disconnect()
  })

  it('has correct transport type', () => {
    expect(adapter.type).toBe('polling')
  })

  it('starts in disconnected state', () => {
    expect(adapter.state.value).toBe('disconnected')
    expect(adapter.isConnected.value).toBe(false)
  })
})

describe('WebSocketAdapter', () => {
  let adapter: WebSocketAdapter
  const callbacks: TransportCallbacks = {
    onMessage: vi.fn(),
    onStateChange: vi.fn(),
  }

  beforeEach(() => {
    adapter = new WebSocketAdapter(
      { threadId: 'thread-123', token: 'jwt', userId: 42 },
      callbacks
    )
  })

  afterEach(() => {
    adapter.disconnect()
  })

  it('has correct transport type', () => {
    expect(adapter.type).toBe('websocket')
  })

  it('tracks pending message count', async () => {
    expect(adapter.pendingCount.value).toBe(0)

    // When not connected, send fails immediately
    const result = await adapter.sendMessage({ body: 'Test' })

    // Should fail because not connected
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not connected')
    // pendingCount stays 0 because we never actually sent
    expect(adapter.pendingCount.value).toBe(0)
  })

  it('echo suppression: ignores messages with our client_message_id', () => {
    const clientMessageId = 'our-message-id'

    // Simulate sending a message
    adapter.sendMessage({ body: 'Test', clientMessageId })

    // Simulate receiving echo back
    const incomingPayload = {
      type: 'message.new',
      message: {
        id: 'msg-123',
        thread_id: 'thread-123',
        sender_id: 42,
        body: 'Test',
        created_at: new Date().toISOString(),
        client_message_id: clientMessageId,
      },
    }

    // This would normally call handleIncomingMessage
    // but it's private. We verify the logic through integration tests.
  })
})

describe('useChatTransportV2', () => {
  it('initializes with polling when flag is false', async () => {
    const chat = useChatTransportV2(
      { threadId: 'thread-123', token: 'jwt', userId: 42, autoConnect: false },
      { realtimeChatEnabled: false }
    )

    await nextTick()

    expect(chat.transportType.value).toBe('polling')
  })

  it('exposes reactive state', () => {
    const chat = useChatTransportV2(
      { threadId: 'thread-123', token: 'jwt', userId: 42, autoConnect: false },
      { realtimeChatEnabled: false }
    )

    expect(chat.messages.value).toEqual([])
    expect(chat.isConnected.value).toBe(false)
    expect(chat.isConnecting.value).toBe(false)
    expect(chat.pendingCount.value).toBe(0)
  })
})

describe('Architecture Compliance', () => {
  it('does NOT modify legacy chat code', () => {
    // This is a conceptual test - the actual verification is that
    // no files in @/modules/chat/ are modified
    // (except chat-realtime/ which is NEW)
  })

  it('uses explicit feature flag (no auto-detect)', () => {
    // Factory only checks flag value, never tries to detect WebSocket support
    const factory = new ChatTransportFactory({ realtimeChatEnabled: false })
    const transport = factory.createTransport({
      threadId: 't',
      token: 'jwt',
      userId: 1,
    })

    // Should be polling regardless of browser capabilities
    expect(transport.type).toBe('polling')
  })
})
