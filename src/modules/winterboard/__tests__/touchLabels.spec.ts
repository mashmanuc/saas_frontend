/**
 * Прохід «очима вчителя 60 років» (2026-10-19) → власник 2026-10-20: «1, 5 роби».
 *  1 — на планшеті й великій дошці немає наведення, тож назви значків були недосяжні: тепер під значком слово
 *      (`useNoHoverLabels`), на ноутбуці з мишкою — як було.
 *  5 — у вкладці «Інструменти» назви словами вчителя («Графіки», «Геометрія»…), назва програми — дрібно під ними.
 * Media-запитів jsdom не обчислює — `matchMedia` підміняємо; кімнати звіряємо в тексті шаблону.
 */
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import soloRoomSource from '../views/WBSoloRoom.vue?raw'
import classroomSource from '../views/WBClassroomRoom.vue?raw'
import { MASH_APPS } from '../components/sidebar/insertRegistry'
import { NO_HOVER_QUERY } from '../composables/useNoHoverLabels'

const ICON_STUBS = {
  WBIconPen: true, WBIconHighlighter: true, WBIconEraser: true, WBIconLine: true,
  WBIconRectangle: true, WBIconCircle: true, WBIconText: true, WBIconSelect: true,
  WBIconUndo: true, WBIconRedo: true, WBIconTrash: true, WBIconLaser: true,
  WBIconSticky: true, WBIconLock: true, WBIconUnlock: true,
}

function stubMatchMedia(noHover: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === NO_HOVER_QUERY ? noHover : false,
    media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
}

async function mountToolbar(props: Record<string, unknown> = {}) {
  const WBToolbar = (await import('../components/toolbar/WBToolbar.vue')).default
  return mount(WBToolbar, {
    props: { variant: 'tablet', ...props } as never,
    global: { stubs: ICON_STUBS, mocks: { $t: (key: string) => key } },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('1: слова під значками там, де немає мишки', () => {
  it('планшет без наведення — під кожним інструментом і дією є слово; панель ширша', async () => {
    stubMatchMedia(true)
    const w = await mountToolbar()
    expect(w.classes()).toContain('wb-toolbar--labelled')
    // 10 інструментів + скасувати/повторити/очистити + YouTube + формула
    const labels = w.findAll('.wb-toolbar__label')
    expect(labels.length).toBe(15)
    for (const l of labels) expect(l.text().trim()).not.toBe('')
  })

  it('ноутбук із мишкою — без слів (як було, назва при наведенні)', async () => {
    stubMatchMedia(false)
    const w = await mountToolbar({ variant: 'desktop' })
    expect(w.classes()).not.toContain('wb-toolbar--labelled')
    expect(w.findAll('.wb-toolbar__label')).toHaveLength(0)
  })

  it('телефон — без слів навіть без наведення (там своя смуга й пульт)', async () => {
    stubMatchMedia(true)
    const w = await mountToolbar({ variant: 'mobile' })
    expect(w.findAll('.wb-toolbar__label')).toHaveLength(0)
  })

  it('верхня смуга уроку: учень, пульт, поділитися, експорт (сам) і екран, пульт, малювання, ↩ ↪, YouTube (клас)', () => {
    for (const key of ['invite', 'remote', 'share', 'export']) {
      expect(soloRoomSource).toContain(`winterboard.touchLabels.${key}`)
    }
    for (const key of ['fullscreen', 'exitFullscreen', 'remote', 'lockDrawing', 'unlockDrawing', 'undo', 'redo', 'youtube']) {
      expect(classroomSource).toContain(`winterboard.touchLabels.${key}`)
    }
    expect((soloRoomSource.match(/'wb-header-btn--labelled': noHoverLabels/g) ?? []).length).toBe(4)
    expect((classroomSource.match(/'wb-header-btn--labelled': noHoverLabels/g) ?? []).length).toBe(6)
  })

  it('слова є всіма трьома мовами, ті самі ключі', () => {
    const keys = (o: { winterboard: { touchLabels: Record<string, string> } }) => Object.keys(o.winterboard.touchLabels).sort()
    expect(keys(en as never)).toEqual(keys(uk as never))
    expect(keys(ru as never)).toEqual(keys(uk as never))
    expect((uk as never as { winterboard: { touchLabels: Record<string, string> } }).winterboard.touchLabels.laser).toBe('Указка')
  })
})

describe('5: назви інструментів словами вчителя', () => {
  it('картки — «Графіки», «Графіки 3D», «Геометрія», «Стереометрія»; назва програми — окремо, дрібно', () => {
    const apps = (uk as never as { winterboard: { contentSidebar: { apps: Record<string, string> } } })
      .winterboard.contentSidebar.apps
    const shown = MASH_APPS.filter(a => a.app !== 'content').map(a => {
      const key = a.labelKey.split('.').pop() as string
      return [apps[key], a.brand]
    })
    expect(shown).toEqual([
      ['Графіки', 'GraphMASH 2D'], ['Графіки 3D', 'GraphMASH 3D'], ['Геометрія', 'GeoMASH'], ['Стереометрія', 'StereoMASH'],
    ])
    for (const loc of [en, ru]) {
      expect(Object.keys((loc as never as { winterboard: { contentSidebar: { apps: object } } }).winterboard.contentSidebar.apps).sort())
        .toEqual(Object.keys(apps).sort())
    }
  })
})

describe('6: вертикальний планшет', () => {
  it('поворот вписує сторінку заново — лише після першого вписування й без ручного масштабу', async () => {
    const { shouldRefitAfterRotate } = await import('../board/rotateFit')
    const base = { initialFitDone: true, userZoomed: false }
    expect(shouldRefitAfterRotate({ ...base, prevLandscape: false, landscape: true })).toBe(true)   // вертикаль → горизонталь
    expect(shouldRefitAfterRotate({ ...base, prevLandscape: true, landscape: false })).toBe(true)   // і назад
    expect(shouldRefitAfterRotate({ ...base, prevLandscape: true, landscape: true })).toBe(false)   // відкрили панель — не поворот
    expect(shouldRefitAfterRotate({ ...base, prevLandscape: null, landscape: true })).toBe(false)   // перший вимір
    expect(shouldRefitAfterRotate({ ...base, userZoomed: true, prevLandscape: false, landscape: true })).toBe(false)
    expect(shouldRefitAfterRotate({ ...base, initialFitDone: false, prevLandscape: false, landscape: true })).toBe(false)
  })

  it('кімната: вертикаль — по ширині й підказка «поверніть»; підказка лише на дотику й закривається', () => {
    expect(soloRoomSource).toContain('isPortraitTablet.value ? canvasRef.value?.fitToWidth : canvasRef.value?.fitToPage')
    expect(soloRoomSource).toContain('isPortraitTablet.value && noHoverLabels.value && !rotateHintDismissed.value')
    for (const loc of [uk, en, ru]) {
      const hint = (loc as never as { winterboard: { rotateHint: { text: string; ok: string } } }).winterboard.rotateHint
      expect(hint.text.length).toBeGreaterThan(10)
      expect(hint.ok.length).toBeGreaterThan(1)
    }
  })
})
