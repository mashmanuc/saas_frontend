/**
 * Діалог «Створити відеофрагмент»: рушій підмінено (jsdom без полотен і WebCodecs) — перевіряємо потік і
 * правдивість станів: прогноз → відео → завантаження; помилка завантаження знімка не дає «готового» файла;
 * задовгий діапазон і браузер без кодека — причина словами, кнопка неактивна.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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
  return mount(LessonMirrorExportDialog, { props: { pages, lessonTitle: 'Урок: Коло / парабола' }, global: { plugins: [i18n] } })
}

describe('LessonMirrorExportDialog', () => {
  beforeEach(() => {
    analyzeRange.mockReset()
    exportClip.mockReset()
    clipExportSupport.mockReset().mockResolvedValue({ ok: true, codec: 'avc1.640028' })
    ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:clip')
    ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn()
  })

  it('підготувати → прогноз → створити → відео того самого файла й завантаження з назвою уроку', async () => {
    analyzeRange.mockResolvedValue(analysis(38_700))
    exportClip.mockResolvedValue(new Blob(['x'], { type: 'video/mp4' }))
    const w = mountDialog()
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-page"]').exists()).toBe(true)
    await w.find('[data-testid="mirror-clip-prepare"]').trigger('click')
    await flushPromises()
    expect(analyzeRange.mock.calls[0][0]).toEqual(pages[0].states.map((s) => s.url))
    expect(w.find('[data-testid="mirror-clip-summary"]').text()).toContain('0:39')
    await w.find('[data-testid="mirror-clip-create"]').trigger('click')
    await flushPromises()
    expect(exportClip.mock.calls[0][2]).toBe('avc1.640028')
    expect(w.find('[data-testid="mirror-clip-video"]').attributes('src')).toBe('blob:clip')
    const a = w.find('[data-testid="mirror-clip-download"]')
    expect(a.attributes('href')).toBe('blob:clip')
    expect(a.attributes('download')).toBe('Урок  Коло парабола — Сторінка 1, 1–5.mp4'.replace('  ', ' '))
    expect(w.text()).toContain(M.checkBeforeSharing)
  })

  it('інша сторінка — діапазон на всю сторінку', async () => {
    analyzeRange.mockResolvedValue(analysis(10_000))
    const w = mountDialog()
    await flushPromises()
    const sel = w.find('[data-testid="mirror-clip-page"]')
    ;(sel.element as HTMLSelectElement).selectedIndex = 1
    await sel.trigger('change')
    await w.find('[data-testid="mirror-clip-prepare"]').trigger('click')
    await flushPromises()
    expect(analyzeRange.mock.calls[0][0]).toEqual(pages[1].states.map((s) => s.url))
  })

  it('знімок не завантажився — помилка з номером, «готового» відео немає', async () => {
    analyzeRange.mockRejectedValue(new Error(`load_failed:${pages[0].states[2].url}`))
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="mirror-clip-prepare"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-error"]').text()).toBe(M.loadFailed.replace('{n}', '3'))
    expect(w.find('[data-testid="mirror-clip-download"]').exists()).toBe(false)
  })

  it('довше за 5 хв — причина словами, «Створити» неактивна', async () => {
    analyzeRange.mockResolvedValue(analysis(6 * 60_000))
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="mirror-clip-prepare"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-too-long"]').exists()).toBe(true)
    expect(w.find('[data-testid="mirror-clip-create"]').attributes('disabled')).toBeDefined()
  })

  it('браузер без H.264 — причина словами, «Створити» неактивна', async () => {
    clipExportSupport.mockResolvedValue({ ok: false })
    analyzeRange.mockResolvedValue(analysis(10_000))
    const w = mountDialog()
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-unsupported"]').exists()).toBe(true)
    await w.find('[data-testid="mirror-clip-prepare"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="mirror-clip-create"]').attributes('disabled')).toBeDefined()
  })

  it('«×» — закриває', async () => {
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="mirror-clip-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
