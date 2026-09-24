/**
 * Дефект із живого уроку: Geometry2D не зберігав перемикачі («Медіани»,
 * «Висоти», «Бісектриси»…). Після reload картка поверталась у вихідний стан.
 *
 * ЧОМУ ЖОДЕН ТЕСТ ЙОГО НЕ ЛОВИВ
 *
 * Механізм у рендерері ВЕСЬ на місці: `wireToolbarPersistence` вішає слухач на
 * тулбар, `emitDataPatch` формує `update:asset`, `applyPersistedToggles`
 * відновлює стан із `data.toggles`. Тест, який перевіряє «слухач є» або «емiт
 * оголошено», буде зеленим. А реального кліку по кнопці не перевіряв ніхто.
 *
 * ЩО ТУТ СПРАВЖНЄ
 *
 * Тулбар будує САМ vendor (`geo2d-card.js`, `makeGeoToolbar`) — не копія й не
 * підробка: у ньому й ховається причина. Підмінений лише геометричний рушій
 * (`window.Geo2D`), бо полотно в happy-dom не малюється; кнопки, їхні власні
 * обробники й порядок подій — автентичні.
 *
 * Клік нижче — справжній `click` по справжній кнопці тулбара.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import type { WBAsset } from '../types/winterboard'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))
// Завантаження bundle у рендерері — side-effect import; рушій ставимо самі нижче.
vi.mock('../vendor/geo2d', () => ({}))

const TOGGLES = ['medians', 'altitudes', 'bisectors']
const LABELS: Record<string, string> = {
  medians: 'Медіани', altitudes: 'Висоти', bisectors: 'Бісектриси',
}

/** Мінімальний рушій: тільки те, чого `GeoCard` торкається. Геометрії тут
 *  немає навмисно — перевіряємо не математику, а збереження перемикача. */
function installEngine() {
  const applied: Array<[string, boolean]> = []
  ;(window as any).Geo2D = {
    Construction: class { objects: unknown[] = []; recompute() {} get() { return null } },
    Renderer: class {
      opts: Record<string, unknown> = { showGrid: false, showAxes: false }
      onChange: (() => void) | null = null
      constructor(_el: unknown, _con: unknown, defaults: Record<string, unknown>) {
        this.opts = { showGrid: false, showAxes: false, ...defaults }
      }
      render() {}
      destroy() {}
      setOption(k: string, v: unknown) { this.opts[k] = v }
    },
    PRESETS: {
      triangle: {
        build() {},
        defaults: {},
        toggles: TOGGLES.map((key) => ({
          key, label: LABELS[key], icon: '◦', default: false,
          apply(_con: unknown, on: boolean) { applied.push([key, on]) },
        })),
      },
    },
  }
  return applied
}

/** Стара картка: `data.toggles` ще немає — саме такі лежать на живих дошках. */
function oldCard(): WBAsset {
  return {
    id: 'g1', type: 'geometry_2d_v2', src: '', x: 0, y: 0, w: 600, h: 420,
    rotation: 0, locked: false, data: { version: 2, preset: 'triangle' },
  } as unknown as WBAsset
}

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

async function mountCard(asset: WBAsset) {
  const Geometry2DRenderer = (await import('../components/board/objects/Geometry2DRenderer.vue')).default
  const w = mount(Geometry2DRenderer, {
    props: { asset: asset as never, isSelected: true, interactive: true },
    global: { plugins: [i18n()] },
    attachTo: document.body,
  })
  await flushPromises()
  return w
}

const toolButton = (w: any, key: string) => w.find(`button.tool[data-key="${key}"]`)

let applied: Array<[string, boolean]> = []

beforeEach(async () => {
  applied = installEngine()
  // Справжній vendor: він читає `window.Geo2D` на завантаженні, тож рушій — вище.
  // side-effect: IIFE реєструє `window.GeoCard` і `window.makeGeoToolbar`.
  // Файл не є ES-модулем, тож шлях віддаємо через змінну — інакше tsc шукає типи.
  const vendorCard = '../vendor/geo2d/geo2d-card.js'
  await import(/* @vite-ignore */ vendorCard)
})

afterEach(() => {
  vi.resetModules()
  document.body.innerHTML = ''
})

describe('Geometry2D · тулбар будує справжній vendor', () => {
  it('кнопки пресета існують і мають data-key', async () => {
    const w = await mountCard(oldCard())
    for (const key of TOGGLES) expect(toolButton(w, key).exists()).toBe(true)
    w.unmount()
  })
})

describe('клік по перемикачу старої картки', () => {
  it.each(TOGGLES)('«%s»: один клік → рівно один asset_update із новим toggles', async (key) => {
    const asset = oldCard()
    const w = await mountCard(asset)

    await toolButton(w, key).trigger('click')
    await Promise.resolve()
    await flushPromises()

    const emitted = w.emitted('update:asset')
    expect(emitted, 'клік не породив жодного update:asset').toBeTruthy()
    expect(emitted).toHaveLength(1)

    const next = (emitted as any[])[0][0]
    expect(next.data.toggles[key]).toBe(true)
    // решта даних картки ціла — патч, а не заміна
    expect(next.data.preset).toBe('triangle')
    expect(next.id).toBe(asset.id)
    w.unmount()
  })

  it('повторний клік вимикає перемикач і теж дає рівно один update', async () => {
    const w = await mountCard(oldCard())
    await toolButton(w, 'medians').trigger('click')
    await Promise.resolve()
    await flushPromises()
    await toolButton(w, 'medians').trigger('click')
    await Promise.resolve()
    await flushPromises()

    const emitted = w.emitted('update:asset') as any[]
    expect(emitted).toHaveLength(2)
    expect(emitted[0][0].data.toggles.medians).toBe(true)
    expect(emitted[1][0].data.toggles.medians).toBe(false)
    w.unmount()
  })

  it('два різні перемикачі накопичуються, а не перетирають один одного', async () => {
    const w = await mountCard(oldCard())
    await toolButton(w, 'medians').trigger('click')
    await Promise.resolve()
    await flushPromises()

    // дошка застосувала перший патч і повернула оновлений asset
    const first = (w.emitted('update:asset') as any[])[0][0]
    await w.setProps({ asset: first })

    await toolButton(w, 'altitudes').trigger('click')
    await Promise.resolve()
    await flushPromises()

    const second = (w.emitted('update:asset') as any[])[1][0]
    expect(second.data.toggles).toEqual({ medians: true, altitudes: true, bisectors: false })
    w.unmount()
  })
})

describe('порядок подій справжнього кліку (2026-09-24)', () => {
  // На справжньому кліку браузер виконує мікрозадачі МІЖ слухачами. Стара
  // обгортка читала стан vendor-а в мікрозадачі з capture-слухача — тобто ДО
  // обробника кнопки — і зберігала попередній стан: «Описане» вмикалось з
  // другого кліку й у стан дошки не потрапляло. Програмний `trigger('click')`
  // тримає мікрозадачі до кінця dispatch, тому тести вище цього не бачили.
  // Звідси вимога: патч народжується СИНХРОННО, у тому ж dispatch, і вже з
  // новим значенням — тоді порядок мікрозадач не має значення.
  it('update:asset з новим значенням — одразу в dispatch кліку, без мікрозадач', async () => {
    const w = await mountCard(oldCard())
    ;(toolButton(w, 'medians').element as HTMLButtonElement).click()
    const emitted = w.emitted('update:asset') as any[] | undefined
    expect(emitted, 'патч чекає мікрозадачі — на живому кліку збережеться старий стан').toBeTruthy()
    expect(emitted![0][0].data.toggles.medians).toBe(true)
    w.unmount()
  })

  it('«Скинути» теж зберігає стан одразу — дефолтні перемикачі', async () => {
    const asset = oldCard()
    ;(asset as any).data.toggles = { medians: true }
    const w = await mountCard(asset)
    ;(w.find('button.tool[data-key="reset"]').element as HTMLButtonElement).click()
    const emitted = w.emitted('update:asset') as any[] | undefined
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1][0].data.toggles.medians).toBe(false)
    expect(toolButton(w, 'medians').classes()).not.toContain('active')
    w.unmount()
  })
})

describe('стан переживає reload', () => {
  it('картка зі збереженими toggles відновлює їх на монтуванні', async () => {
    const asset = oldCard()
    ;(asset as any).data.toggles = { medians: true, altitudes: false }
    const w = await mountCard(asset)
    // саме це робить `applyPersistedToggles` — інакше після reload картка порожня
    expect(applied).toContainEqual(['medians', true])
    w.unmount()
  })
})
