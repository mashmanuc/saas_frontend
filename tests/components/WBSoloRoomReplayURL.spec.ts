/**
 * [P17-A3.2] Unit tests — WBSoloRoom Replay URL State
 * Ref: DAY3_AGENT_A.md A3.2
 *
 * Tests:
 * 1. Starts in edit mode by default (no query params)
 * 2. Starts in replay mode when ?mode=replay
 * 3. Updates URL when entering replay mode
 * 4. Removes mode param when exiting replay
 */

import { describe, it, expect, vi } from 'vitest'
import { ref, computed, reactive } from 'vue'

// We test the URL-synced computed logic directly rather than mounting
// the full WBSoloRoom (which has many heavy deps).

function createModeComputed(initialQuery: Record<string, string> = {}) {
  const query = reactive<Record<string, string>>({ ...initialQuery })
  const replaceCalls: Array<{ query: Record<string, string> }> = []

  const route = { query }
  const router = {
    replace: (opts: { query: Record<string, string> }) => {
      replaceCalls.push(opts)
      // Simulate Vue Router updating the route query
      Object.keys(query).forEach(k => delete query[k])
      Object.assign(query, opts.query)
    },
  }

  const mode = computed<'edit' | 'replay'>({
    get: () => (route.query.mode === 'replay' ? 'replay' : 'edit'),
    set: (value: 'edit' | 'replay') => {
      const q = { ...route.query }
      if (value === 'replay') {
        q.mode = 'replay'
      } else {
        delete q.mode
      }
      router.replace({ query: q })
    },
  })

  function enterReplayMode(): void {
    mode.value = 'replay'
  }

  function exitReplayMode(): void {
    mode.value = 'edit'
  }

  return { mode, route, router, replaceCalls, enterReplayMode, exitReplayMode }
}

describe('WBSoloRoom — Replay URL State', () => {
  it('starts in edit mode by default', () => {
    const { mode } = createModeComputed()
    expect(mode.value).toBe('edit')
  })

  it('starts in replay mode when ?mode=replay', () => {
    const { mode } = createModeComputed({ mode: 'replay' })
    expect(mode.value).toBe('replay')
  })

  it('updates URL when entering replay mode', () => {
    const { mode, replaceCalls, enterReplayMode } = createModeComputed()
    expect(mode.value).toBe('edit')

    enterReplayMode()

    expect(replaceCalls).toHaveLength(1)
    expect(replaceCalls[0].query.mode).toBe('replay')
    expect(mode.value).toBe('replay')
  })

  it('removes mode param when exiting replay', () => {
    const { mode, replaceCalls, exitReplayMode } = createModeComputed({ mode: 'replay' })
    expect(mode.value).toBe('replay')

    exitReplayMode()

    expect(replaceCalls).toHaveLength(1)
    expect(replaceCalls[0].query.mode).toBeUndefined()
    expect(mode.value).toBe('edit')
  })

  it('preserves other query params when toggling mode', () => {
    const { replaceCalls, enterReplayMode, exitReplayMode } = createModeComputed({ tab: 'info' })

    enterReplayMode()
    expect(replaceCalls[0].query.tab).toBe('info')
    expect(replaceCalls[0].query.mode).toBe('replay')

    exitReplayMode()
    expect(replaceCalls[1].query.tab).toBe('info')
    expect(replaceCalls[1].query.mode).toBeUndefined()
  })

  it('treats unknown mode values as edit', () => {
    const { mode } = createModeComputed({ mode: 'unknown' })
    expect(mode.value).toBe('edit')
  })
})
