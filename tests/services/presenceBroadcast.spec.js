import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock BroadcastChannel
class MockBroadcastChannel {
  static instances = []
  constructor(name) {
    this.name = name
    this.onmessage = null
    this.closed = false
    this._posted = []
    MockBroadcastChannel.instances.push(this)
  }
  postMessage(msg) {
    this._posted.push(msg)
    // Deliver to all other instances with same name
    MockBroadcastChannel.instances.forEach((ch) => {
      if (ch !== this && ch.name === this.name && !ch.closed && ch.onmessage) {
        ch.onmessage({ data: msg })
      }
    })
  }
  close() {
    this.closed = true
  }
  static reset() {
    MockBroadcastChannel.instances = []
  }
}

describe('presenceBroadcast', () => {
  let presenceBroadcast

  beforeEach(async () => {
    MockBroadcastChannel.reset()
    globalThis.BroadcastChannel = MockBroadcastChannel
    vi.useFakeTimers()
    // Fresh import each time
    vi.resetModules()
    const mod = await import('../../src/services/presenceBroadcast.js')
    presenceBroadcast = mod.presenceBroadcast
  })

  afterEach(() => {
    presenceBroadcast.dispose()
    vi.useRealTimers()
    delete globalThis.BroadcastChannel
  })

  it('isSupported returns true when BroadcastChannel exists', () => {
    expect(presenceBroadcast.isSupported()).toBe(true)
  })

  it('init creates a tab and claims leadership', () => {
    presenceBroadcast.init({})
    expect(presenceBroadcast.getTabId()).toBeTruthy()
    expect(presenceBroadcast.isLeader()).toBe(true)
  })

  it('broadcastStatuses sends status_update message', () => {
    presenceBroadcast.init({})
    presenceBroadcast.broadcastStatuses({ '1': true, '2': false })

    const ch = MockBroadcastChannel.instances[0]
    const statusMsg = ch._posted.find((m) => m.type === 'status_update')
    expect(statusMsg).toBeTruthy()
    expect(statusMsg.statuses).toEqual({ '1': true, '2': false })
  })

  it('onStatusUpdate callback receives statuses from other tabs', async () => {
    const handler = vi.fn()

    // Tab 1
    presenceBroadcast.init({ onStatusUpdate: handler })
    const ch1 = MockBroadcastChannel.instances[0]

    // Simulate message from another tab
    ch1.onmessage({
      data: {
        type: 'status_update',
        tabId: 'other-tab',
        statuses: { '5': true },
      },
    })

    expect(handler).toHaveBeenCalledWith({ '5': true })
  })

  it('dispose cleans up and posts tab_close', () => {
    presenceBroadcast.init({})
    const ch = MockBroadcastChannel.instances[0]
    presenceBroadcast.dispose()

    const closeMsg = ch._posted.find((m) => m.type === 'tab_close')
    expect(closeMsg).toBeTruthy()
    expect(ch.closed).toBe(true)
  })

  it('leader sends heartbeat on interval', () => {
    presenceBroadcast.init({})
    const ch = MockBroadcastChannel.instances[0]

    vi.advanceTimersByTime(3000)

    const heartbeats = ch._posted.filter((m) => m.type === 'leader_heartbeat')
    expect(heartbeats.length).toBeGreaterThanOrEqual(1)
  })
})
