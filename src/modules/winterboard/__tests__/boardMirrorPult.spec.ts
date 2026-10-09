/**
 * «Операція Дзеркало» на пульті: вхід з аркуша «Фото на дошку», камера (дозвіл, https), кути,
 * закриття вимикає камеру; обв'язка у WBRemoteView — та сама команда photo.background (v1.19).
 * Сам пошук змін і перспектива — boardMirror.spec.ts; наскрізь (камера → фон сторінки) — стенд.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import ru from '../../../i18n/locales/ru.json'

vi.mock('../api/library', () => ({ uploadAsset: vi.fn() }))

import RemotePhotoPanel from '../components/remote/RemotePhotoPanel.vue'
import { uploadAsset } from '../api/library'
import RemoteBoardMirror from '../components/remote/RemoteBoardMirror.vue'
import { SAMPLE_MS } from '../remote/boardMirror'
import { createMirrorFullscreen } from '../remote/mirrorFullscreen'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const M = (uk as unknown as { winterboard: { remote: { mirror: Record<string, Record<string, string> | string> } } }).winterboard.remote.mirror

describe('вхід у дзеркало з аркуша «Фото на дошку»', () => {
  const panel = (over: Record<string, unknown> = {}) => mount(RemotePhotoPanel, {
    props: { ready: true, pageIndex: 0, result: null, send: vi.fn(() => true), sendBackground: vi.fn(() => true), ...over },
    global: { plugins: [i18n()] },
  })

  it('кнопка «Дзеркало дошки» веде в дзеркало', async () => {
    const w = panel()
    const b = w.find('[data-testid="photo-mirror"]')
    expect(b.exists()).toBe(true)
    await b.trigger('click')
    expect(w.emitted('mirror')).toHaveLength(1)
  })

  it('ноутбук не вміє фото-фон (немає sendBackground) — кнопки немає', () => {
    expect(panel({ sendBackground: undefined }).find('[data-testid="photo-mirror"]').exists()).toBe(false)
  })
})

describe('дзеркало: камера і кути', () => {
  let track: { stop: ReturnType<typeof vi.fn>; readyState: string; addEventListener: () => void; removeEventListener: () => void }
  let getUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    track = { stop: vi.fn(), readyState: 'live', addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const stream = { getVideoTracks: () => [track], getTracks: () => [track] }
    getUserMedia = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    // jsdom приймає в srcObject лише справжній MediaStream
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get(this: { _src?: unknown }) { return this._src ?? null },
      set(this: { _src?: unknown }, v: unknown) { this._src = v },
    })
    localStorage.removeItem('wb.mirror.quad')
  })
  afterEach(() => {
    localStorage.removeItem('wb.mirror.quad')
  })

  function mirror(over: Record<string, unknown> = {}) {
    return mount(RemoteBoardMirror, {
      props: { ready: true, pageIndex: 1, result: null, sendBackground: vi.fn(() => true), ...over },
      global: { plugins: [i18n()] },
      attachTo: document.body,
    })
  }

  async function cameraReady(w: ReturnType<typeof mirror>) {
    await flushPromises()
    const v = w.find('[data-testid="mirror-video"]').element as HTMLVideoElement
    Object.defineProperty(v, 'videoWidth', { value: 1280, configurable: true })
    Object.defineProperty(v, 'videoHeight', { value: 720, configurable: true })
    v.dispatchEvent(new Event('loadedmetadata'))
    await flushPromises()
  }

  it('немає дозволу на камеру — причина словами й «Повторити»', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    const w = mirror()
    await flushPromises()
    expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('camera_error')
    expect(w.find('[data-testid="mirror-status"]').text()).toBe((M.cameraError as Record<string, string>).denied)
    expect(w.find('[data-testid="mirror-camera-retry"]').exists()).toBe(true)
    w.unmount()
  })

  it('не https — причина словами, камеру навіть не просимо', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    const w = mirror()
    await flushPromises()
    expect(w.find('[data-testid="mirror-status"]').text()).toBe((M.cameraError as Record<string, string>).insecure)
    expect(getUserMedia).not.toHaveBeenCalled()
    w.unmount()
  })

  it('камера є — задня, без звуку; 4 кути й «Почати» на сторінку ноутбука', async () => {
    const w = mirror()
    await cameraReady(w)
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: 'environment' } }) }))
    expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('calibrate')
    expect(w.findAll('[data-testid^="mirror-corner-"]')).toHaveLength(4)
    // Довга підказка (і номер сторінки в ній) — лише за «?» (ТЗ «зручні кути» §3: смужка коротка)
    expect(w.find('[data-testid="mirror-help"]').exists()).toBe(false)
    await w.find('[data-testid="mirror-help-toggle"]').trigger('click')
    expect(w.find('[data-testid="mirror-help"]').text()).toContain('сторінки 2')
    expect(w.find('[data-testid="mirror-start"]').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('переплутані кути — «Почати» вимкнена, причина словами', async () => {
    localStorage.setItem('wb.mirror.quad', JSON.stringify([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }]))
    const w = mirror()
    await cameraReady(w)
    expect(w.find('[data-testid="mirror-bad-quad"]').exists()).toBe(true)
    expect(w.find('[data-testid="mirror-start"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('немає зв\'язку з дошкою — «Почати» вимкнена', async () => {
    const w = mirror({ ready: false })
    await cameraReady(w)
    expect(w.find('[data-testid="mirror-start"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })

  /**
   * Полотно повертає синтетичний кадр 512×288: сіра стіна, зелена дошка (або без неї; `top` — верхній
   * край дошки на кадрі). `put` — що намальовано на полотні (передперегляд).
   */
  function fakeCanvas(board: boolean, top = 60) {
    const W = 512
    const H = 288
    const data = new Uint8ClampedArray(W * H * 4)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inBoard = board && x >= 100 && x < 420 && y >= top && y < 230
        const c = inBoard ? [30, 72, 44] : [128, 128, 120]
        data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
      }
    }
    const put = vi.fn()
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data, width: W, height: H }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: put,
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    return Object.assign(spy, { put })
  }
  const afterFind = () => new Promise((r) => setTimeout(r, 650))
  const findText = (k: string) => (M.find as Record<string, string>)[k]

  it('камера є — за пів секунди кути самі стають на дошку, підказка «Знайшла дошку»', async () => {
    const spy = fakeCanvas(true)
    const w = mirror()
    await cameraReady(w)
    await afterFind()
    expect(w.find('[data-testid="mirror-find-note"]').text()).toBe(findText('found'))
    expect(w.find('[data-testid="mirror-log"]').text()).toContain(findText('found'))
    expect(w.find('[data-testid="mirror-start"]').attributes('disabled')).toBeUndefined()
    // «Почати» зберігає кути — це кути знайденої дошки (100..420 × 60..230 на кадрі 512×288)
    await w.find('[data-testid="mirror-start"]').trigger('click')
    const q = JSON.parse(localStorage.getItem('wb.mirror.quad') || 'null') as { x: number; y: number }[]
    expect(q[0].x).toBeCloseTo(100 / 512, 1)
    expect(q[0].y).toBeCloseTo(60 / 288, 1)
    expect(q[2].x).toBeCloseTo(420 / 512, 1)
    expect(q[2].y).toBeCloseTo(230 / 288, 1)
    w.unmount()
    spy.mockRestore()
  })

  it('дошки в кадрі немає — «Не знайшла дошку», кути лишаються, «Знайти дошку ще раз» шукає знову', async () => {
    const spy = fakeCanvas(false)
    const w = mirror()
    await cameraReady(w)
    await afterFind()
    expect(w.find('[data-testid="mirror-find-note"]').text()).toBe(findText('notFound'))
    expect(w.findAll('[data-testid^="mirror-corner-"]')).toHaveLength(4)
    spy.mockRestore()
    const spy2 = fakeCanvas(true)
    await w.find('[data-testid="mirror-find"]').trigger('click')
    expect(w.find('[data-testid="mirror-find-note"]').text()).toBe(findText('found'))
    w.unmount()
    spy2.mockRestore()
  })

  const clippedText = (k: string) => (M.clipped as Record<string, string>)[k]

  it('кути при верхньому краї кадру (поставлені рукою) — верхня сторона рамки червона, «Верх дошки поза кадром…»; «Почати» не вимкнена', async () => {
    localStorage.setItem('wb.mirror.quad', JSON.stringify([{ x: 0.1, y: 0.005 }, { x: 0.9, y: 0.01 }, { x: 0.9, y: 0.85 }, { x: 0.1, y: 0.85 }]))
    const w = mirror()
    await cameraReady(w)
    expect(w.find('[data-testid="mirror-edge-top"]').classes()).toContain('is-clipped')
    expect(w.findAll('line.is-clipped')).toHaveLength(1)
    expect(w.find('[data-testid="mirror-clipped-top"]').text()).toBe(clippedText('top'))
    expect(w.find('[data-testid="mirror-clipped-bottom"]').exists()).toBe(false)
    expect(w.find('[data-testid="mirror-start"]').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('кути всередині кадру — ні червоних сторін, ні тексту про обрізаний бік', async () => {
    const w = mirror()
    await cameraReady(w)
    expect(w.findAll('line.is-clipped')).toHaveLength(0)
    expect(w.findAll('[data-testid^="mirror-clipped-"]')).toHaveLength(0)
    w.unmount()
  })

  it('знайдена дошка впирається у верх кадру — бік названо словами, загальне «не вся в кадрі» не дублюється', async () => {
    const spy = fakeCanvas(true, 0)
    const w = mirror()
    await cameraReady(w)
    await afterFind()
    expect(w.find('[data-testid="mirror-clipped-top"]').text()).toBe(clippedText('top'))
    expect(w.find('[data-testid="mirror-edge-top"]').exists()).toBe(true)
    expect(w.find('[data-testid="mirror-find-note"]').exists()).toBe(false)
    expect(w.find('[data-testid="mirror-log"]').text()).toContain(findText('clipped'))
    w.unmount()
    spy.mockRestore()
  })

  it('поки ставлять кути — живий передперегляд «так побачить ноутбук»; поза кутами й після закриття таймера немає', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const spy = fakeCanvas(true)
    try {
      const w = mirror()
      await cameraReady(w)
      const v = w.find('[data-testid="mirror-video"]').element as HTMLVideoElement
      Object.defineProperty(v, 'readyState', { value: 4, configurable: true })
      await afterFind()
      expect(w.find('.wb-mirror__preview figcaption').text()).toBe(M.preview)
      expect(vi.getTimerCount()).toBe(1)
      vi.advanceTimersByTime(500)
      expect(spy.put).toHaveBeenCalledTimes(1)
      // вирівняна дошка 320×180: посередині — зелена дошка, у куті — біле поле (як у знімку)
      const img = spy.put.mock.calls[0][0] as { data: Uint8ClampedArray; width: number; height: number }
      expect([img.width, img.height]).toEqual([320, 180])
      const px = (x: number, y: number) => Array.from(img.data.slice((y * 320 + x) * 4, (y * 320 + x) * 4 + 3))
      expect(px(160, 90)).toEqual([30, 72, 44])
      expect(px(0, 0)).toEqual([255, 255, 255])
      vi.advanceTimersByTime(500)
      expect(spy.put).toHaveBeenCalledTimes(2)

      // «Почати» — передперегляду немає, лишається тільки таймер аналізу
      await w.find('[data-testid="mirror-start"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('running')
      expect(w.find('[data-testid="mirror-preview"]').exists()).toBe(false)
      expect(vi.getTimerCount()).toBe(1)

      // «Кути» — знову передперегляд, аналіз зупинено
      await w.find('[data-testid="mirror-recalibrate"]').trigger('click')
      await flushPromises()
      expect(vi.getTimerCount()).toBe(1)
      vi.advanceTimersByTime(500)
      expect(spy.put).toHaveBeenCalledTimes(3)

      // закрили, поки ставлять кути — ні таймерів, ні полотна
      const cv = w.find('[data-testid="mirror-preview"]').element as HTMLCanvasElement
      w.unmount()
      expect(vi.getTimerCount()).toBe(0)
      expect([cv.width, cv.height]).toEqual([0, 0])
    } finally {
      spy.mockRestore()
      vi.useRealTimers()
    }
  })

  describe('телефон зрушив / дошки не видно (урок 2, 09.10)', () => {
    const W = 512
    const H = 288
    type Box = { x0: number; x1: number; y0: number; y1: number }
    const A: Box = { x0: 100, x1: 420, y0: 60, y1: 230 }
    /** Та сама дошка — телефон зрушив: на кадрі вона лівіше й нижче */
    const B: Box = { x0: 60, x1: 380, y0: 80, y1: 250 }
    const ST = M.status as Record<string, string>
    const LOG = M.log as unknown as Record<string, string>

    /**
     * Сцена, що змінюється: дошка `board` (або стіна), `moving` — щокадру аналізу хтось то є, то немає
     * перед дошкою. `draws` — ширини кадрів, що брались з камери (640 — аналіз, 512 — пошук дошки).
     */
    function stage() {
      const st = { board: A as Box | null, moving: false, person: false, draws: [] as number[] }
      let data = new Uint8ClampedArray(W * H * 4)
      const paint = () => {
        data = new Uint8ClampedArray(W * H * 4)
        const b = st.board
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            let c = b && x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1 ? [30, 72, 44] : [128, 128, 120]
            if (st.person && x >= 150 && x < 300 && y >= 100) c = [70, 50, 90]
            data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
          }
        }
      }
      paint()
      const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage: (_v: unknown, _x: number, _y: number, w: number) => {
          st.draws.push(w)
          if (w === 640 && st.moving) { st.person = !st.person; paint() }
        },
        getImageData: () => ({ data, width: W, height: H }),
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        putImageData: vi.fn(),
        clearRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D)
      const blob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
        cb(new Blob(['x'], { type: 'image/jpeg' }))
      })
      const set = (o: Partial<Pick<typeof st, 'board' | 'moving'>>) => { Object.assign(st, o); st.person = false; paint() }
      return { st, set, blob, restore: () => { spy.mockRestore(); blob.mockRestore() } }
    }

    /** Кадри йдуть щоSAMPLE_MS (з 2026-10-09 — 250 мс) — фальшивий годинник */
    async function advance(ms: number) {
      for (let t = 0; t < ms; t += SAMPLE_MS) {
        vi.advanceTimersByTime(SAMPLE_MS)
        await flushPromises()
      }
    }

    async function running(w: ReturnType<typeof mirror>) {
      await cameraReady(w)
      Object.defineProperty(w.find('[data-testid="mirror-video"]').element, 'readyState', { value: 4, configurable: true })
      await afterFind()
      await w.find('[data-testid="mirror-start"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('running')
    }

    const status = (w: ReturnType<typeof mirror>) => w.find('[data-testid="mirror-status"]').text()
    const logText = (w: ReturnType<typeof mirror>) => w.find('[data-testid="mirror-log"]').text()
    const count = (text: string, part: string) => text.split(part).length - 1

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      vi.mocked(uploadAsset).mockReset()
      vi.mocked(uploadAsset).mockResolvedValue({ id: 7 } as never)
    })
    afterEach(() => { vi.useRealTimers() })

    it('дошки не видно — нічого не надсилається, «Не бачу дошки — поправте телефон», «Зберегти зараз» недоступне з причиною; повернули — продовжує', async () => {
      const sc = stage()
      const send = vi.fn(() => true)
      const w = mirror({ sendBackground: send })
      try {
        await running(w)
        sc.set({ board: null })                      // телефон упав — у кадрі стіна
        await advance(8000)
        expect(status(w)).toBe(ST.lost)
        expect(w.find('[data-testid="mirror-save-now"]').attributes('disabled')).toBeDefined()
        expect(w.find('[data-testid="mirror-save-lost"]').text()).toBe(M.saveLost)
        expect(count(logText(w), LOG.lost)).toBe(1)  // у журнал — один раз на проміжок
        expect(sc.blob).not.toHaveBeenCalled()
        expect(uploadAsset).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()

        sc.set({ board: A })                         // поставили як було
        await advance(6000)
        expect(status(w)).not.toBe(ST.lost)
        expect(logText(w)).toContain(LOG.boardBack)
        expect(send).toHaveBeenCalledTimes(1)
      } finally {
        w.unmount()
        sc.restore()
      }
    })

    it('телефон зрушив — кути самі переїхали на дошку, «Телефон зрушив — кути поставлено заново», наступний знімок — як перший', async () => {
      const sc = stage()
      const send = vi.fn((_a: { request_id: string }) => true)
      const w = mirror({ sendBackground: send })
      try {
        await running(w)
        await advance(2000)
        expect(send).toHaveBeenCalledTimes(1)
        await w.setProps({ result: { request_id: send.mock.calls[0][0].request_id, status: 'placed' } })
        await flushPromises()

        sc.set({ board: B })
        await advance(8000)
        expect(status(w)).toBe(ST.moved)
        expect(logText(w)).toContain(LOG.moved.split(' · ')[0])
        const q = JSON.parse(localStorage.getItem('wb.mirror.quad') || 'null') as { x: number; y: number }[]
        expect(q[0].x).toBeCloseTo(B.x0 / W, 1)
        expect(q[0].y).toBeCloseTo(B.y0 / H, 1)
        expect(q[2].x).toBeCloseTo(B.x1 / W, 1)
        expect(q[2].y).toBeCloseTo(B.y1 / H, 1)
        // порівняння з нуля: знімок дошки на новому місці пішов «першим»
        expect(send).toHaveBeenCalledTimes(2)
        expect(count(logText(w), (M.log as unknown as { sent: Record<string, string> }).sent.first.split(' · ')[0])).toBe(2)
      } finally {
        w.unmount()
        sc.restore()
      }
    })

    it('«Зберегти зараз» — не одразу, а щойно кадр тихий; перед дошкою весь час рух — не довше 3 с; пошук дошки — лише на тихому кадрі', async () => {
      const sc = stage()
      const send = vi.fn((_a: { request_id: string }) => true)
      const w = mirror({ sendBackground: send })
      try {
        sc.set({ board: A, moving: true })
        await running(w)
        const detectsAtStart = sc.st.draws.filter((x) => x === 512).length
        await advance(4000)
        expect(sc.blob).not.toHaveBeenCalled()       // рух — автоматичного знімка немає
        expect(sc.st.draws.filter((x) => x === 512).length).toBe(detectsAtStart)   // і пошуку дошки теж

        await w.find('[data-testid="mirror-save-now"]').trigger('click')
        // «Чекаю тиші» — у смужці над кадром (у вузькій колонці кнопки — лише коротке слово), кнопка вимкнена
        expect(w.find('[data-testid="mirror-save-waiting"]').text()).toBe(M.saveWaiting)
        expect(w.find('[data-testid="mirror-save-now"]').attributes('disabled')).toBeDefined()
        await advance(2400)
        expect(sc.blob).not.toHaveBeenCalled()
        await advance(1200)
        expect(sc.blob).toHaveBeenCalledTimes(1)     // 3 с минуло — знімок усе одно
        await w.setProps({ result: { request_id: send.mock.calls[0][0].request_id, status: 'placed' } })
        await flushPromises()

        sc.blob.mockClear()
        await advance(6000)
        sc.set({ moving: false })
        await w.find('[data-testid="mirror-save-now"]').trigger('click')
        await advance(400)
        expect(sc.blob).not.toHaveBeenCalled()       // кадр ще не тихий
        await advance(1600)
        expect(sc.blob).toHaveBeenCalledTimes(1)     // тихо — знімок (раніше за 3 с)
      } finally {
        w.unmount()
        sc.restore()
      }
    })
  })

  it('телефон повернули, поки ставили кути — «Почати» з першого разу, без «Телефон повернули» (уроки 09.10)', async () => {
    let spy = fakeCanvas(false)                                                          // вертикально дошки не видно
    const w = mirror()
    await flushPromises()
    const v = w.find('[data-testid="mirror-video"]').element as HTMLVideoElement
    // камера ввімкнулась, поки телефон стояв вертикально
    Object.defineProperty(v, 'videoWidth', { value: 720, configurable: true })
    Object.defineProperty(v, 'videoHeight', { value: 1280, configurable: true })
    v.dispatchEvent(new Event('loadedmetadata'))
    await flushPromises()
    await afterFind()
    expect(w.find('[data-testid="mirror-find-note"]').text()).toBe(findText('notFound'))
    spy.mockRestore()
    spy = fakeCanvas(true)
    // повернули горизонтально — кадр змінив розмір
    Object.defineProperty(v, 'videoWidth', { value: 1280, configurable: true })
    Object.defineProperty(v, 'videoHeight', { value: 720, configurable: true })
    v.dispatchEvent(new Event('resize'))
    await afterFind()
    expect(w.find('[data-testid="mirror-find-note"]').text()).toBe(findText('found'))   // дошку знайдено під нову орієнтацію
    await w.find('[data-testid="mirror-start"]').trigger('click')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 900))                                         // кілька tick-ів
    expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('running')
    expect(w.find('[data-testid="mirror-log"]').text()).not.toContain((M.log as Record<string, string>).rotated)
    w.unmount()
    spy.mockRestore()
  })

  // ── ТЗ «швидше, без учителя, зручні кути» (2026-10-09) ──

  /** Сцена на весь екран телефона: сцена 839×412 (915×412 мінус колонка кнопок), кадр 1280×720 */
  async function sized(w: ReturnType<typeof mirror>, cw = 839, ch = 412) {
    await cameraReady(w)
    const stage = w.find('[data-testid="mirror-stage"]').element as HTMLElement
    Object.defineProperty(stage, 'clientWidth', { value: cw, configurable: true })
    Object.defineProperty(stage, 'clientHeight', { value: ch, configurable: true })
    ;(w.find('[data-testid="mirror-video"]').element as HTMLVideoElement).dispatchEvent(new Event('resize'))
    await flushPromises()
    const s = Math.min(cw / 1280, ch / 720)
    return { s, dw: 1280 * s, dh: 720 * s, ox: (cw - 1280 * s) / 2, oy: (ch - 720 * s) / 2 }
  }
  const px = (style: string | undefined, prop: 'left' | 'top') => Number(new RegExp(`${prop}: (-?[\\d.]+)px`).exec(style ?? '')![1])

  it('кнопки — у колонці поза кадром: на кадрі лише кружечки (і «👁»); кути — лише на кадрі (ТЗ «зручні кути» §3)', async () => {
    const w = mirror()
    await cameraReady(w)
    const stage = w.find('[data-testid="mirror-stage"]').element
    const rail = w.find('[data-testid="mirror-rail"]').element
    expect(stage.contains(rail) || rail.contains(stage)).toBe(false)
    for (const id of ['mirror-start', 'mirror-find', 'mirror-help-toggle', 'mirror-close']) {
      expect(rail.contains(w.find(`[data-testid="${id}"]`).element)).toBe(true)
    }
    expect(w.findAll('[data-testid^="mirror-corner-"]').every((h) => stage.contains(h.element))).toBe(true)
    const onFrame = w.findAll('[data-testid="mirror-stage"] button').filter((b) => b.isVisible())
      .map((b) => b.attributes('data-testid'))
    expect(onFrame.every((id) => /^mirror-corner-\d$/.test(id ?? ''))).toBe(true)
    // «Почати» — перша кнопка колонки
    expect(w.findAll('[data-testid="mirror-rail"] button')[0].attributes('data-testid')).toBe('mirror-start')
    // у роботі — так само: усе керування в колонці
    await w.find('[data-testid="mirror-start"]').trigger('click')
    await flushPromises()
    for (const id of ['mirror-save-now', 'mirror-pause', 'mirror-recalibrate', 'mirror-journal-toggle', 'mirror-stop', 'mirror-close']) {
      expect(rail.contains(w.find(`[data-testid="${id}"]`).element)).toBe(true)
    }
    w.unmount()
  })

  it('стан і попередження — одна смужка поверх кадру; журнал — за кнопкою «Журнал»', async () => {
    const w = mirror()
    await cameraReady(w)
    const strip = w.find('[data-testid="mirror-strip"]')
    expect(w.find('[data-testid="mirror-stage"]').element.contains(strip.element)).toBe(true)
    expect(strip.text()).toBe((M.status as Record<string, string>).calibrate)
    await w.find('[data-testid="mirror-start"]').trigger('click')
    await flushPromises()
    const journal = w.find('[data-testid="mirror-journal"]')
    expect(journal.isVisible()).toBe(false)
    expect(w.find('[data-testid="mirror-log"]').text()).toContain('Почато')   // записи є, поки панель закрита
    await w.find('[data-testid="mirror-journal-toggle"]').trigger('click')
    expect(journal.isVisible()).toBe(true)
    await w.find('[data-testid="mirror-journal-close"]').trigger('click')
    expect(journal.isVisible()).toBe(false)
    w.unmount()
  })

  it('кружечок тягнуть — лупа над пальцем із кадром навколо кута ×2,5; кут іде на зсув пальця, не стрибає під палець; відпустили — лупи немає', async () => {
    const draws: unknown[][] = []
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: (...a: unknown[]) => { draws.push(a) },
      clearRect: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    try {
      const w = mirror()
      const g = await sized(w)
      const loupe = w.find('[data-testid="mirror-loupe"]')
      const src = 110 / 2.5 / g.s                                  // пікселів кадру в лупі
      const loupeCall = () => { const c = draws.filter((a) => a.length === 9); return c[c.length - 1] }
      // ── лівий нижній кут (0,12; 0,85): місця над пальцем досить — лупа над ним
      const h3 = w.find('[data-testid="mirror-corner-3"]')
      const c3 = { x: g.ox + 0.12 * g.dw, y: g.oy + 0.85 * g.dh }
      expect(px(h3.attributes('style'), 'left')).toBeCloseTo(c3.x, 3)
      expect(loupe.isVisible()).toBe(false)
      // узяли не в центрі (на 10 px правіше, на 6 нижче)
      await h3.trigger('pointerdown', { clientX: c3.x + 10, clientY: c3.y + 6, pointerId: 1 })
      expect(loupe.isVisible()).toBe(true)
      expect(px(loupe.attributes('style'), 'top') + 110).toBeLessThan(c3.y + 6)      // уся лупа вище пальця
      let call = loupeCall()
      expect(call[0]).toBe(w.find('[data-testid="mirror-video"]').element)
      expect(call[1] as number).toBeCloseTo(0.12 * 1280 - src / 2, 3)
      expect(call[2] as number).toBeCloseTo(0.85 * 720 - src / 2, 3)
      expect([call[3], call[4]]).toEqual([src, src])
      expect(call.slice(5)).toEqual([0, 0, 220, 220])
      // повели на (+30, −20): кут — на стільки ж, а не під палець
      await h3.trigger('pointermove', { clientX: c3.x + 40, clientY: c3.y - 14, pointerId: 1 })
      expect(px(h3.attributes('style'), 'left')).toBeCloseTo(c3.x + 30, 3)
      expect(px(h3.attributes('style'), 'top')).toBeCloseTo(c3.y - 20, 3)
      call = loupeCall()
      expect(call[1] as number).toBeCloseTo((0.12 + 30 / g.dw) * 1280 - src / 2, 3)
      expect(call[2] as number).toBeCloseTo((0.85 - 20 / g.dh) * 720 - src / 2, 3)
      await h3.trigger('pointerup', { pointerId: 1 })
      expect(loupe.isVisible()).toBe(false)
      const q = JSON.parse(localStorage.getItem('wb.mirror.quad') || 'null') as { x: number; y: number }[]
      expect(q[3].x).toBeCloseTo(0.12 + 30 / g.dw, 5)
      expect(q[3].y).toBeCloseTo(0.85 - 20 / g.dh, 5)
      // ── лівий верхній кут: над пальцем місця немає — лупа під ним
      const h0 = w.find('[data-testid="mirror-corner-0"]')
      const c0 = { x: g.ox + 0.12 * g.dw, y: g.oy + 0.15 * g.dh }
      await h0.trigger('pointerdown', { clientX: c0.x, clientY: c0.y, pointerId: 2 })
      expect(loupe.isVisible()).toBe(true)
      expect(px(loupe.attributes('style'), 'top')).toBeGreaterThan(c0.y)
      await h0.trigger('pointercancel', { pointerId: 2 })
      expect(loupe.isVisible()).toBe(false)
      w.unmount()
    } finally {
      spy.mockRestore()
    }
  })

  it('передперегляд — віконце 160×90 у кадрі там, де немає кружечків; торкнулись — сховано, «👁» — знову', async () => {
    const box = (w: ReturnType<typeof mirror>) => {
      const st = w.find('[data-testid="mirror-preview-box"]').attributes('style')
      return { x: px(st, 'left'), y: px(st, 'top'), w: 160, h: 90 }
    }
    const handles = (w: ReturnType<typeof mirror>) => w.findAll('[data-testid^="mirror-corner-"]')
      .map((h) => ({ x: px(h.attributes('style'), 'left'), y: px(h.attributes('style'), 'top') }))
    const clear = (r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }) =>
      Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h)) > 26
    // кути ближче до центру — віконце в лівому нижньому куті кадру
    localStorage.setItem('wb.mirror.quad', JSON.stringify([{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }]))
    let w = mirror()
    let g = await sized(w)
    expect(box(w).x).toBeCloseTo(g.ox + 8, 3)
    expect(box(w).y).toBeCloseTo(g.oy + g.dh - 8 - 90, 3)
    w.unmount()
    // кути за замовчуванням (12–15 % від країв): у кожному куті кадру віконце лягло б на кружечок
    localStorage.removeItem('wb.mirror.quad')
    w = mirror()
    g = await sized(w)
    expect(handles(w).every((p) => clear(box(w), p))).toBe(true)
    // вертикальний телефон: сцена 412×839
    w.unmount()
    w = mirror()
    g = await sized(w, 412, 839)
    expect(handles(w).every((p) => clear(box(w), p))).toBe(true)
    w.unmount()
    // тісно всюди (вертикальний телефон, кадр 412×232): кружечки біля всіх шести місць — віконце там, де до
    // найближчого кружечка найдалі (тут — лівий верхній кут кадру, кружечки під ним за 18,5 px)
    const at = (x: number, y: number) => ({ x: x / g.dw, y: (y - g.oy) / g.dh })
    localStorage.setItem('wb.mirror.quad', JSON.stringify([at(150, g.oy + 116.5), at(300, g.oy + 116.5), at(300, g.oy + 226.5), at(150, g.oy + 226.5)]))
    w = mirror()
    g = await sized(w, 412, 839)
    expect(box(w).x).toBeCloseTo(g.ox + 8, 3)
    expect(box(w).y).toBeCloseTo(g.oy + 8, 3)
    // торкнулись — сховано (кадр видно цілком), «👁» — знову
    const fig = w.find('[data-testid="mirror-preview-box"]')
    await fig.trigger('click')
    expect(fig.isVisible()).toBe(false)
    await w.find('[data-testid="mirror-preview-show"]').trigger('click')
    expect(fig.isVisible()).toBe(true)
    expect(w.find('[data-testid="mirror-preview-show"]').exists()).toBe(false)
    w.unmount()
  })

  describe('склейка на пульті (ТЗ «без учителя» §2)', () => {
    const W = 512
    const H = 288
    const BOARD = { x0: 100, x1: 420, y0: 60, y1: 230 }
    /** Учитель (темний одяг) стоїть справа, від низу кадру; у русі — то тут, то там */
    const STAND = { x0: 360, x1: 512, y0: 100 }
    type Rect = { x0: number; x1: number; y0: number; y1: number }
    const L1: Rect = { x0: 120, x1: 300, y0: 80, y1: 84 }
    const NEW: Rect = { x0: 130, x1: 200, y0: 150, y1: 155 }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      vi.mocked(uploadAsset).mockReset()
      vi.mocked(uploadAsset).mockResolvedValue({ id: 7 } as never)
    })
    afterEach(() => { vi.useRealTimers() })

    it('учитель став справа, ліворуч дописано — знімок одразу; під учителем — пікселі попереднього знімка, людини немає; журнал «без учителя»', async () => {
      const st = { marks: [L1] as Rect[], person: null as { x0: number; x1: number; y0: number } | null, moving: false, k: 0 }
      let data = new Uint8ClampedArray(W * H * 4)
      const paint = () => {
        data = new Uint8ClampedArray(W * H * 4)
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            let c = x >= BOARD.x0 && x < BOARD.x1 && y >= BOARD.y0 && y < BOARD.y1 ? [30, 72, 44] : [128, 128, 120]
            if (st.marks.some((m) => x >= m.x0 && x < m.x1 && y >= m.y0 && y < m.y1)) c = [235, 235, 230]
            const p = st.person
            if (p && x >= p.x0 && x < p.x1 && y >= p.y0) c = [25, 25, 30]
            data.set([c[0], c[1], c[2], 255], (y * W + x) * 4)
          }
        }
      }
      paint()
      const puts: Uint8ClampedArray[] = []
      const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage: (_v: unknown, _x: number, _y: number, w: number) => {
          if (w === 640 && st.moving) { st.k++; st.person = { x0: 150 + (st.k % 4) * 50, x1: 280 + (st.k % 4) * 50, y0: 100 }; paint() }
        },
        getImageData: () => ({ data, width: W, height: H }),
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        putImageData: (img: { data: Uint8ClampedArray }) => { puts.push(Uint8ClampedArray.from(img.data)) },
        clearRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D)
      const blob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
        cb(new Blob(['x'], { type: 'image/jpeg' }))
      })
      const send = vi.fn((_a: { request_id: string }) => true)
      const w = mirror({ sendBackground: send })
      const advance = async (ms: number) => {
        for (let t = 0; t < ms; t += SAMPLE_MS) { vi.advanceTimersByTime(SAMPLE_MS); await flushPromises() }
      }
      try {
        await flushPromises()
        const v = w.find('[data-testid="mirror-video"]').element as HTMLVideoElement
        Object.defineProperty(v, 'videoWidth', { value: W, configurable: true })
        Object.defineProperty(v, 'videoHeight', { value: H, configurable: true })
        Object.defineProperty(v, 'readyState', { value: 4, configurable: true })
        v.dispatchEvent(new Event('loadedmetadata'))
        await flushPromises()
        await new Promise((r) => setTimeout(r, 650))           // автопошук кутів
        puts.length = 0                                          // передперегляд — не знімок
        await w.find('[data-testid="mirror-start"]').trigger('click')
        await flushPromises()
        await advance(2000)
        expect(send).toHaveBeenCalledTimes(1)                    // перший знімок: дошка без людини
        await w.setProps({ result: { request_id: send.mock.calls[0][0].request_id, status: 'placed' } })
        await flushPromises()
        // учитель пише ліворуч (рух), потім стає справа нерухомо
        st.marks = [L1, NEW]
        st.moving = true
        await advance(1500)
        st.moving = false
        st.person = STAND
        paint()
        await advance(1500)
        expect(send).toHaveBeenCalledTimes(2)
        const LOG = M.log as unknown as { sent: Record<string, string> }
        expect(w.find('[data-testid="mirror-log"]').text()).toContain(LOG.sent.covered.split(' · ')[0])
        expect(puts).toHaveLength(2)
        const [first, second] = puts
        // знімок 1600×900: дошка 320×170 на кадрі → вписана на всю ширину, 850 заввишки, з 25-го рядка
        const at = (img: Uint8ClampedArray, u: number, v: number) => {
          const o = ((25 + Math.floor(v * 850)) * 1600 + Math.floor(u * 1600)) * 4
          return Array.from(img.subarray(o, o + 3))
        }
        // де стоїть учитель (u ≥ 0,81, v ≥ 0,24) — як у попередньому знімку: зелена дошка, не людина
        for (const [u, v] of [[0.9, 0.5], [0.85, 0.8], [0.97, 0.95]]) expect(at(second, u, v)).toEqual(at(first, u, v))
        // новий напис ліворуч — свіжий
        expect(at(second, (165 - 100) / 320, (152 - 60) / 170)[0]).toBeGreaterThan(200)
        expect(at(first, (165 - 100) / 320, (152 - 60) / 170)[0]).toBeLessThan(100)
        // темних пікселів (людини) на знімку немає
        let dark = 0
        for (let i = 25 * 1600 * 4; i < 875 * 1600 * 4; i += 4 * 7) if (second[i] < 45 && second[i + 1] < 45) dark++
        expect(dark).toBe(0)
      } finally {
        w.unmount()
        spy.mockRestore()
        blob.mockRestore()
      }
    })
  })

  it('«×» — камеру вимкнено, дзеркало закривається', async () => {
    const w = mirror()
    await cameraReady(w)
    await w.find('[data-testid="mirror-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
    expect(track.stop).toHaveBeenCalled()
  })
})

describe('пульт: обв\'язка', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8')

  it('«після очікування» — нейтрально, скільки чекали й скільки змінилось, без «стерли дошку?» (урок 2: дошку не стирали)', () => {
    type Loc = { winterboard: { remote: { mirror: { log: { sent: Record<string, string> } } } } }
    for (const loc of [uk, en, ru] as unknown as Loc[]) {
      const s = loc.winterboard.remote.mirror.log.sent.after_wait
      expect(s).toContain('{sec}')
      expect(s).toContain('{change}')
      expect(s).not.toMatch(/стерли|стёрли|erased|\?/)
    }
    const tr = (i18n() as unknown as { global: { t: (key: string, params: Record<string, unknown>) => string } }).global.t
    expect(tr('winterboard.remote.mirror.log.sent.after_wait', { sec: 10, change: '0.6', kb: 90, ms: 600 }))
      .toBe('Надіслано після 10 с очікування · змінилось 0.6% · 90 КБ · 600 мс')
    expect(read('components/remote/RemoteBoardMirror.vue')).toMatch(/sec: Math\.round\(MIRROR_TUNING\.personAcceptMs \/ 1000\)/)
  })

  it('дзеркало кладе знімок тією ж командою photo.background (v1.19), нових команд немає', () => {
    const view = read('views/WBRemoteView.vue')
    expect(view).toMatch(/<RemoteBoardMirror[\s\S]*?:send-background="sendPhotoBackground"/)
    expect(view).toMatch(/function openMirror\(\): void \{\s*closeSheet\(\)/)
    const mirror = read('components/remote/RemoteBoardMirror.vue')
    expect(mirror).toContain('PHOTO_UPLOAD_PURPOSE')
    expect(mirror).not.toMatch(/sendCmd|photo\.add/)
  })

  it('повний екран — лише на дотик учителя (відкриття Дзеркала з пульта), вихід — коли Дзеркало закрилось', () => {
    const view = read('views/WBRemoteView.vue')
    expect(view).toMatch(/function openMirror\(\): void \{\s*closeSheet\(\)\s*mirrorOpen\.value = true\s*mirrorFs\.enter\(\)/)
    expect(view).toMatch(/function closeMirror\(\): void \{\s*mirrorOpen\.value = false\s*mirrorFs\.leave\(\)/)
    expect(view).toMatch(/<RemoteBoardMirror[\s\S]*?@close="closeMirror"/)
    expect(view).toMatch(/watch\(\(\) => mirrorOpen\.value && !!pair\.value, \(shown\) => \{ if \(!shown\) mirrorFs\.leave\(\) \}\)/)
    expect(view).toMatch(/onBeforeUnmount\(\(\) => \{[^}]*?mirrorFs\.leave\(\)/)
    // ні пульт, ні Дзеркало не просять повний екран напряму (з onMounted браузер відмовить — це не дія вчителя)
    expect(view).not.toMatch(/requestFullscreen/)
    expect(read('components/remote/RemoteBoardMirror.vue')).not.toMatch(/requestFullscreen/)
  })

  it('«Почніть малювати тут» не лягає поверх фото-фону (знімка дошки) на ноутбуці', () => {
    const room = read('views/WBSoloRoom.vue')
    expect(room).toMatch(/v-if="!isLoading && isCanvasEmpty && !isImageBackground\(store\.currentPage\?\.background\)"\s*class="wb-empty-canvas-hint"/)
  })
})

describe('повний екран Дзеркала (ТЗ «зручні кути» §3)', () => {
  /** Фальшивий document: `requestFullscreen` (за потреби — відмова), `exitFullscreen`, `fullscreenElement` */
  function fakeDoc(o: { supported?: boolean; reject?: boolean; manual?: boolean } = {}) {
    let confirm: () => void = () => undefined
    const doc = {
      fullscreenElement: null as Element | null,
      exitFullscreen: vi.fn(async () => { doc.fullscreenElement = null }),
      documentElement: {} as { requestFullscreen?: (opts?: FullscreenOptions) => Promise<void> },
    }
    const req = vi.fn((_opts?: FullscreenOptions) => {
      if (o.reject) return Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
      return new Promise<void>((resolve) => {
        confirm = () => { doc.fullscreenElement = document.body; resolve() }
        if (!o.manual) confirm()
      })
    })
    if (o.supported !== false) doc.documentElement.requestFullscreen = req
    return { doc, req, confirm: () => confirm() }
  }

  it('відкрили Дзеркало — повний екран без смуги браузера; закрили — виходимо', async () => {
    const { doc, req } = fakeDoc()
    const fs = createMirrorFullscreen(doc)
    fs.enter()
    expect(req).toHaveBeenCalledWith({ navigationUI: 'hide' })
    await flushPromises()
    expect(fs.entered).toBe(true)
    fs.leave()
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(fs.entered).toBe(false)
    fs.leave()
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('не вміє (iPhone) — нічого не просимо й не падаємо; закрили — нічого не робимо', async () => {
    const { doc } = fakeDoc({ supported: false })
    const fs = createMirrorFullscreen(doc)
    expect(() => fs.enter()).not.toThrow()
    await flushPromises()
    fs.leave()
    expect(doc.exitFullscreen).not.toHaveBeenCalled()
  })

  it('відмовлено — причина в onError, Дзеркало працює далі; при закритті не виходимо (ми не входили)', async () => {
    const { doc } = fakeDoc({ reject: true })
    const onError = vi.fn()
    const fs = createMirrorFullscreen(doc, onError)
    fs.enter()
    await flushPromises()
    expect(onError).toHaveBeenCalledWith('enter', 'NotAllowedError')
    expect(fs.entered).toBe(false)
    fs.leave()
    expect(doc.exitFullscreen).not.toHaveBeenCalled()
  })

  it('учитель сам вийшов із повного екрана (жест «назад») — при закритті exitFullscreen не кличемо', async () => {
    const { doc } = fakeDoc()
    const fs = createMirrorFullscreen(doc)
    fs.enter()
    await flushPromises()
    doc.fullscreenElement = null
    fs.leave()
    expect(doc.exitFullscreen).not.toHaveBeenCalled()
  })

  it('закрили раніше, ніж браузер підтвердив вхід, — виходимо, щойно підтвердив', async () => {
    const { doc, confirm } = fakeDoc({ manual: true })
    const fs = createMirrorFullscreen(doc)
    fs.enter()
    fs.leave()
    expect(doc.exitFullscreen).not.toHaveBeenCalled()
    confirm()
    await flushPromises()
    expect(doc.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(doc.fullscreenElement).toBeNull()
  })

  it('сторінка вже на весь екран не через Дзеркало — не входимо й при закритті не виходимо', async () => {
    const { doc, req } = fakeDoc()
    doc.fullscreenElement = document.body
    const fs = createMirrorFullscreen(doc)
    fs.enter()
    await flushPromises()
    expect(req).not.toHaveBeenCalled()
    fs.leave()
    expect(doc.exitFullscreen).not.toHaveBeenCalled()
  })
})
