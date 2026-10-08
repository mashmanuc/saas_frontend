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

vi.mock('../api/library', () => ({ uploadAsset: vi.fn() }))

import RemotePhotoPanel from '../components/remote/RemotePhotoPanel.vue'
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
