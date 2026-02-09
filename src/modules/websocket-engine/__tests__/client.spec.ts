/**
 * WebSocket Engine Client Tests
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketClient, createEngineClient } from '../client'

// Mock WebSocket for happy-dom (WebSocket not available in happy-dom)
const MockWebSocket = vi.fn() as any
MockWebSocket.CONNECTING = 0
MockWebSocket.OPEN = 1
MockWebSocket.CLOSING = 2
MockWebSocket.CLOSED = 3

// Create mock instance factory
MockWebSocket.mockImplementation(() => ({
  readyState: MockWebSocket.CONNECTING,
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
}))

Object.assign(global, { WebSocket: MockWebSocket })

describe('WebSocketClient', () => {
  let client: WebSocketClient

  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    client?.disconnect()
  })

  it('should create client with default configuration', () => {
    client = new WebSocketClient({
      roomId: 'test-room',
      token: 'test-token',
      onMessage: vi.fn(),
    })
    expect(client.roomId).toBe('test-room')
    expect(client.isConnected).toBe(false)
    expect(client.pendingCount).toBe(0)
  })

  it('should build correct WebSocket URL', () => {
    client = new WebSocketClient({
      roomId: 'test-room',
      token: 'test-token',
      onMessage: vi.fn(),
    })
    const url = (client as any).buildUrl()
    expect(url).toContain('/ws/room/test-room/')
    expect(url).toContain('token=test-token')
  })

  it('should queue messages when disconnected', () => {
    client = new WebSocketClient({
      roomId: 'test-room',
      token: 'test-token',
      onMessage: vi.fn(),
    })
    const sent = client.send({ type: 'test', data: 'hello' })
    expect(sent).toBe(false)
    expect(client.pendingCount).toBe(1)
  })

  it('should call onConnect callback', () => {
    const onConnect = vi.fn()
    const testClient = new WebSocketClient({
      roomId: 'test-room',
      token: 'test-token',
      onConnect,
      onMessage: vi.fn(),
    })
    ;(testClient as any).config.onConnect()
    expect(onConnect).toHaveBeenCalled()
    testClient.disconnect()
  })

  it('should suppress echo messages', () => {
    const onMessage = vi.fn()
    const testClient = new WebSocketClient({
      roomId: 'test-room',
      token: 'test-token',
      onMessage,
    })
    ;(testClient as any).handleMessage(JSON.stringify({
      type: 'system.connected',
      sender_channel: 'test-channel',
    }))
    ;(testClient as any).handleMessage(JSON.stringify({
      type: 'room.message',
      sender_channel: 'test-channel',
      payload: { data: 'echo' },
    }))
    expect(onMessage).not.toHaveBeenCalled()
    ;(testClient as any).handleMessage(JSON.stringify({
      type: 'room.message',
      sender_channel: 'other-channel',
      payload: { data: 'real' },
    }))
    expect(onMessage).toHaveBeenCalledWith({ data: 'real' })
  })

  it('should send heartbeat ping', () => {
    const sendSpy = vi.fn()
    const mockWs = { readyState: 1, send: sendSpy, close: vi.fn() }
    const testClient = new WebSocketClient({
      roomId: 'test-room',
      token: 'test-token',
      onMessage: vi.fn(),
    })
    ;(testClient as any).ws = mockWs
    ;(testClient as any).sendPing()
    expect(sendSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"ping"'))
  })

  it('should handle pong responses', () => {
    const testClient = new WebSocketClient({
      roomId: 'test-room',
      token: 'test-token',
      onMessage: vi.fn(),
    })
    expect(() => {
      ;(testClient as any).handleMessage(JSON.stringify({ type: 'pong', timestamp: 1234567890 }))
    }).not.toThrow()
  })

  it('should handle server errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const testClient = new WebSocketClient({ roomId: 'test-room', token: 'test-token', onMessage: vi.fn() })
    ;(testClient as any).handleMessage(JSON.stringify({ type: 'system.error', error: 'Test error', code: 'TEST_ERROR' }))
    expect(consoleSpy).toHaveBeenCalledWith('[WebSocketEngine] Server error:', 'Test error', 'TEST_ERROR')
    consoleSpy.mockRestore()
  })

  it('should schedule reconnect', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const testClient = new WebSocketClient({
      roomId: 'test-room',
      token: 'test-token',
      onDisconnect: vi.fn(),
      maxReconnectAttempts: 3,
      onMessage: vi.fn(),
    })
    ;(testClient as any).scheduleReconnect()
    expect((testClient as any).reconnectAttempts).toBe(0)
    vi.advanceTimersByTime(1000)
    expect((testClient as any).reconnectAttempts).toBe(1)
    vi.useRealTimers()
    testClient.disconnect()
  })

  it('should not reconnect after intentional disconnect', () => {
    const testClient = new WebSocketClient({ roomId: 'test-room', token: 'test-token', onMessage: vi.fn() })
    testClient.disconnect(1000, 'User logout')
    expect((testClient as any).reconnectTimer).toBeNull()
  })

  it('should flush pending messages', () => {
    const sendSpy = vi.fn()
    const mockWs = { readyState: 1, send: sendSpy, close: vi.fn() }
    const testClient = new WebSocketClient({ roomId: 'test-room', token: 'test-token', onMessage: vi.fn() })
    testClient.send({ type: 'msg1' })
    testClient.send({ type: 'msg2' })
    expect(testClient.pendingCount).toBe(2)
    ;(testClient as any).ws = mockWs
    ;(testClient as any).flushPendingMessages()
    expect(sendSpy).toHaveBeenCalledTimes(2)
    expect(testClient.pendingCount).toBe(0)
  })

  it('should track connection state', () => {
    const testClient = new WebSocketClient({ roomId: 'test-room', token: 'test-token', onMessage: vi.fn() })
    expect(testClient.isConnected).toBe(false)
    ;(testClient as any).ws = { readyState: 1 }
    expect(testClient.isConnected).toBe(true)
  })
})

describe('createEngineClient', () => {
  it('should create configured client', () => {
    const onMessage = vi.fn()
    const client = createEngineClient('room-123', 'token-abc', onMessage)
    expect(client).toBeInstanceOf(WebSocketClient)
    expect(client.roomId).toBe('room-123')
  })
})
