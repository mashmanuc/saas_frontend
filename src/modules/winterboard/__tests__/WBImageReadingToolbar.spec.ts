/**
 * «Що прочитав Інтегралик» у тулбарі виділення (ТЗ TZ_IMAGE_READING_CORRECTOR_2026-10-08 §5).
 *
 * Умови: кнопка є лише для ОДНІЄЇ виділеної картинки і лише коли кімната передала дані
 * (`imageReading`, взірець «Зробити фоном сторінки»); учню — ні; клік відкриває вікно з
 * ImageReadingBlock саме для цієї картинки. Справжні: тулбар, кнопка, блок, KaTeX, uk-локаль;
 * мокаються транспорт, стори користувача, маршрут, режим пристрою й аудіо.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { i18n } from '@/i18n'
import WBSelectionToolbar from '../components/canvas/WBSelectionToolbar.vue'
import ImageReadingBlock from '../components/sidebar/properties/ImageReadingBlock.vue'
import { imageReadingTarget } from '../board/imageReadingTarget'
import type { WBAsset } from '../types/winterboard'
import soloRoomSource from '../views/WBSoloRoom.vue?raw'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/utils/apiClient', () => ({ default: api }))
vi.mock('@/utils/notify', () => ({ notifySuccess: vi.fn() }))

const route = vi.hoisted(() => ({ name: 'winterboard-solo', path: '/winterboard/b-1', params: { id: 'b-1' }, meta: {} }))
vi.mock('vue-router', () => ({ useRoute: () => route }))

const authState = vi.hoisted(() => ({ user: null as null | { id: number; role: string } }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => authState }))
const profileState = vi.hoisted(() => ({ settings: null as null | Record<string, unknown> }))
vi.mock('@/modules/profile/store/profileStore', () => ({ useProfileStore: () => profileState }))

vi.mock('../composables/useDeviceMode', () => ({
  useDeviceMode: () => ({ deviceMode: computed(() => 'desktop') }),
}))
vi.mock('../composables/useObjectAudio', () => ({
  useObjectAudio: () => ({
    recordingState: ref('idle'),
    hasAudio: ref(false),
    isPlaying: ref(false),
    isUploading: ref(false),
    error: ref(null),
    recordingDuration: ref(0),
  }),
  formatTime: (s: number) => String(s),
  isRecordingSupported: () => false,
}))

const TARGET = { boardId: 'b-1', boardOwnerId: 7, objectId: 'img-1', imageSrc: 'https://cdn.example/img-1.png' }
const BBOX = { x: 100, y: 100, w: 200, h: 120 }
const CANVAS_RECT = { left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 } as DOMRect

let wrapper: VueWrapper | null = null

async function mountToolbar(props: Record<string, unknown> = {}) {
  wrapper = mount(WBSelectionToolbar, {
    props: {
      selectedIds: ['img-1'],
      zoom: 1,
      canvasRect: CANVAS_RECT,
      mode: 'edit',
      isLocked: false,
      bbox: BBOX,
      selectedObject: null,
      sessionId: 'b-1',
      isTutor: true,
      imageReading: TARGET,
      ...props,
    },
    global: { stubs: { LinkAttachmentModal: true } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const btn = (w: VueWrapper) => w.find('[data-testid="selection-image-reading"]')
const popover = () => document.body.querySelector<HTMLElement>('[data-testid="image-reading-popover"]')

beforeEach(() => {
  i18n.global.locale.value = 'uk'
  authState.user = { id: 7, role: 'tutor' }
  profileState.settings = null
  api.get.mockReset()
  api.get.mockResolvedValue({
    status: 'model',
    segments: [{ type: 'text', text: 'Обчисліть ' }, { type: 'formula', latex: 'x^2' }],
    model: 'm',
    read_at: null,
    can_edit: true,
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('Тулбар виділення — кнопка «Що прочитав Інтегралик»', () => {
  it('одна картинка, кімната передала дані, вчитель-власник → кнопка з підказкою', async () => {
    const w = await mountToolbar()
    expect(btn(w).exists()).toBe(true)
    expect(btn(w).attributes('title')).toBe('Що прочитав Інтегралик')
    // Запиту до відкриття вікна немає.
    expect(api.get).not.toHaveBeenCalled()
  })

  it('кімната не передала дані (не обробляє) — кнопки немає', async () => {
    const w = await mountToolbar({ imageReading: null })
    expect(btn(w).exists()).toBe(false)
  })

  it('виділено два об’єкти — кнопки немає', async () => {
    const w = await mountToolbar({ selectedIds: ['img-1', 'img-2'] })
    expect(btn(w).exists()).toBe(false)
  })

  it('дані кімнати про іншу картинку, ніж виділена, — кнопки немає', async () => {
    const w = await mountToolbar({ selectedIds: ['img-2'] })
    expect(btn(w).exists()).toBe(false)
  })

  it('учню — кнопки немає навіть на його власній дошці, і запиту теж', async () => {
    authState.user = { id: 9, role: 'student' }
    const w = await mountToolbar({ imageReading: { ...TARGET, boardOwnerId: 9 } })
    expect(btn(w).exists()).toBe(false)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('вчитель не власник дошки — кнопки немає', async () => {
    const w = await mountToolbar({ imageReading: { ...TARGET, boardOwnerId: 99 } })
    expect(btn(w).exists()).toBe(false)
  })
})

describe('Тулбар виділення — вікно з блоком', () => {
  it('клік відкриває вікно з ImageReadingBlock саме для цієї картинки', async () => {
    const w = await mountToolbar()
    expect(popover()).toBeNull()
    await btn(w).trigger('click')
    await flushPromises()

    const pop = popover()
    expect(pop).not.toBeNull()
    expect(pop!.querySelector('[data-testid="image-reading"]')).not.toBeNull()
    const block = w.findComponent(ImageReadingBlock)
    expect(block.props('objectId')).toBe('img-1')
    expect(block.props('boardId')).toBe('b-1')
    expect(api.get).toHaveBeenCalledWith('/v1/intents/image-reading/', expect.objectContaining({
      params: { board_id: 'b-1', object_id: 'img-1' },
    }))
    expect(pop!.textContent).toContain('прочитано Інтеграликом')
    expect(document.activeElement).toBe(pop)
  })

  it('Esc і клік поза вікном закривають його', async () => {
    const w = await mountToolbar()
    await btn(w).trigger('click')
    await flushPromises()
    popover()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(popover()).toBeNull()

    await btn(w).trigger('click')
    await flushPromises()
    expect(popover()).not.toBeNull()
    document.body.querySelector<HTMLElement>('[data-testid="image-reading-backdrop"]')!.click()
    await flushPromises()
    expect(popover()).toBeNull()
  })

  it('клавіші у вікні до дошки не доходять (слухач дошки — на document)', async () => {
    const w = await mountToolbar()
    await btn(w).trigger('click')
    await flushPromises()
    const onDocKey = vi.fn()
    document.addEventListener('keydown', onDocKey)
    try {
      popover()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    } finally {
      document.removeEventListener('keydown', onDocKey)
    }
    expect(onDocKey).not.toHaveBeenCalled()
  })

  it('Інтегралик на сервері вимкнено (404 без коду) — вікно не лишається порожнім, кнопка зникає', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('HTTP 404'), {
      response: { status: 404, data: '<!doctype html>', config: { url: '/v1/intents/image-reading/' } },
    }))
    const w = await mountToolbar()
    await btn(w).trigger('click')
    await flushPromises()
    expect(popover()).toBeNull()
    expect(btn(w).exists()).toBe(false)
  })

  it('інша виділена картинка — вікно попередньої закривається', async () => {
    const w = await mountToolbar()
    await btn(w).trigger('click')
    await flushPromises()
    await w.setProps({ selectedIds: ['img-2'], imageReading: { ...TARGET, objectId: 'img-2' } })
    await flushPromises()
    expect(popover()).toBeNull()
  })
})

describe('imageReadingTarget — що кімната передає тулбару', () => {
  const img = (over: Partial<WBAsset> = {}) => ({
    id: 'img-1', type: 'image', src: 'https://cdn.example/img-1.png', x: 0, y: 0, w: 10, h: 10, rotation: 0, ...over,
  }) as WBAsset
  const base = { enabled: true, boardId: 'b-1', boardOwnerId: 7, selectedIds: ['img-1'], assets: [img()] }

  it('одна виділена картинка → дані для блока', () => {
    expect(imageReadingTarget(base)).toEqual(TARGET)
  })

  it('не картинка, дві виділені, data:/blob:, вимкнено, без дошки — нічого', () => {
    expect(imageReadingTarget({ ...base, assets: [img({ type: 'sticky' })] })).toBeNull()
    expect(imageReadingTarget({ ...base, selectedIds: ['img-1', 'img-2'] })).toBeNull()
    expect(imageReadingTarget({ ...base, assets: [img({ src: 'data:image/png;base64,AAAA' })] })).toBeNull()
    expect(imageReadingTarget({ ...base, assets: [img({ src: 'blob:https://m4sh.org/1' })] })).toBeNull()
    expect(imageReadingTarget({ ...base, enabled: false })).toBeNull()
    expect(imageReadingTarget({ ...base, boardId: null })).toBeNull()
  })
})

describe('Кімната уроку — підключення (кімнати в тестах не монтуються, тож звіряємо джерело)', () => {
  it('WBSoloRoom передає тулбару дані картинки лише для власника й не на демо-дошці', () => {
    expect(soloRoomSource).toContain(':image-reading="selectedImageForReading"')
    expect(soloRoomSource).toContain('enabled: isSessionOwner.value && !isLocalWorkspace,')
    expect(soloRoomSource).toContain('boardId: store.workspaceId,')
  })
})
