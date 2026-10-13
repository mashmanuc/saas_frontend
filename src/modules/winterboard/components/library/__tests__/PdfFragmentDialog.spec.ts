/**
 * «✂️ Взяти фрагмент» (TZ_PDF_FRAGMENT_2026-10-13, ред. 2):
 * рамка (намалювати, підтягнути, пересунути, мінімум 1 %), «Додати» — один запит і місце, запамʼятоване в момент
 * натискання; помилка — рамка на місці, нічого на дошці; сторінку змінили — «збережено, не поставлено».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../../i18n/locales/uk.json'
import PdfFragmentDialog from '../PdfFragmentDialog.vue'
import { fragmentPlacement, normRect, sameSpot, FRAGMENT_MIN_W } from '../pdfFragmentRect'

vi.mock('../../../api/library', () => ({ cutPdfFragment: vi.fn(), snapPdfFragment: vi.fn() }))
vi.mock('../../../composables/useDocumentPageCache', () => ({
  getDocumentPageUrl: vi.fn(async (_id: number, _t: string, idx: number) => `/media/page_${idx + 1}.png`),
}))
import { cutPdfFragment, snapPdfFragment } from '../../../api/library'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const M = (uk as unknown as { winterboard: { pdfFragment: Record<string, string> } }).winterboard.pdfFragment
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k]))

const BOX = { left: 100, top: 50, width: 600, height: 800 }
const RES = { id: 77, name: 'НМТ · с.4 · фрагмент.png', cdn_url: '/media/frag.png', width: 3000, height: 400, dpi: 480, reused: false, board_page: 'p1' }

/** Відкрити вікно й дочекатися картинки сторінки; розмір підкладки — після неї (елемент перемальовується) */
async function dialog(over: Record<string, unknown> = {}) {
  const snapshot = vi.fn(() => ({ boardId: 'board-1', pageId: 'p1', viewerId: 'docviewer-1' }))
  const place = vi.fn(() => 'placed' as const)
  const w = mount(PdfFragmentDialog, {
    props: { contentItemId: 5, title: 'НМТ', totalPages: 11, startPage: 3, viewerId: 'docviewer-1', snapshot, place, ...over },
    global: { plugins: [i18n()], stubs: { teleport: true } },
    attachTo: document.body,
  })
  await flushPromises()
  const overlay = w.find('[data-testid="pdf-fragment-overlay"]')
  return { w, overlay, snapshot, place }
}

/** Провести пером від (fx0, fy0) до (fx1, fy1) у частках сторінки */
async function drag(overlay: Awaited<ReturnType<typeof dialog>>['overlay'], fx0: number, fy0: number, fx1: number, fy1: number, target?: Element) {
  const at = (fx: number, fy: number) => ({ clientX: BOX.left + fx * BOX.width, clientY: BOX.top + fy * BOX.height, pointerId: 1 })
  const el = target ?? overlay.element
  el.dispatchEvent(Object.assign(new MouseEvent('pointerdown', { bubbles: true, ...at(fx0, fy0) }), { pointerId: 1 }))
  overlay.element.dispatchEvent(Object.assign(new MouseEvent('pointermove', { bubbles: true, ...at(fx1, fy1) }), { pointerId: 1 }))
  overlay.element.dispatchEvent(Object.assign(new MouseEvent('pointerup', { bubbles: true, ...at(fx1, fy1) }), { pointerId: 1 }))
  await flushPromises()
}

describe('pdfFragmentRect', () => {
  it('рамка з двох кутів у будь-якому порядку — у межах сторінки', () => {
    expect(normRect(0.8, 0.5, 0.2, 0.1)).toEqual({ x: 0.2, y: 0.1, w: 0.6000000000000001, h: 0.4 })
    expect(normRect(-0.2, 0.5, 1.3, 0.6)).toMatchObject({ x: 0, w: 1 })
  })

  it('удвічі більше, ніж у вікні; не ширше половини сторінки; не вужче 240; праворуч від вікна', () => {
    const viewer = { x: 100, y: 120, w: 422, h: 600 }
    const a = fragmentPlacement(viewer, { x: 0, y: 0, w: 0.5, h: 0.1 }, 3000, 600, 1920, 1080, [])
    expect(a).toEqual({ x: 546, y: 120, w: 420, h: 84 })
    expect(fragmentPlacement(viewer, { x: 0, y: 0, w: 0.95, h: 0.1 }, 3000, 300, 1920, 1080, []).w).toBe(798)
    expect(fragmentPlacement({ ...viewer, w: 1400 }, { x: 0, y: 0, w: 0.9, h: 0.1 }, 3000, 300, 1920, 1080, []).w).toBe(960)
    expect(fragmentPlacement(viewer, { x: 0, y: 0, w: 0.05, h: 0.05 }, 600, 600, 1920, 1080, []).w).toBe(FRAGMENT_MIN_W)
    // праворуч не влазить — притиснуто до правого краю сторінки
    expect(fragmentPlacement({ ...viewer, x: 1500 }, { x: 0, y: 0, w: 0.5, h: 0.1 }, 3000, 600, 1920, 1080, []).x).toBe(1920 - 420 - 16)
  })

  // Власник 2026-10-13: «вони всі ложаться одна під одною… як полотно закінчується, то й не видно їх»
  describe('місце на сторінці — за тим, що справді лежить, і в її межах', () => {
    const viewer = { x: 80, y: 0, w: 640, h: 900 }
    const TASK = { x: 0, y: 0, w: 0.9, h: 0.3 }      // задача з малюнком: 960 × 480 на дошці
    const put = (occupied: Array<{ x: number; y: number; w: number; h: number }>) =>
      fragmentPlacement(viewer, TASK, 3000, 1500, 1920, 1080, occupied)

    it('наступний — під попереднім; видалили — місце знову вільне', () => {
      const a = put([])
      expect(a).toEqual({ x: 744, y: 16, w: 960, h: 480 })
      const b = put([a])
      expect(b.y).toBe(16 + 480 + 16)
      expect(put([]).y).toBe(16)                 // обидва видалили — знову вгорі
      expect(put([b]).y).toBe(16)                // верхній видалили — його місце вільне
    })

    it('ніколи не за низ сторінки: стовпчик повний — угорі стовпчика зі зсувом, поверх', () => {
      const a = put([])
      const b = put([a])
      const c = put([a, b])
      expect(c.y + c.h).toBeLessThanOrEqual(1080 - 16)
      expect(c.x + c.w).toBeLessThanOrEqual(1920 - 16)
      const d = put([a, b, c])
      expect(d.y + d.h).toBeLessThanOrEqual(1080 - 16)
      expect([d.x, d.y]).not.toEqual([c.x, c.y])  // не точно на попередній
    })

    it('вищий за сторінку — зменшено, щоб умістився', () => {
      const tall = fragmentPlacement(viewer, { x: 0, y: 0, w: 0.9, h: 0.9 }, 1000, 3000, 1920, 1080, [])
      expect(tall.h).toBe(1080 - 32)
      expect(tall.y).toBe(16)
      expect(tall.w).toBe(Math.round(1048 / 3))
    })

    it('інші обʼєкти в стовпчику не перекриває, якщо є місце нижче; вікно документа внизу сторінки — фрагмент усе одно на сторінці', () => {
      const note = { x: 800, y: 0, w: 300, h: 200 }
      expect(put([note]).y).toBe(200 + 16)
      const low = fragmentPlacement({ ...viewer, y: 900 }, TASK, 3000, 1500, 1920, 1080, [])
      expect(low.y + low.h).toBeLessThanOrEqual(1080 - 16)
    })
  })

  it('ставимо лише туди, де натиснули: та сама дошка, сторінка й вікно PDF', () => {
    const at = { boardId: 'b1', pageId: 'p1' }
    expect(sameSpot(at, { boardId: 'b1', pageId: 'p1' }, true)).toBe(true)
    expect(sameSpot(at, { boardId: 'b1', pageId: 'p2' }, true)).toBe(false)
    expect(sameSpot(at, { boardId: 'b2', pageId: 'p1' }, true)).toBe(false)
    expect(sameSpot(at, { boardId: 'b1', pageId: 'p1' }, false)).toBe(false)
    expect(sameSpot({ boardId: '', pageId: '' }, { boardId: '', pageId: '' }, true)).toBe(false)
  })
})

describe('PdfFragmentDialog', () => {
  beforeEach(() => {
    vi.mocked(cutPdfFragment).mockReset()
    vi.mocked(snapPdfFragment).mockReset()
    // jsdom не знає «активного» вказівника й кидає на setPointerCapture; у браузері pointerId завжди живий
    Element.prototype.setPointerCapture = vi.fn()
    // jsdom не має розкладки: підкладка рамки (будь-який її примірник) — 600×800 від (100, 50)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('wb-frag__overlay')
        ? ({ ...BOX, right: 700, bottom: 850, x: 100, y: 50, toJSON: () => ({}) } as DOMRect)
        : ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
    })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('відкривається на поточній сторінці PDF; без рамки «Додати» вимкнено', async () => {
    const { w } = await dialog()
    expect(w.find('[data-testid="pdf-fragment-page"]').text()).toBe(fill(M.page, { n: 4, total: 11 }))
    expect(w.find('[data-testid="pdf-fragment-image"]').attributes('src')).toBe('/media/page_4.png')
    expect(w.find('[data-testid="pdf-fragment-add"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('обвели задачу → «Додати» → один запит з рамкою й дошкою з моменту натискання → місце → «Додано», рамка скинута', async () => {
    vi.mocked(cutPdfFragment).mockResolvedValueOnce(RES as never)
    const { w, overlay, snapshot, place } = await dialog()
    await drag(overlay, 0.1, 0.2, 0.85, 0.3)
    expect(w.find('[data-testid="pdf-fragment-rect"]').exists()).toBe(true)
    await w.find('[data-testid="pdf-fragment-add"]').trigger('click')
    await flushPromises()

    expect(vi.mocked(cutPdfFragment)).toHaveBeenCalledTimes(1)
    const args = vi.mocked(cutPdfFragment).mock.calls[0][0]
    expect(args).toMatchObject({ contentItem: 5, page: 4, board: 'board-1', viewer: 'docviewer-1' })
    expect(args.rect.x).toBeCloseTo(0.1, 5)
    expect(args.rect.w).toBeCloseTo(0.75, 5)
    expect(args.rect.h).toBeCloseTo(0.1, 5)
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(place).toHaveBeenCalledWith({ boardId: 'board-1', pageId: 'p1', viewerId: 'docviewer-1' }, RES, args.rect)
    expect(w.find('[data-testid="pdf-fragment-msg"]').text()).toBe(M.added)
    expect(w.find('[data-testid="pdf-fragment-rect"]').exists()).toBe(false)
    w.unmount()
  })

  it('рамку можна підтягнути за кут і пересунути', async () => {
    const { w, overlay } = await dialog()
    await drag(overlay, 0.2, 0.2, 0.4, 0.4)
    const handle = w.find('.wb-frag__handle.is-se').element
    await drag(overlay, 0.4, 0.4, 0.6, 0.5, handle)
    let style = (w.find('[data-testid="pdf-fragment-rect"]').element as HTMLElement).style
    expect(parseFloat(style.width)).toBeCloseTo(40, 3)
    expect(parseFloat(style.height)).toBeCloseTo(30, 3)
    await drag(overlay, 0.3, 0.3, 0.4, 0.3, w.find('[data-testid="pdf-fragment-rect"]').element)
    style = (w.find('[data-testid="pdf-fragment-rect"]').element as HTMLElement).style
    expect(parseFloat(style.left)).toBeCloseTo(30, 3)
    w.unmount()
  })

  it('рамка менша за 1 % — «Додати» вимкнено, запиту немає', async () => {
    const { w, overlay } = await dialog()
    await drag(overlay, 0.5, 0.5, 0.505, 0.6)
    expect(w.find('[data-testid="pdf-fragment-add"]').attributes('disabled')).toBeDefined()
    await w.find('[data-testid="pdf-fragment-add"]').trigger('click')
    expect(cutPdfFragment).not.toHaveBeenCalled()
    expect(snapPdfFragment).not.toHaveBeenCalled() // риска — не клік, задачу не шукаємо
    w.unmount()
  })

  it('клік по задачі → рамка задачі з ручками, «Задача 13», «Додати» ввімкнено', async () => {
    vi.mocked(snapPdfFragment).mockResolvedValueOnce({ kind: 'task', number: 13, rect: { x: 0.05, y: 0.25, w: 0.9, h: 0.2 } })
    const { w, overlay } = await dialog()
    await drag(overlay, 0.3, 0.4, 0.3, 0.4)
    expect(vi.mocked(snapPdfFragment)).toHaveBeenCalledTimes(1)
    const args = vi.mocked(snapPdfFragment).mock.calls[0][0]
    expect(args).toMatchObject({ contentItem: 5, page: 4, board: 'board-1', viewer: 'docviewer-1' })
    expect(args.point.x).toBeCloseTo(0.3, 5)
    expect(args.point.y).toBeCloseTo(0.4, 5)
    const style = (w.find('[data-testid="pdf-fragment-rect"]').element as HTMLElement).style
    expect(parseFloat(style.top)).toBeCloseTo(25, 3)
    expect(parseFloat(style.height)).toBeCloseTo(20, 3)
    expect(w.findAll('.wb-frag__handle').length).toBeGreaterThan(0)
    expect(w.find('[data-testid="pdf-fragment-msg"]').text()).toBe(fill(M.snapTask, { n: 13 }))
    expect(w.find('[data-testid="pdf-fragment-add"]').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('не задача й не текст (скан, порожнє поле) — рамки немає, підказка обвести вручну', async () => {
    vi.mocked(snapPdfFragment).mockResolvedValueOnce({ kind: 'none' })
    const { w, overlay } = await dialog()
    await drag(overlay, 0.9, 0.95, 0.9, 0.95)
    expect(w.find('[data-testid="pdf-fragment-rect"]').exists()).toBe(false)
    expect(w.find('[data-testid="pdf-fragment-msg"]').text()).toBe(M.snapNone)
    w.unmount()
  })

  it('поки шукали задачу, перегорнули сторінку — стара відповідь рамки не ставить', async () => {
    let resolve!: (v: unknown) => void
    vi.mocked(snapPdfFragment).mockReturnValueOnce(new Promise(r => { resolve = r }) as never)
    const { w, overlay } = await dialog()
    await drag(overlay, 0.3, 0.4, 0.3, 0.4)
    await w.find('[data-testid="pdf-fragment-next"]').trigger('click')
    resolve({ kind: 'task', number: 13, rect: { x: 0.05, y: 0.25, w: 0.9, h: 0.2 } })
    await flushPromises()
    expect(w.find('[data-testid="pdf-fragment-page"]').text()).toBe(fill(M.page, { n: 5, total: 11 }))
    expect(w.find('[data-testid="pdf-fragment-rect"]').exists()).toBe(false)
    w.unmount()
  })

  it('вирізати не вдалося — причина словами, рамка на місці, на дошку нічого', async () => {
    vi.mocked(cutPdfFragment).mockRejectedValueOnce({ response: { status: 507, data: { error: 'quota_exceeded' } } })
    const { w, overlay, place } = await dialog()
    await drag(overlay, 0.1, 0.2, 0.8, 0.3)
    await w.find('[data-testid="pdf-fragment-add"]').trigger('click')
    await flushPromises()
    expect(place).not.toHaveBeenCalled()
    expect(w.find('[data-testid="pdf-fragment-msg"]').text()).toBe(fill(M.cutFailed, { reason: (uk as any).winterboard.pdfFragment.err.quota }))
    expect(w.find('[data-testid="pdf-fragment-rect"]').exists()).toBe(true)
    w.unmount()
  })

  it('сторінку на дошці змінили під час запиту — «збережено в «Матеріалах», не поставлено»', async () => {
    vi.mocked(cutPdfFragment).mockResolvedValueOnce(RES as never)
    const { w, overlay } = await dialog({ place: vi.fn(() => 'not_placed') })
    await drag(overlay, 0.1, 0.2, 0.8, 0.3)
    await w.find('[data-testid="pdf-fragment-add"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="pdf-fragment-msg"]').text()).toBe(fill(M.notPlaced, { name: RES.name }))
    w.unmount()
  })

  it('Word / PowerPoint: сторінки беремо з картинок цього документа; старий без PDF-версії — пояснення', async () => {
    const { getDocumentPageUrl } = await import('../../../composables/useDocumentPageCache')
    vi.mocked(cutPdfFragment).mockRejectedValueOnce({ response: { status: 409, data: { error: 'not_ready' } } })
    const { w, overlay } = await dialog({ contentType: 'document' })
    expect(vi.mocked(getDocumentPageUrl)).toHaveBeenLastCalledWith(5, 'document', 3)
    await drag(overlay, 0.1, 0.2, 0.8, 0.3)
    await w.find('[data-testid="pdf-fragment-add"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="pdf-fragment-msg"]').text()).toBe(fill(M.cutFailed, { reason: (uk as any).winterboard.pdfFragment.err.notReady }))
    w.unmount()
  })

  it('◀ ▶ гортають і скидають рамку; Esc і «Готово» закривають', async () => {
    const { w, overlay } = await dialog()
    await drag(overlay, 0.1, 0.2, 0.8, 0.3)
    await w.find('[data-testid="pdf-fragment-next"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="pdf-fragment-page"]').text()).toBe(fill(M.page, { n: 5, total: 11 }))
    expect(w.find('[data-testid="pdf-fragment-rect"]').exists()).toBe(false)
    await w.find('[data-testid="pdf-fragment-dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(1)
    await w.find('[data-testid="pdf-fragment-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
    w.unmount()
  })
})
