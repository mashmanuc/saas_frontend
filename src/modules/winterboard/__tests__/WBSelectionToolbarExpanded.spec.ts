// 2026-08-16: тулбар виділення ховається для об'єкта, розгорнутого на всю
// сторінку (⛶). Живий випадок власника: розгорнув графічний калькулятор →
// розгортання авто-виділяє об'єкт → тулбар (↑↓⧉🔒🗑…) встав за bbox СТАРОГО
// положення, тобто посеред розгорнутого графіка, і накрив криві.
//
// Правило: розгорнутий об'єкт дошки не займає → дії тулбара про місце на
// дошці для нього беззмістовні → тулбара немає. Ховаємо ЛИШЕ коли розгорнутий
// об'єкт серед виділених: стан expandedAssetId переживає перемикання сторінки,
// і на іншій сторінці він не має глушити тулбар для інших об'єктів.

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref, computed } from 'vue'

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

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

// Аудіо-composable тягне API-клієнт і MediaRecorder — для видимості тулбара
// він неістотний, тому підмінюємо мінімальним стабом.
vi.mock('../composables/useObjectAudio', () => ({
  useObjectAudio: () => ({
    recordingState: ref('idle'),
    hasAudio: ref(false),
    isPlaying: ref(false),
    isUploading: ref(false),
    error: ref(null),
    recordingDuration: ref(0),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    cancelRecording: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    deleteAudio: vi.fn(),
  }),
  formatTime: (s: number) => String(s),
  isRecordingSupported: () => false,
}))

const BBOX = { x: 100, y: 100, w: 200, h: 120 }
const CANVAS_RECT = { left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 } as DOMRect

async function mountToolbar(props: Record<string, unknown>) {
  setActivePinia(createPinia())
  const WBSelectionToolbar = (await import('../components/canvas/WBSelectionToolbar.vue')).default
  return mount(WBSelectionToolbar, {
    props: {
      selectedIds: ['g1'],
      zoom: 1,
      canvasRect: CANVAS_RECT,
      mode: 'edit',
      isLocked: false,
      bbox: BBOX,
      selectedObject: null,
      sessionId: 's1',
      isTutor: true,
      ...props,
    },
    global: {
      stubs: { LinkAttachmentModal: true, Teleport: true },
    },
  })
}

describe('WBSelectionToolbar × розгорнутий на всю сторінку об’єкт', () => {
  it('без розгортання (expandedAssetId=null) тулбар видимий', async () => {
    const w = await mountToolbar({ expandedAssetId: null })
    expect(w.find('.wb-selection-toolbar').exists()).toBe(true)
  })

  it('виділений об’єкт розгорнутий → тулбара немає', async () => {
    const w = await mountToolbar({ expandedAssetId: 'g1' })
    expect(w.find('.wb-selection-toolbar').exists()).toBe(false)
  })

  it('розгорнутий ІНШИЙ об’єкт (не серед виділених) → тулбар лишається', async () => {
    // Стан пережив перемикання сторінки: g1 розгорнутий на сторінці 1, а тут
    // виділили g2 — його тулбар не має глушитись чужим розгортанням.
    const w = await mountToolbar({ selectedIds: ['g2'], expandedAssetId: 'g1' })
    expect(w.find('.wb-selection-toolbar').exists()).toBe(true)
  })

  it('згортання (expandedAssetId → null) повертає тулбар без переви­ділення', async () => {
    const w = await mountToolbar({ expandedAssetId: 'g1' })
    expect(w.find('.wb-selection-toolbar').exists()).toBe(false)
    await w.setProps({ expandedAssetId: null })
    expect(w.find('.wb-selection-toolbar').exists()).toBe(true)
  })

  it('prop не передано (старі виклики) → поведінка як раніше: видимий', async () => {
    const w = await mountToolbar({})
    expect(w.find('.wb-selection-toolbar').exists()).toBe(true)
  })
})
