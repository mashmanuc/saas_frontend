import { describe, it, expect, vi, beforeEach } from 'vitest'

const notifyWarning = vi.fn()
const notifyError = vi.fn()
vi.mock('@/utils/notify', () => ({
  notifyWarning: (...a: any[]) => notifyWarning(...a),
  notifyError: (...a: any[]) => notifyError(...a),
}))

import { announceLifecycleBlock, lifecycleBlockMessage, LIFECYCLE_BLOCK_EVENT } from '../remote/lifecycleBlock'

describe('lifecycleBlock — чесний тост + подія для кімнати', () => {
  beforeEach(() => { notifyWarning.mockClear(); notifyError.mockClear() })

  it('REPLAY_FROZEN_NO_WRITE: текст веде до «Новий запис», а не «нова дошка»', () => {
    const msg = lifecycleBlockMessage('REPLAY_FROZEN_NO_WRITE')
    expect(msg).toContain('Новий запис')
    expect(msg).not.toContain('нову дошку')
    expect(msg).toContain('не зберігається')
  })

  it('announce: warning-тост для frozen/paused, error для archived', () => {
    announceLifecycleBlock({ code: 'REPLAY_FROZEN_NO_WRITE', recordingState: 'finalized', sessionId: 's' })
    expect(notifyWarning).toHaveBeenCalledTimes(1)
    announceLifecycleBlock({ code: 'PAUSED_RECORDING_READ_ONLY', recordingState: 'paused', sessionId: 's' })
    expect(notifyWarning).toHaveBeenCalledTimes(2)
    announceLifecycleBlock({ code: 'SESSION_ARCHIVED', recordingState: 'idle', sessionId: 's' })
    expect(notifyError).toHaveBeenCalledTimes(1)
  })

  it('announce: кидає CustomEvent з кодом і станом — кімната вмикає банер', () => {
    const seen: any[] = []
    const on = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener(LIFECYCLE_BLOCK_EVENT, on)
    announceLifecycleBlock({ code: 'REPLAY_FROZEN_NO_WRITE', recordingState: 'finalized', sessionId: 'abc' })
    window.removeEventListener(LIFECYCLE_BLOCK_EVENT, on)
    expect(seen).toEqual([{ code: 'REPLAY_FROZEN_NO_WRITE', recordingState: 'finalized', sessionId: 'abc' }])
  })

  it('announce ніколи не кидає, навіть якщо тост зламався', () => {
    notifyWarning.mockImplementationOnce(() => { throw new Error('boom') })
    expect(() => announceLifecycleBlock({ code: 'REPLAY_FROZEN_NO_WRITE', recordingState: null, sessionId: null })).not.toThrow()
  })
})
