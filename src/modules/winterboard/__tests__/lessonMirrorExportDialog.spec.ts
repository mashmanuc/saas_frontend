/**
 * Діалог «Створити відеофрагмент»: рушій підмінено (jsdom без полотен і WebCodecs) — перевіряємо потік і
 * правдивість станів. Одна дія «Створити відео» (власник 2026-10-10: окремий крок «Підготувати» не потрібен):
 * аналіз → кодування → відео й завантаження; задовгий діапазон — назад до вибору з причиною, без кодування;
 * «Ще один фрагмент» лишає сторінку й діапазон (кілька роликів з одного запису); помилка завантаження знімка
 * не дає «готового» файла; браузер без кодека — причина словами.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import type { MirrorPhotoPage } from '../engine/lessonMirror/types'

const analyzeRange = vi.fn()
const exportClip = vi.fn()
const clipExportSupport = vi.fn()
vi.mock('../engine/lessonMirror', async (orig) => ({
  ...(await orig<typeof import('../engine/lessonMirror')>()),
  analyzeRange: (...a: unknown[]) => analyzeRange(...a),
  exportClip: (...a: unknown[]) => exportClip(...a),
  clipExportSupport: (...a: unknown[]) => clipExportSupport(...a),
}))

import LessonMirrorExportDialog from '../components/replay/LessonMirrorExportDialog.vue'

const M = (uk as unknown as { winterboard: { mirrorClip: Record<string, string> } }).winterboard.mirrorClip
const pages: MirrorPhotoPage[] = [
  { pageId: 'p1', label: '1', states: Array.from({ length: 5 }, (_, i) => ({ seq: i + 1, url: `https://images.m4sh.org/a${i}.jpg` })) },
  { pageId: 'p2', label: '3', states: Array.from({ length: 3 }, (_, i) => ({ seq: i + 10, url: `https://images.m4sh.org/b${i}.jpg` })) },
]
const analysis = (ms: number) => ({ steps: [], realSteps: 3, lightOnly: 1, estimatedMs: ms, crop: { x: 0, y: 0, w: 1600, h: 900 } })

function mountDialog() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  return mount(LessonMirrorExportDialog, { props: { pages, lessonTitle: 'Урок: Коло / парабола' }, global: { plugins: [i18n], stubs: { teleport: true } } })
}

/** v-model.number на <select>: test-utils setValue не вибирає числові значення — ставимо selectedIndex */
async function pick(w: VueWrapper, testid: string, index: number) {
  const sel = w.find(`[data-testid="${testid}"]`)
  ;(sel.element as HTMLSelectElement).selectedIndex = index
  await sel.trigger('change')
}

describe('LessonMirrorExportDialog', () => {
  beforeEach(() => {
    analyzeRange.mockReset()
    exportClip.mockReset()
    clipExportSupport.mockReset().mockResolvedValue({ ok: true, codec: 'avc1.640028' })
    ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:clip')
    ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn()
  })

  it('одна дія «Створити відео» — аналіз і кодування, без кроку «Підготувати»; відео того самого файла й завантаження', async () => {
    analyzeRange.mockResolvedValue(analysis(38_700))
    exportClip.mockResolvedValue(new Blob(['x'], { type: 'video/mp4' }))
    const w = mountDialog()
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-prepare"]').exists()).toBe(false)
    await w.find('[data-testid="mirror-clip-create"]').trigger('click')
    await flushPromises()
    expect(analyzeRange.mock.calls[0][0]).toEqual(pages[0].states.map((s) => s.url))
    expect(exportClip.mock.calls[0][2]).toBe('avc1.640028')
    expect(w.find('[data-testid="mirror-clip-video"]').attributes('src')).toBe('blob:clip')
    expect(w.find('[data-testid="mirror-clip-summary"]').text()).toContain('0:39')
    const a = w.find('[data-testid="mirror-clip-download"]')
    expect(a.attributes('href')).toBe('blob:clip')
    expect(a.attributes('download')).toBe('Урок Коло парабола — Сторінка 1, 1–5.mp4')
    expect(w.text()).toContain(M.checkBeforeSharing)
  })

  it('«Ще один фрагмент» — та сама сторінка й діапазон, другий ролик із частини запису', async () => {
    analyzeRange.mockResolvedValue(analysis(10_000))
    exportClip.mockResolvedValue(new Blob(['x'], { type: 'video/mp4' }))
    const w = mountDialog()
    await flushPromises()
    await pick(w, 'mirror-clip-from', 1)
    await pick(w, 'mirror-clip-to', 3)
    await w.find('[data-testid="mirror-clip-create"]').trigger('click')
    await flushPromises()
    expect(analyzeRange.mock.calls[0][0]).toEqual(pages[0].states.slice(1, 4).map((s) => s.url))
    expect(w.find('[data-testid="mirror-clip-download"]').attributes('download')).toContain(', 2–4.mp4')
    await w.find('[data-testid="mirror-clip-again"]').trigger('click')
    expect((w.find('[data-testid="mirror-clip-from"]').element as HTMLSelectElement).selectedIndex).toBe(1)
    expect((w.find('[data-testid="mirror-clip-to"]').element as HTMLSelectElement).selectedIndex).toBe(3)
  })

  it('інша сторінка — діапазон на всю сторінку', async () => {
    analyzeRange.mockResolvedValue(analysis(10_000))
    exportClip.mockResolvedValue(new Blob(['x'], { type: 'video/mp4' }))
    const w = mountDialog()
    await flushPromises()
    await pick(w, 'mirror-clip-page', 1)
    await w.find('[data-testid="mirror-clip-create"]').trigger('click')
    await flushPromises()
    expect(analyzeRange.mock.calls[0][0]).toEqual(pages[1].states.map((s) => s.url))
  })

  it('довше за 5 хв — назад до вибору з причиною, відео не кодується', async () => {
    analyzeRange.mockResolvedValue(analysis(6 * 60_000))
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="mirror-clip-create"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-too-long"]').exists()).toBe(true)
    expect(w.find('[data-testid="mirror-clip-from"]').exists()).toBe(true)
    expect(exportClip).not.toHaveBeenCalled()
    await pick(w, 'mirror-clip-to', 2)                                 // інший діапазон — попередження зникає
    expect(w.find('[data-testid="mirror-clip-too-long"]').exists()).toBe(false)
  })

  it('знімок не завантажився — помилка з номером, «готового» відео немає', async () => {
    analyzeRange.mockRejectedValue(new Error(`load_failed:${pages[0].states[2].url}`))
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="mirror-clip-create"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-error"]').text()).toBe(M.loadFailed.replace('{n}', '3'))
    expect(w.find('[data-testid="mirror-clip-download"]').exists()).toBe(false)
    expect(exportClip).not.toHaveBeenCalled()
  })

  it('браузер без H.264 — причина словами, «Створити відео» неактивна', async () => {
    clipExportSupport.mockResolvedValue({ ok: false })
    const w = mountDialog()
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-unsupported"]').exists()).toBe(true)
    expect(w.find('[data-testid="mirror-clip-create"]').attributes('disabled')).toBeDefined()
  })

  it('«×» — закриває', async () => {
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="mirror-clip-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
