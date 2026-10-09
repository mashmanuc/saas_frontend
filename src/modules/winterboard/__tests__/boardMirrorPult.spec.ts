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
    expect(w.text()).toContain('сторінки 2')
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

    /** Кадри йдуть щоSAMPLE_MS (400 мс) — фальшивий годинник */
    async function advance(ms: number) {
      for (let t = 0; t < ms; t += 400) {
        vi.advanceTimersByTime(400)
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
        expect(w.find('[data-testid="mirror-save-now"]').text()).toBe(M.saveWaiting)
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

  it('«Почніть малювати тут» не лягає поверх фото-фону (знімка дошки) на ноутбуці', () => {
    const room = read('views/WBSoloRoom.vue')
    expect(room).toMatch(/v-if="!isLoading && isCanvasEmpty && !isImageBackground\(store\.currentPage\?\.background\)"\s*class="wb-empty-canvas-hint"/)
  })
})
