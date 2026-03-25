import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'

/**
 * Phase 34 B8: Long Press logic unit tests
 *
 * We test the long press logic in isolation (same algorithm used in WBCanvas)
 * since WBCanvas depends on Konva which is hard to mount in jsdom.
 */

const LONG_PRESS_MS = 500

describe('Long Press for Mobile Multi-Select', () => {
  let store: ReturnType<typeof useWBStore>
  let longPressTimer: ReturnType<typeof setTimeout> | null = null

  function handleTouchStart(itemId: string): void {
    longPressTimer = setTimeout(() => {
      store.toggleSelection(itemId)
      longPressTimer = null
    }, LONG_PRESS_MS)
  }

  function handleTouchEnd(): void {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  function handleTouchMove(): void {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    longPressTimer = null
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (longPressTimer) clearTimeout(longPressTimer)
    vi.useRealTimers()
  })

  it('triggers toggleSelection after 500ms long press', () => {
    const toggleSpy = vi.spyOn(store, 'toggleSelection')

    handleTouchStart('stroke-1')

    // Before 500ms — not called yet
    vi.advanceTimersByTime(499)
    expect(toggleSpy).not.toHaveBeenCalled()

    // At 500ms — called
    vi.advanceTimersByTime(1)
    expect(toggleSpy).toHaveBeenCalledWith('stroke-1')
  })

  it('cancels long press on touchmove', () => {
    const toggleSpy = vi.spyOn(store, 'toggleSelection')

    handleTouchStart('stroke-1')
    vi.advanceTimersByTime(200)

    // User moves finger — cancel
    handleTouchMove()

    vi.advanceTimersByTime(400)
    expect(toggleSpy).not.toHaveBeenCalled()
  })

  it('cancels long press on touchend before timeout', () => {
    const toggleSpy = vi.spyOn(store, 'toggleSelection')

    handleTouchStart('stroke-1')
    vi.advanceTimersByTime(300)

    // User lifts finger before 500ms — cancel
    handleTouchEnd()

    vi.advanceTimersByTime(300)
    expect(toggleSpy).not.toHaveBeenCalled()
  })
})
