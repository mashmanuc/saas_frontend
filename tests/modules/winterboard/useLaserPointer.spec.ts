// WB5: Unit tests for useLaserPointer composable
// Ref: TASK_BOARD_V5.md A4

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useLaserPointer, createThrottle } from '@/modules/winterboard/composables/useLaserPointer'

// ─── Helper: run composable outside Vue component (no onUnmounted) ──────────

// We mock onUnmounted to avoid Vue warnings in test environment
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...(actual as Record<string, unknown>),
    onUnmounted: vi.fn(),
  }
})

// ─── useLaserPointer tests ──────────────────────────────────────────────────

describe('useLaserPointer', () => {
  let broadcastCalls: Array<{ x: number; y: number; active: boolean; page_id?: string }>

  beforeEach(() => {
    broadcastCalls = []
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createLaser(pageId = 'page-1') {
    return useLaserPointer({
      onBroadcast: (data) => broadcastCalls.push(data),
      getPageId: () => pageId,
    })
  }

  // ── Local laser ──────────────────────────────────────────────────────────

  it('startLaser sets isActive=true and localPosition', () => {
    const laser = createLaser()

    expect(laser.isActive.value).toBe(false)
    expect(laser.localPosition.value).toBeNull()

    laser.startLaser(100, 200)

    expect(laser.isActive.value).toBe(true)
    expect(laser.localPosition.value).toEqual({ x: 100, y: 200 })
  })

  it('startLaser broadcasts immediately', () => {
    const laser = createLaser()
    laser.startLaser(50, 75)

    expect(broadcastCalls).toHaveLength(1)
    expect(broadcastCalls[0]).toEqual({ x: 50, y: 75, active: true, page_id: 'page-1' })
  })

  it('moveLaser updates localPosition', () => {
    const laser = createLaser()
    laser.startLaser(10, 20)
    laser.moveLaser(30, 40)

    expect(laser.localPosition.value).toEqual({ x: 30, y: 40 })
  })

  it('moveLaser does nothing when not active', () => {
    const laser = createLaser()
    laser.moveLaser(30, 40)

    expect(laser.localPosition.value).toBeNull()
    // Only no broadcast (startLaser was not called)
    expect(broadcastCalls).toHaveLength(0)
  })

  it('stopLaser sets isActive=false and localPosition=null', () => {
    const laser = createLaser()
    laser.startLaser(10, 20)
    expect(laser.isActive.value).toBe(true)

    laser.stopLaser()

    expect(laser.isActive.value).toBe(false)
    expect(laser.localPosition.value).toBeNull()
  })

  it('stopLaser broadcasts active=false', () => {
    const laser = createLaser()
    laser.startLaser(10, 20)
    broadcastCalls.length = 0 // clear start broadcast

    laser.stopLaser()

    expect(broadcastCalls).toHaveLength(1)
    expect(broadcastCalls[0].active).toBe(false)
  })

  it('stopLaser is noop when not active', () => {
    const laser = createLaser()
    laser.stopLaser()

    expect(broadcastCalls).toHaveLength(0)
  })

  // ── Remote lasers ────────────────────────────────────────────────────────

  it('updateRemoteLaser active=true adds to remoteLasers', () => {
    const laser = createLaser()

    laser.updateRemoteLaser({
      userId: 'user-1',
      displayName: 'Teacher',
      x: 100,
      y: 200,
      pageId: 'page-1',
      color: '#dc2626',
      active: true,
      lastUpdate: 0,
    })

    expect(laser.remoteLasers.value.size).toBe(1)
    expect(laser.remoteLasers.value.get('user-1')?.displayName).toBe('Teacher')
  })

  it('updateRemoteLaser active=false removes from remoteLasers', () => {
    const laser = createLaser()

    laser.updateRemoteLaser({
      userId: 'user-1',
      displayName: 'Teacher',
      x: 100,
      y: 200,
      pageId: 'page-1',
      color: '#dc2626',
      active: true,
      lastUpdate: 0,
    })
    expect(laser.remoteLasers.value.size).toBe(1)

    laser.updateRemoteLaser({
      userId: 'user-1',
      displayName: 'Teacher',
      x: 0,
      y: 0,
      pageId: 'page-1',
      color: '#dc2626',
      active: false,
      lastUpdate: 0,
    })
    expect(laser.remoteLasers.value.size).toBe(0)
  })

  it('removeRemoteLaser removes specific user', () => {
    const laser = createLaser()

    laser.updateRemoteLaser({
      userId: 'user-1',
      displayName: 'Teacher',
      x: 100,
      y: 200,
      pageId: 'page-1',
      color: '#dc2626',
      active: true,
      lastUpdate: 0,
    })
    laser.updateRemoteLaser({
      userId: 'user-2',
      displayName: 'Student',
      x: 300,
      y: 400,
      pageId: 'page-1',
      color: '#2563eb',
      active: true,
      lastUpdate: 0,
    })
    expect(laser.remoteLasers.value.size).toBe(2)

    laser.removeRemoteLaser('user-1')
    expect(laser.remoteLasers.value.size).toBe(1)
    expect(laser.remoteLasers.value.has('user-2')).toBe(true)
  })

  it('activeRemoteLasers computed returns array', () => {
    const laser = createLaser()

    expect(laser.activeRemoteLasers.value).toEqual([])

    laser.updateRemoteLaser({
      userId: 'user-1',
      displayName: 'Teacher',
      x: 100,
      y: 200,
      pageId: 'page-1',
      color: '#dc2626',
      active: true,
      lastUpdate: 0,
    })

    expect(laser.activeRemoteLasers.value).toHaveLength(1)
    expect(laser.activeRemoteLasers.value[0].userId).toBe('user-1')
  })

  // ── Auto-fade ────────────────────────────────────────────────────────────

  it('auto-fade removes stale remote lasers after 3s', () => {
    const laser = createLaser()

    // Add a remote laser with old timestamp
    laser.updateRemoteLaser({
      userId: 'stale-user',
      displayName: 'Stale',
      x: 10,
      y: 20,
      pageId: 'page-1',
      color: '#000',
      active: true,
      lastUpdate: 0,
    })
    // Manually set lastUpdate to be old
    const entry = laser.remoteLasers.value.get('stale-user')
    if (entry) entry.lastUpdate = Date.now() - 4000 // 4s ago

    expect(laser.remoteLasers.value.size).toBe(1)

    // Advance time to trigger fade check (interval = 1000ms)
    vi.advanceTimersByTime(1100)

    expect(laser.remoteLasers.value.size).toBe(0)
  })

  // ── Multiple remote lasers ───────────────────────────────────────────────

  it('handles multiple remote lasers simultaneously', () => {
    const laser = createLaser()

    for (let i = 0; i < 5; i++) {
      laser.updateRemoteLaser({
        userId: `user-${i}`,
        displayName: `User ${i}`,
        x: i * 100,
        y: i * 50,
        pageId: 'page-1',
        color: `#${i}${i}${i}`,
        active: true,
        lastUpdate: 0,
      })
    }

    expect(laser.remoteLasers.value.size).toBe(5)
    expect(laser.activeRemoteLasers.value).toHaveLength(5)
  })
})

// ─── createThrottle tests ───────────────────────────────────────────────────

describe('createThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls function immediately on first call', () => {
    const fn = vi.fn()
    const throttled = createThrottle(fn, 33)

    throttled(1, 2, 3)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throttles subsequent calls within interval', () => {
    const fn = vi.fn()
    const throttled = createThrottle(fn, 33)

    throttled(1)
    throttled(2) // should be dropped
    throttled(3) // should be dropped

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('allows call after throttle interval passes', () => {
    const fn = vi.fn()
    const throttled = createThrottle(fn, 33)

    throttled(1)
    expect(fn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(34)
    throttled(2)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
