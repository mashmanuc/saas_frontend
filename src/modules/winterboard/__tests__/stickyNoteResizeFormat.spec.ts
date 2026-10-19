// Скарга тестувальника 2026-10-11: «не можу збільшити або видозмінити нотатку».
// Причини (відтворено на стенді): (1) виділення нотатки не чіпляло трансформер — ручок розміру не
// було; (2) кінець трансформації не скидав масштаб вузла й губив позицію; (3) форматування на
// панелі виділення показувалось лише для тексту, а панель властивостей нотатки з кімнати прибрано.
// Ручки на полотні звірено наживо (Konva у happy-dom не малюється); тут — розмір/позиція/формат.

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref, computed } from 'vue'
import { useStickyNotes } from '../composables/useStickyNotes'
import type { WBAsset } from '../types/winterboard'

vi.mock('../composables/useDeviceMode', () => ({
  useDeviceMode: () => ({
    deviceMode: computed(() => 'desktop'),
    isMobile: computed(() => false),
    isTablet: computed(() => false),
    isDesktop: computed(() => true),
    isDisplay: computed(() => false),
    inputMode: ref('mouse'),
    isTouchInput: ref(false),
    isPenInput: ref(false),
    hasMultipleInputModes: ref(false),
    orientation: ref('landscape'),
    isLandscape: ref(true),
    state: ref({}),
  }),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../composables/useObjectAudio', () => ({
  useObjectAudio: () => ({
    recordingState: ref('idle'), hasAudio: ref(false), isPlaying: ref(false), isUploading: ref(false),
    error: ref(null), recordingDuration: ref(0), startRecording: vi.fn(), stopRecording: vi.fn(),
    cancelRecording: vi.fn(), play: vi.fn(), pause: vi.fn(), deleteAudio: vi.fn(),
  }),
  formatTime: (s: number) => String(s),
  isRecordingSupported: () => false,
}))

const STICKY: WBAsset = {
  id: 'n1', type: 'sticky', src: '', x: 400, y: 200, w: 200, h: 150, rotation: 0,
  text: 'Це дошка', bgColor: '#fde047', textColor: '#1e293b', fontSize: 14,
} as WBAsset

describe('нотатка: кінець зміни розміру ручками', () => {
  // Konva-компоненти — прості заглушки; подію transformend віддаємо руками, як це робить Konva.
  const VGroup = defineComponent({ name: 'VGroup', emits: ['transformend'], setup: (_p, { slots }) => () => h('div', slots.default?.()) })
  const Leaf = defineComponent({ setup: () => () => h('i') })

  function fakeNode(scaleX: number, scaleY: number, x: number, y: number) {
    const st = { scaleX, scaleY }
    return {
      width: () => 200, height: () => 150, x: () => x, y: () => y,
      scaleX: (v?: number) => (v === undefined ? st.scaleX : (st.scaleX = v)),
      scaleY: (v?: number) => (v === undefined ? st.scaleY : (st.scaleY = v)),
      st,
    }
  }

  async function mountSticky() {
    const WBStickyNote = (await import('../components/canvas/WBStickyNote.vue')).default
    return mount(WBStickyNote, {
      props: { sticky: STICKY, isSelected: true, scale: 1, interactive: true },
      global: { stubs: { 'v-group': VGroup, 'v-rect': Leaf, 'v-text': Leaf } },
    })
  }

  it('масштаб вузла переводиться в розмір і скидається на 1; позиція — разом із розміром', async () => {
    const w = await mountSticky()
    const node = fakeNode(1.5, 2, 380, 170) // тягнули лівий верхній кут
    w.findComponent(VGroup).vm.$emit('transformend', { target: node })
    expect(w.emitted('transformEnd')?.[0]).toEqual(['n1', 300, 300, 380, 170])
    expect(node.st).toEqual({ scaleX: 1, scaleY: 1 })
  })

  it('межі 50…800, як у сховищі', async () => {
    const w = await mountSticky()
    w.findComponent(VGroup).vm.$emit('transformend', { target: fakeNode(10, 0.1, 400, 200) })
    expect(w.emitted('transformEnd')?.[0]).toEqual(['n1', 800, 50, 400, 200])
  })
})

describe('нотатка: збереження розміру й позиції', () => {
  function fakeStore(asset: WBAsset) {
    return {
      currentPage: { assets: [asset] },
      updateAsset: vi.fn(),
      addStickyNote: vi.fn(),
      updateStickyText: vi.fn(),
      updateStickyStyle: vi.fn(),
    }
  }

  it('розмір і зсув — одна операція updateAsset', () => {
    const store = fakeStore(STICKY)
    useStickyNotes(store as never).updateDimensions('n1', 300, 260, 380, 170)
    expect(store.updateAsset).toHaveBeenCalledTimes(1)
    expect(store.updateAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1', w: 300, h: 260, x: 380, y: 170 }))
  })

  it('без позиції — позиція не змінюється (старі виклики)', () => {
    const store = fakeStore(STICKY)
    useStickyNotes(store as never).updateDimensions('n1', 300, 260)
    expect(store.updateAsset).toHaveBeenCalledWith(expect.objectContaining({ x: 400, y: 200, w: 300, h: 260 }))
  })

  it('заблоковану нотатку не змінюємо', () => {
    const store = fakeStore({ ...STICKY, locked: true } as WBAsset)
    useStickyNotes(store as never).updateDimensions('n1', 300, 260, 1, 1)
    expect(store.updateAsset).not.toHaveBeenCalled()
  })
})

describe('нотатка: форматування на панелі виділення', () => {
  async function mountToolbar(selectedObject: unknown) {
    setActivePinia(createPinia())
    const WBSelectionToolbar = (await import('../components/canvas/WBSelectionToolbar.vue')).default
    return mount(WBSelectionToolbar, {
      props: {
        selectedIds: ['n1'], zoom: 1,
        canvasRect: { left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 } as DOMRect,
        mode: 'edit', isLocked: false, bbox: { x: 100, y: 100, w: 200, h: 120 },
        // Проп типізовано як WBStroke, а кімната кладе туди й asset (getObjectById) — як у житті.
        selectedObject: selectedObject as never, sessionId: 's1', isTutor: true,
      },
      global: { stubs: { LinkAttachmentModal: true, Teleport: true } },
    })
  }
  const sizeLabel = (w: Awaited<ReturnType<typeof mountToolbar>>) => w.find('.wb-selection-toolbar__size-label')
  const plus = (w: Awaited<ReturnType<typeof mountToolbar>>) => w.find('button[title="Збільшити шрифт"]')

  it('нотатка: є розмір шрифту, показує її fontSize; «+» пише в fontSize', async () => {
    const w = await mountToolbar(STICKY)
    expect(sizeLabel(w).text()).toBe('14')
    await plus(w).trigger('click')
    expect(w.emitted('text-format')?.[0]).toEqual([{ fontSize: 16 }])
  })

  it('нотатка без fontSize — типовий 14, як малює WBStickyNote', async () => {
    const w = await mountToolbar({ ...STICKY, fontSize: undefined })
    expect(sizeLabel(w).text()).toBe('14')
  })

  it('нотатка: жирний пише fontWeight', async () => {
    const w = await mountToolbar(STICKY)
    await w.find('button[title="winterboard.selection.bold"]').trigger('click')   // «Bold» → «Жирний» (власник 19.10: підписи українською)
    expect(w.emitted('text-format')?.[0]).toEqual([{ fontWeight: 700 }])
  })

  it('текст — як і раніше: розмір у size', async () => {
    const w = await mountToolbar({ id: 't1', tool: 'text', size: 16, points: [], color: '#000', opacity: 1 })
    expect(sizeLabel(w).text()).toBe('16')
    await plus(w).trigger('click')
    expect(w.emitted('text-format')?.[0]).toEqual([{ size: 20 }])
  })

  it('широкий тулбар біля лівого краю не виходить за полотно (центр ≥ пів ширини від краю)', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600)
    try {
      setActivePinia(createPinia())
      const WBSelectionToolbar = (await import('../components/canvas/WBSelectionToolbar.vue')).default
      const w = mount(WBSelectionToolbar, {
        props: {
          selectedIds: ['n1'], zoom: 1,
          canvasRect: { left: 56, top: 0, right: 1200, bottom: 800, width: 1144, height: 800 } as DOMRect,
          mode: 'edit', isLocked: false, bbox: { x: 10, y: 300, w: 100, h: 80 },
          selectedObject: STICKY as never, sessionId: 's1', isTutor: true,
        },
        global: { stubs: { LinkAttachmentModal: true, Teleport: true } },
      })
      await w.vm.$nextTick()
      await w.vm.$nextTick()
      const left = parseFloat((w.find('.wb-selection-toolbar').element as HTMLElement).style.left)
      expect(left).toBeGreaterThanOrEqual(56 + 300)
    } finally {
      spy.mockRestore()
    }
  })

  it('картинка — без форматування тексту', async () => {
    const w = await mountToolbar({ id: 'i1', type: 'image', src: 'x', x: 0, y: 0, w: 10, h: 10, rotation: 0 })
    expect(sizeLabel(w).exists()).toBe(false)
  })
})

describe('нотатка: колір тла на панелі виділення (власник 2026-10-11: «роби кольори нотатки»)', () => {
  async function mountToolbar(selectedObject: unknown, extra: Record<string, unknown> = {}) {
    setActivePinia(createPinia())
    const WBSelectionToolbar = (await import('../components/canvas/WBSelectionToolbar.vue')).default
    return mount(WBSelectionToolbar, {
      props: {
        selectedIds: ['n1'], zoom: 1,
        canvasRect: { left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 } as DOMRect,
        mode: 'edit', isLocked: false, bbox: { x: 300, y: 300, w: 200, h: 120 },
        selectedObject: selectedObject as never, sessionId: 's1', isTutor: true, ...extra,
      },
      global: { stubs: { LinkAttachmentModal: true, Teleport: true } },
    })
  }
  const btn = (w: Awaited<ReturnType<typeof mountToolbar>>) => w.find('[data-test="sticky-color-btn"]')
  /** Колір зі style у hex: браузер віддає rgb(), happy-dom — як записали. */
  const hex = (css: string) => {
    const m = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (!m) return (css.match(/#[0-9a-f]{6}/i)?.[0] ?? css).toLowerCase()
    return '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
  }
  const dot = (w: Awaited<ReturnType<typeof mountToolbar>>) =>
    hex((btn(w).find('.wb-selection-toolbar__color-dot').element as HTMLElement).style.background)

  it('кружечок показує поточний колір нотатки', async () => {
    const w = await mountToolbar({ ...STICKY, bgColor: '#93c5fd' })
    expect(dot(w)).toBe('#93c5fd')
  })

  it('без поля bgColor — типовий жовтий, з яким нотатку малюють', async () => {
    const w = await mountToolbar({ ...STICKY, bgColor: undefined })
    expect(dot(w)).toBe('#fde047')
  })

  it('клік → сітка з 6 кольорів палітри; вибір пише bgColor і закриває сітку', async () => {
    const w = await mountToolbar(STICKY)
    expect(w.find('.wb-sticky-picker').exists()).toBe(false)
    await btn(w).trigger('click')
    const swatches = w.findAll('.wb-sticky-picker__swatch')
    expect(swatches).toHaveLength(6)
    // активний — поточний колір нотатки
    expect(hex(w.find('.wb-sticky-picker__swatch--active').attributes('style') ?? '')).toBe('#fde047')
    await swatches[1].trigger('click') // зелений
    expect(w.emitted('text-format')?.[0]).toEqual([{ bgColor: '#86efac' }])
    expect(w.find('.wb-sticky-picker').exists()).toBe(false)
  })

  it('виділили інший обʼєкт — відкрита сітка закривається', async () => {
    const w = await mountToolbar(STICKY)
    await btn(w).trigger('click')
    expect(w.find('.wb-sticky-picker').exists()).toBe(true)
    await w.setProps({ selectedIds: ['n2'] })
    expect(w.find('.wb-sticky-picker').exists()).toBe(false)
  })

  it('заблокована нотатка — кнопка кольору неактивна', async () => {
    const w = await mountToolbar(STICKY, { isLocked: true })
    expect(btn(w).attributes('disabled')).toBeDefined()
  })

  it('текст і картинка — кнопки кольору нотатки немає', async () => {
    const t = await mountToolbar({ id: 't1', tool: 'text', size: 16, points: [], color: '#000', opacity: 1 })
    expect(btn(t).exists()).toBe(false)
    const i = await mountToolbar({ id: 'i1', type: 'image', src: 'x', x: 0, y: 0, w: 10, h: 10, rotation: 0 })
    expect(btn(i).exists()).toBe(false)
  })
})
