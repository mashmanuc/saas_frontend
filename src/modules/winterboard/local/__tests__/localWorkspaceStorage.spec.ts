// Local Workspace v1 — тести персистентності (storage-адаптер, seed-флаг,
// throttled saver, handoff-буфер). ТЗ LOCAL_WORKSPACE 2026-07-15.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  LOCAL_WORKSPACE_STATE_KEY,
  LOCAL_WORKSPACE_SEEDED_KEY,
  LOCAL_WORKSPACE_HANDOFF_KEY,
  _setLocalWorkspaceStorageAdapter,
  loadLocalWorkspace,
  saveLocalWorkspace,
  hasLocalWorkspace,
  clearLocalWorkspace,
  isLocalWorkspaceSeeded,
  markLocalWorkspaceSeeded,
  createThrottledSaver,
  stashHandoff,
  loadHandoff,
  updateHandoff,
  clearHandoff,
  type LocalWorkspaceStorageAdapter,
} from '../localWorkspaceStorage'
import type { WBWorkspaceState } from '../../types/winterboard'

// ── In-memory адаптер (ізоляція від реального localStorage) ────────────────

function makeMemoryAdapter(store: Map<string, string> = new Map()): LocalWorkspaceStorageAdapter & { store: Map<string, string> } {
  return {
    store,
    read: (key) => store.get(key) ?? null,
    write: (key, value) => { store.set(key, value); return true },
    remove: (key) => { store.delete(key) },
  }
}

function makeState(): WBWorkspaceState {
  return {
    pages: [{
      id: 'page-1',
      name: 'Page 1',
      strokes: [],
      assets: [],
      background: 'white',
      backgroundColor: '#cdf9d0',
    }],
    currentPageIndex: 0,
  }
}

let adapter: ReturnType<typeof makeMemoryAdapter>

beforeEach(() => {
  adapter = makeMemoryAdapter()
  _setLocalWorkspaceStorageAdapter(adapter)
})

describe('localWorkspaceStorage — snapshot', () => {
  it('save → load roundtrip зберігає name і state', () => {
    const ok = saveLocalWorkspace('Мій стіл', makeState())
    expect(ok).toBe(true)
    const loaded = loadLocalWorkspace()
    expect(loaded).not.toBeNull()
    expect(loaded!.version).toBe(1)
    expect(loaded!.name).toBe('Мій стіл')
    expect(loaded!.state.pages[0].id).toBe('page-1')
    expect(typeof loaded!.savedAt).toBe('number')
  })

  it('порожнє сховище → null; hasLocalWorkspace відповідає стану', () => {
    expect(loadLocalWorkspace()).toBeNull()
    expect(hasLocalWorkspace()).toBe(false)
    saveLocalWorkspace('x', makeState())
    expect(hasLocalWorkspace()).toBe(true)
    clearLocalWorkspace()
    expect(hasLocalWorkspace()).toBe(false)
  })

  it('пошкоджений JSON → null (не throw)', () => {
    adapter.store.set(LOCAL_WORKSPACE_STATE_KEY, '{broken json')
    expect(loadLocalWorkspace()).toBeNull()
  })

  it('невідома версія снапшота → null (forward-compat guard)', () => {
    adapter.store.set(LOCAL_WORKSPACE_STATE_KEY, JSON.stringify({ version: 99, state: { pages: [] } }))
    expect(loadLocalWorkspace()).toBeNull()
  })

  it('write-фейл адаптера (quota) → save повертає false', () => {
    _setLocalWorkspaceStorageAdapter({
      read: () => null,
      write: () => false,
      remove: () => undefined,
    })
    expect(saveLocalWorkspace('x', makeState())).toBe(false)
  })
})

describe('localWorkspaceStorage — seeded flag', () => {
  it('дефолт false → mark → true; ключ ізольований від снапшота', () => {
    expect(isLocalWorkspaceSeeded()).toBe(false)
    markLocalWorkspaceSeeded()
    expect(isLocalWorkspaceSeeded()).toBe(true)
    expect(adapter.store.has(LOCAL_WORKSPACE_SEEDED_KEY)).toBe(true)
    // clearLocalWorkspace НЕ чіпає seeded (подарунок не регенерується)
    clearLocalWorkspace()
    expect(isLocalWorkspaceSeeded()).toBe(true)
  })
})

describe('createThrottledSaver', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('серія schedule() у вікні → ОДИН виклик saveFn (trailing)', () => {
    const saveFn = vi.fn()
    const saver = createThrottledSaver(saveFn, 800)
    saver.schedule()
    saver.schedule()
    saver.schedule()
    expect(saveFn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(799)
    expect(saveFn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('flush() зберігає негайно і скасовує таймер; без dirty — no-op', () => {
    const saveFn = vi.fn()
    const saver = createThrottledSaver(saveFn, 800)
    saver.flush() // нічого не заплановано
    expect(saveFn).not.toHaveBeenCalled()
    saver.schedule()
    saver.flush()
    expect(saveFn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000) // таймер скасовано — другого виклику нема
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('cancel() скидає заплановане без збереження', () => {
    const saveFn = vi.fn()
    const saver = createThrottledSaver(saveFn, 800)
    saver.schedule()
    saver.cancel()
    vi.advanceTimersByTime(2000)
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('повторний schedule після спрацювання відкриває нове вікно', () => {
    const saveFn = vi.fn()
    const saver = createThrottledSaver(saveFn, 800)
    saver.schedule()
    vi.advanceTimersByTime(800)
    expect(saveFn).toHaveBeenCalledTimes(1)
    saver.schedule()
    vi.advanceTimersByTime(800)
    expect(saveFn).toHaveBeenCalledTimes(2)
  })
})

describe('localWorkspaceStorage — handoff buffer (ТЗ §5)', () => {
  it('stash → load roundtrip; ops/cloudSessionId відсутні на старті', () => {
    expect(stashHandoff('Мій стіл', makeState())).toBe(true)
    const buf = loadHandoff()
    expect(buf).not.toBeNull()
    expect(buf!.name).toBe('Мій стіл')
    expect(buf!.ops).toBeUndefined()
    expect(buf!.cloudSessionId).toBeUndefined()
  })

  it('updateHandoff персистить checkpoint-и (ops, cloudSessionId) не руйнуючи state', () => {
    stashHandoff('x', makeState())
    updateHandoff({ ops: [{ op_id: 'op-1', op_type: 'page_add', payload: {} }] })
    updateHandoff({ cloudSessionId: 'sess-42' })
    const buf = loadHandoff()
    expect(buf!.ops).toHaveLength(1)
    expect(buf!.ops![0].op_id).toBe('op-1')
    expect(buf!.cloudSessionId).toBe('sess-42')
    expect(buf!.state.pages[0].id).toBe('page-1')
  })

  it('updateHandoff без буфера — no-op (не створює сміття)', () => {
    updateHandoff({ cloudSessionId: 'orphan' })
    expect(adapter.store.has(LOCAL_WORKSPACE_HANDOFF_KEY)).toBe(false)
  })

  it('clearHandoff чистить ЛИШЕ буфер (основний стан живе)', () => {
    saveLocalWorkspace('main', makeState())
    stashHandoff('main', makeState())
    clearHandoff()
    expect(loadHandoff()).toBeNull()
    expect(hasLocalWorkspace()).toBe(true)
  })

  it('пошкоджений буфер → null (не throw)', () => {
    adapter.store.set(LOCAL_WORKSPACE_HANDOFF_KEY, 'not-json')
    expect(loadHandoff()).toBeNull()
  })
})
