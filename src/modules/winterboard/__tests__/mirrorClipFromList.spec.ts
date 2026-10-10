/**
 * «Дзеркало уроку» зі списку «Мої записи» (власник 2026-10-10: «функція глибоко зашита»):
 * «🎬 Відео» в картці запису — лише пілотним акаунтам і не в кошику; вікно саме завантажує запис
 * і чесно каже словами, якщо двох знімків на одній сторінці немає.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import uk from '../../../i18n/locales/uk.json'
import type { Replay } from '../api/replayLifecycleApi'

const loadReplayMirrorPages = vi.fn()
vi.mock('../composables/replayMirrorPages', () => ({ loadReplayMirrorPages: (...a: unknown[]) => loadReplayMirrorPages(...a) }))
const analyzeRange = vi.fn()
vi.mock('../engine/lessonMirror', async (orig) => ({
  ...(await orig<typeof import('../engine/lessonMirror')>()),
  analyzeRange: (...a: unknown[]) => analyzeRange(...a),
  clipExportSupport: () => Promise.resolve({ ok: true, codec: 'avc1.640028' }),
}))

import LessonMirrorExportDialog from '../components/replay/LessonMirrorExportDialog.vue'
import ReplayCard from '../components/replay/ReplayCard.vue'
import { isMirrorClipPilotUser } from '../engine/lessonMirror/pilot'

const M = (uk as unknown as { winterboard: { mirrorClip: Record<string, string> } }).winterboard.mirrorClip
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

describe('вікно зі списку (за id запису)', () => {
  beforeEach(() => { loadReplayMirrorPages.mockReset(); analyzeRange.mockReset() })
  const open = () => mount(LessonMirrorExportDialog, { props: { replayId: 'r-1', lessonTitle: 'Урок' }, global: { plugins: [i18n()] } })

  it('знімків немає — причина словами, нічого вибирати', async () => {
    loadReplayMirrorPages.mockResolvedValue([])
    const w = open()
    await flushPromises()
    expect(loadReplayMirrorPages.mock.calls[0][0]).toBe('r-1')
    expect(w.find('[data-testid="mirror-clip-empty"]').text()).toBe(M.noPhotos)
    expect(w.find('[data-testid="mirror-clip-prepare"]').exists()).toBe(false)
  })

  it('знімки є — вибір сторінки й діапазону, «Підготувати» бере знімки запису', async () => {
    loadReplayMirrorPages.mockResolvedValue([{ pageId: 'p', label: '2', states: [{ seq: 1, url: 'u1' }, { seq: 2, url: 'u2' }, { seq: 3, url: 'u3' }] }])
    analyzeRange.mockResolvedValue({ steps: [], realSteps: 2, lightOnly: 0, estimatedMs: 5000, crop: { x: 0, y: 0, w: 10, h: 10 } })
    const w = open()
    await flushPromises()
    await w.find('[data-testid="mirror-clip-prepare"]').trigger('click')
    await flushPromises()
    expect(analyzeRange.mock.calls[0][0]).toEqual(['u1', 'u2', 'u3'])
  })

  it('запис не завантажився — помилка словами', async () => {
    loadReplayMirrorPages.mockRejectedValue(new Error('500'))
    const w = open()
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-error"]').text()).toBe(M.loadRecordFailed)
  })
})

describe('кнопка «🎬 Відео» в картці запису', () => {
  const replay = (status: Replay['status']) => ({ id: 'r-1', title: 'Урок', status, visibility: 'private' } as unknown as Replay)
  const card = (canMakeClip: boolean, status: Replay['status'] = 'active') => mount(ReplayCard, {
    props: { replay: replay(status), viewMode: 'grid', menuOpen: false, copied: false, canMakeClip },
    global: { plugins: [i18n()], directives: { clickOutside: {} } },
  })

  it('пілот — є, тисне — подія з записом', async () => {
    const w = card(true)
    const b = w.find('[data-testid="replay-card-clip"]')
    expect(b.text()).toContain(M.video)
    await b.trigger('click')
    expect(w.emitted('clip')?.[0]?.[0]).toMatchObject({ id: 'r-1' })
  })

  it('не пілот або запис у кошику — кнопки немає', () => {
    expect(card(false).find('[data-testid="replay-card-clip"]').exists()).toBe(false)
    expect(card(true, 'trashed').find('[data-testid="replay-card-clip"]').exists()).toBe(false)
  })
})

describe('обв\'язка', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8')

  it('пілот один на плеєр і список: 40 і 220', () => {
    expect(isMirrorClipPilotUser(40)).toBe(true)
    expect(isMirrorClipPilotUser('220')).toBe(true)
    expect(isMirrorClipPilotUser(41)).toBe(false)
    expect(isMirrorClipPilotUser(undefined)).toBe(false)
    expect(read('views/WBPublicView.vue')).toContain("from '../engine/lessonMirror/pilot'")
    expect(read('views/WBPublicView.vue')).not.toMatch(/new Set\(\[40, 220\]\)/)
  })

  it('«Мої записи»: кнопка за пілотом, вікно — за id запису', () => {
    const list = read('views/WBReplayList.vue')
    expect(list).toMatch(/:can-make-clip="canMakeClip"/)
    expect(list).toMatch(/isMirrorClipPilotUser\(authStore\.user\?\.id\)/)
    expect(list).toMatch(/<LessonMirrorExportDialog[\s\S]*?:replay-id="clipReplay\.id"/)
  })
})
