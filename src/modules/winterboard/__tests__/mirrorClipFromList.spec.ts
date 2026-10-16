/**
 * «Дзеркало уроку»: вікно відеофрагмента (саме завантажує запис і чесно каже словами, якщо двох знімків
 * на одній сторінці немає) і де його відкривають.
 *
 * 2026-10-16 (власник: «роби» — відкрити всім; «то і в мене перероби»): відео робиться лише зі сторінки
 * запису — «Створити відеофрагмент» з'являється там, де в записі є знімки, будь-якому власнику запису.
 * Кнопку «🎬 Відео» на кожній картці «Моїх записів», підказку над списком і пілот 40/220 прибрано:
 * список не знає, у яких записах є знімки, і кнопка здебільшого вела у відмову «немає знімків».
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
const exportClip = vi.fn()
vi.mock('../engine/lessonMirror', async (orig) => ({
  ...(await orig<typeof import('../engine/lessonMirror')>()),
  analyzeRange: (...a: unknown[]) => analyzeRange(...a),
  exportClip: (...a: unknown[]) => exportClip(...a),
  clipExportSupport: () => Promise.resolve({ ok: true, codec: 'avc1.640028' }),
}))

import LessonMirrorExportDialog from '../components/replay/LessonMirrorExportDialog.vue'
import ReplayCard from '../components/replay/ReplayCard.vue'

const M = (uk as unknown as { winterboard: { mirrorClip: Record<string, string> } }).winterboard.mirrorClip
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

describe('вікно відеофрагмента (за id запису)', () => {
  beforeEach(() => { loadReplayMirrorPages.mockReset(); analyzeRange.mockReset() })
  const open = () => mount(LessonMirrorExportDialog, { props: { replayId: 'r-1', lessonTitle: 'Урок' }, global: { plugins: [i18n()], stubs: { teleport: true } } })

  it('знімків немає — причина словами, нічого вибирати', async () => {
    loadReplayMirrorPages.mockResolvedValue([])
    const w = open()
    await flushPromises()
    expect(loadReplayMirrorPages.mock.calls[0][0]).toBe('r-1')
    expect(w.find('[data-testid="mirror-clip-empty"]').text()).toBe(M.noPhotos)
    expect(w.find('[data-testid="mirror-clip-create"]').exists()).toBe(false)
  })

  it('знімки є — вибір сторінки й діапазону, «Створити відео» бере знімки запису', async () => {
    loadReplayMirrorPages.mockResolvedValue([{ pageId: 'p', label: '2', states: [{ seq: 1, url: 'u1' }, { seq: 2, url: 'u2' }, { seq: 3, url: 'u3' }] }])
    analyzeRange.mockResolvedValue({ steps: [], realSteps: 2, lightOnly: 0, estimatedMs: 5000, crop: { x: 0, y: 0, w: 10, h: 10 } })
    const w = open()
    await flushPromises()
    exportClip.mockResolvedValue(new Blob(['x'], { type: 'video/mp4' }))
    ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = () => 'blob:clip'
    await w.find('[data-testid="mirror-clip-create"]').trigger('click')
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

describe('де відкривають відео', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8')
  const replay = { id: 'r-1', title: 'Урок', status: 'active', visibility: 'private' } as unknown as Replay

  it('картка «Моїх записів» — без «🎬 Відео» і без події clip', () => {
    const w = mount(ReplayCard, {
      props: { replay, viewMode: 'grid', menuOpen: false, copied: false },
      global: { plugins: [i18n()], directives: { clickOutside: {} } },
    })
    expect(w.find('[data-testid="replay-card-clip"]').exists()).toBe(false)
    expect(read('components/replay/ReplayCard.vue')).not.toMatch(/canMakeClip|'clip'|btn--clip|with-clip/)
  })

  it('«Мої записи» — без підказки, вікна й пілота', () => {
    const list = read('views/WBReplayList.vue')
    expect(list).not.toMatch(/canMakeClip|clipHint|LessonMirrorExportDialog|lessonMirror\/pilot|@clip=/)
    expect(fs.existsSync(path.resolve(__dirname, '..', 'engine/lessonMirror/pilot.ts'))).toBe(false)
  })

  it('сторінка запису: «Створити відеофрагмент» — власнику запису зі знімками, без пілота', () => {
    const view = read('views/WBPublicView.vue')
    expect(view).not.toContain('lessonMirror/pilot')
    expect(view).not.toContain('isMirrorClipPilotUser')
    expect(view).toMatch(/canOfferMirrorClip = computed\(\(\) =>\s*isOwnerView\.value && mirrorPhotoPages\.value\.length > 0\)/)
    expect(view).toMatch(/if \(!isOwnerView\.value \|\| !meta \|\| !replay\) return/)
    expect(view).toMatch(/const isOwnerView = computed\(\(\) => isAccountReplayRoute\.value && !isStudentView\.value\)/)
  })
})
