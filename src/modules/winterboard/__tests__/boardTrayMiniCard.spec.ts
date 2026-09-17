/**
 * TLV2-RC1.1 · мінікартка трею і її меню (ТЗ 45).
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * Живий дефект: у меню «⋯» уже був пункт «Видалити з дошки», але власник його
 * не бачив — popup жив усередині трею з `overflow-x: auto` і обрізався. Старий тест
 * перевіряв лише emit, тож зелений тест не ловив невидимого меню. Тут перевіряємо
 * саме структуру: меню поза скролом, над карткою, у межах viewport, одне на раз.
 *
 * ІНВАРІАНТИ
 *   MINI-1  мінікартка: маркер типу, назва, тип другорядно, окрема «⋯»; невідомий тип — fallback
 *   MINI-2  основна частина → рівно один restore; «⋯» restore не викликає
 *   MINI-3  «⋯» і правий клік — те саме меню; одночасно не більше одного
 *   MINI-4  меню телепортоване в body: не нащадок скролу трею; fixed над карткою в межах viewport
 *   MINI-5  пункти «Повернути на дошку» · separator · «Видалити з дошки» (з кошиком)
 *   MINI-6  видалення → рівно один delete з id картки; полотно лишається на штатному asset-delete
 *   MINI-7  заблокована: пункт видно, disabled, причина поруч; delete не йде
 *   MINI-8  закриття: другий клік, клік поза меню, Escape, зміна сторінки, зникнення вкладки
 *   MINI-9  багато вкладок + горизонтальний скрол: меню останньої видно й воно їде за карткою
 *   MINI-10 учень, replay і не-edit не отримують трею, а отже й меню
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import WBBoardTray from '../components/canvas/WBBoardTray.vue'
import { canShowTray } from '../board/boardTray'
import { trayCardFamily, trayMenuPosition, trayMonogram } from '../board/boardTrayPresentation'
import type { WBAsset } from '../types/winterboard'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')
const TRAY_SFC = 'modules/winterboard/components/canvas/WBBoardTray.vue'
const CANVAS_SFC = 'modules/winterboard/components/canvas/WBCanvas.vue'

const TAB = '[data-testid="wb-board-tray-tab"]'
const MENU_BTN = '[data-testid="wb-board-tray-menu"]'
const RESTORE = '[data-testid="wb-board-tray-restore"]'
const RAIL = '[data-testid="wb-board-tray-rail"]'
const DELETE = '[data-testid="wb-board-tray-delete"]'

function card(id: string, type: string, extra: Record<string, unknown> = {}): WBAsset {
  return {
    id, type, src: '', x: 100, y: 200, w: 300, h: 150, rotation: 0, locked: false, minimized: true,
    data: { version: 1, title: `Картка ${id}` },
    ...extra,
  } as unknown as WBAsset
}

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const mounted: VueWrapper[] = []
const cleanups: Array<() => void> = []

function mountTray(items: WBAsset[]) {
  const w = mount(WBBoardTray, { props: { items }, attachTo: document.body, global: { plugins: [i18n()] } })
  mounted.push(w)
  return w
}

function unmountTray(w: VueWrapper) {
  mounted.splice(mounted.indexOf(w), 1)
  w.unmount()
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  while (cleanups.length) cleanups.pop()!()
  document.body.innerHTML = ''
})

const popups = () => Array.from(document.body.querySelectorAll<HTMLElement>('[data-testid="wb-board-tray-popup"]'))
function popup(): HTMLElement {
  const list = popups()
  expect(list).toHaveLength(1)
  return list[0]
}
const flush = async () => { await nextTick(); await nextTick() }

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

/** jsdom не рахує layout: viewport і розмір меню задаємо явно. */
function stubLayout(viewport: { width: number; height: number }, menu: { width: number; height: number }) {
  const proto = HTMLElement.prototype
  const ow = Object.getOwnPropertyDescriptor(proto, 'offsetWidth')!
  const oh = Object.getOwnPropertyDescriptor(proto, 'offsetHeight')!
  const iw = Object.getOwnPropertyDescriptor(window, 'innerWidth')
  const ih = Object.getOwnPropertyDescriptor(window, 'innerHeight')
  const isMenu = (el: HTMLElement) => el.dataset?.testid === 'wb-board-tray-popup'
  Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isMenu(this) ? menu.width : 0 } })
  Object.defineProperty(proto, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return isMenu(this) ? menu.height : 0 } })
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: viewport.width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: viewport.height })
  cleanups.push(() => {
    Object.defineProperty(proto, 'offsetWidth', ow)
    Object.defineProperty(proto, 'offsetHeight', oh)
    if (iw) Object.defineProperty(window, 'innerWidth', iw)
    if (ih) Object.defineProperty(window, 'innerHeight', ih)
  })
}

// ─── MINI-1 ─────────────────────────────────────────────────────────────────

describe('MINI-1 · мінікартка згорнутого вікна', () => {
  it('маркер типу, назва, тип другорядним підписом і окрема кнопка «⋯»', () => {
    const w = mountTray([card('t', 'theory_card', { data: { title: 'Подібність трикутників' } })])
    const tab = w.get(TAB)
    expect(tab.attributes('data-family')).toBe('text')
    expect(tab.classes()).toContain('wb-board-tray__card--text')
    expect(tab.get('[data-testid="wb-board-tray-marker"]').text()).toBe('Т')
    expect(tab.get('[data-testid="wb-board-tray-title"]').text()).toBe('Подібність трикутників')
    expect(tab.get('[data-testid="wb-board-tray-kind"]').text()).toBe('Теорія')

    const restore = tab.get(RESTORE)
    const menuBtn = tab.get(MENU_BTN)
    expect(restore.element.contains(menuBtn.element)).toBe(false)
    expect(restore.attributes('aria-label')).toBe('Повернути на дошку: Подібність трикутників')
    expect(menuBtn.attributes('aria-haspopup')).toBe('menu')
    expect(menuBtn.attributes('aria-expanded')).toBe('false')
    expect(menuBtn.attributes('aria-label')).toBe('Дії з карткою «Подібність трикутників»')
  })

  it('невідомий тип без назви — нейтральна мінікартка «Картка», а не порожня вкладка', () => {
    const w = mountTray([card('x', 'future_widget', { data: {} })])
    const tab = w.get(TAB)
    expect(tab.attributes('data-family')).toBe('generic')
    expect(tab.get('[data-testid="wb-board-tray-marker"]').text()).toBe('К')
    expect(tab.get('[data-testid="wb-board-tray-title"]').text()).toBe('Картка')
    expect(tab.find('[data-testid="wb-board-tray-kind"]').exists()).toBe(false)
  })

  it('родини й монограма — чисте подання за типом', () => {
    expect(trayCardFamily('nmt_task')).toBe('task')
    expect(trayCardFamily('geometry_2d_v2')).toBe('math')
    expect(trayCardFamily('visual_capsule')).toBe('animation')
    expect(trayCardFamily('image')).toBe('media')
    expect(trayCardFamily('zzz')).toBe('generic')
    expect(trayMonogram('задача')).toBe('З')
    expect(trayMonogram('   ')).toBe('•')
  })
})

// ─── MINI-2 / MINI-3 ────────────────────────────────────────────────────────

describe('MINI-2/3 · основна частина повертає, «⋯» і правий клік відкривають одне меню', () => {
  it('клік по основній частині — один restore; «⋯» restore не викликає', async () => {
    const w = mountTray([card('a', 'nmt_task'), card('b', 'geometry_2d_v2')])
    await w.findAll(MENU_BTN)[1].trigger('click')
    await flush()
    expect(w.emitted('restore')).toBeUndefined()
    expect(popup().dataset.assetId).toBe('b')

    await w.findAll(RESTORE)[1].trigger('click')
    expect(w.emitted('restore')).toEqual([['b']])
    expect(w.emitted('delete')).toBeUndefined()
  })

  it('«⋯» і правий клік відкривають те саме меню; одночасно — лише одне', async () => {
    const w = mountTray([card('a', 'theory_card'), card('b', 'nmt_task')])
    const tabs = w.findAll(TAB)
    const describeMenu = (el: HTMLElement) => ({
      id: el.id,
      label: el.getAttribute('aria-label'),
      parts: Array.from(el.querySelectorAll('[data-testid], [role]')).map(n => n.getAttribute('data-testid') ?? n.getAttribute('role')),
    })

    await tabs[0].get(MENU_BTN).trigger('click')
    await flush()
    const viaButton = describeMenu(popup())
    expect(tabs[0].get(MENU_BTN).attributes('aria-controls')).toBe(viaButton.id)
    expect(tabs[0].get(MENU_BTN).attributes('aria-expanded')).toBe('true')

    await tabs[0].get(MENU_BTN).trigger('click')
    await flush()
    expect(popups()).toHaveLength(0)

    const ctx = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    tabs[0].element.dispatchEvent(ctx)
    await flush()
    expect(ctx.defaultPrevented).toBe(true)
    expect(describeMenu(popup())).toEqual(viaButton)

    tabs[1].element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    await flush()
    expect(popup().dataset.assetId).toBe('b')
    expect(tabs[0].get(MENU_BTN).attributes('aria-expanded')).toBe('false')
    expect(tabs[1].get(MENU_BTN).attributes('aria-expanded')).toBe('true')
  })
})

// ─── MINI-4 ─────────────────────────────────────────────────────────────────

describe('MINI-4 · меню не обрізається скролом трею', () => {
  it('popup — у body, не нащадок rail і не нащадок трею', async () => {
    const w = mountTray([card('a', 'theory_card')])
    await w.get(MENU_BTN).trigger('click')
    await flush()
    const p = popup()
    expect(w.get(RAIL).element.contains(p)).toBe(false)
    expect(w.element.contains(p)).toBe(false)
    expect(p.parentElement).toBe(document.body)
  })

  it('CSS: скролить лише внутрішній rail; меню — fixed над полотном і треєм', () => {
    const sfc = read(TRAY_SFC)
    const style = sfc.slice(sfc.indexOf('<style scoped>'))
    const block = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const m = style.match(new RegExp(`\\n${escaped} \\{([^}]*)\\}`))
      expect(m, selector).not.toBeNull()
      return m![1]
    }
    expect(block('.wb-board-tray')).not.toMatch(/overflow/)
    expect(block('.wb-board-tray__rail')).toMatch(/overflow-x: auto/)
    expect(block('.wb-board-tray-menu')).toMatch(/position: fixed/)
    expect(block('.wb-board-tray-menu')).toMatch(/z-index: 9999/)
    expect(sfc).toMatch(/<Teleport to="body">\s*<div\s+v-if="menuItem"/)
  })

  it('меню стає над мінікарткою, праве ребро — по картці', async () => {
    stubLayout({ width: 1280, height: 800 }, { width: 212, height: 120 })
    const w = mountTray([card('a', 'theory_card'), card('b', 'nmt_task')])
    ;(w.findAll(TAB)[1].element as HTMLElement).getBoundingClientRect = () => rect(900, 700, 200, 44)
    await w.findAll(MENU_BTN)[1].trigger('click')
    await flush()
    const p = popup()
    expect(p.dataset.placement).toBe('above')
    expect(p.style.visibility).not.toBe('hidden')
    expect(p.style.left).toBe(`${1100 - 212}px`)
    expect(p.style.top).toBe(`${700 - 6 - 120}px`)
  })

  it('позиція: над карткою; бракує місця згори — під нею; завжди в межах viewport', () => {
    const vp = { width: 1000, height: 700 }
    const menu = { width: 200, height: 100 }
    expect(trayMenuPosition(rect(500, 600, 180, 44), menu, vp)).toEqual({ left: 480, top: 494, placement: 'above' })
    expect(trayMenuPosition(rect(500, 40, 180, 44), menu, vp)).toEqual({ left: 480, top: 90, placement: 'below' })
    expect(trayMenuPosition(rect(0, 600, 120, 44), menu, vp).left).toBe(8)
    expect(trayMenuPosition(rect(1100, 600, 180, 44), menu, vp).left).toBe(1000 - 200 - 8)
  })
})

// ─── MINI-5 / MINI-6 / MINI-7 ───────────────────────────────────────────────

describe('MINI-5/6/7 · пункти меню і видалення', () => {
  it('видно «Повернути на дошку», розділювач і «Видалити з дошки» з кошиком', async () => {
    const w = mountTray([card('a', 'theory_card')])
    await w.get(MENU_BTN).trigger('click')
    await flush()
    const p = popup()
    expect(p.getAttribute('role')).toBe('menu')
    expect(Array.from(p.children).map(el => el.getAttribute('role'))).toEqual(['menuitem', 'separator', 'menuitem'])
    expect(Array.from(p.querySelectorAll('[role="menuitem"]')).map(el => el.textContent!.trim()))
      .toEqual(['Повернути на дошку', 'Видалити з дошки'])
    const del = p.querySelector<HTMLButtonElement>(DELETE)!
    expect(del.disabled).toBe(false)
    expect(del.querySelector('svg')).not.toBeNull()
    expect(p.querySelector('[data-testid="wb-board-tray-delete-locked"]')).toBeNull()

    p.querySelector<HTMLElement>('[data-testid="wb-board-tray-menu-restore"]')!.click()
    await flush()
    expect(w.emitted('restore')).toEqual([['a']])
    expect(popups()).toHaveLength(0)
  })

  it('«Видалити з дошки» — рівно один delete з id цієї картки; restore не йде', async () => {
    const w = mountTray([card('a', 'theory_card'), card('b', 'nmt_task'), card('c', 'geometry_2d_v2')])
    await w.findAll(MENU_BTN)[1].trigger('click')
    await flush()
    popup().querySelector<HTMLElement>(DELETE)!.click()
    await flush()
    expect(w.emitted('delete')).toEqual([['b']])
    expect(w.emitted('restore')).toBeUndefined()
    expect(popups()).toHaveLength(0)
  })

  it('після видалення фокус переходить на вкладку, що стала на її місце', async () => {
    const [a, b, c] = [card('a', 'theory_card'), card('b', 'nmt_task'), card('c', 'geometry_2d_v2')]
    const w = mountTray([a, b, c])
    await w.findAll(MENU_BTN)[1].trigger('click')
    await flush()
    popup().querySelector<HTMLElement>(DELETE)!.click()
    await w.setProps({ items: [a, c] })
    await flush()
    expect(document.activeElement).toBe(w.findAll(RESTORE)[1].element)
  })

  it('полотно: трей → handleTrayDelete → лише штатний asset-delete; сам трей нічого не пише', () => {
    const canvas = read(CANVAS_SFC)
    expect(canvas).toMatch(/<WBBoardTray\s+v-if="showTray"\s+:items="trayList"\s+@restore="handleTrayRestore"\s+@delete="handleTrayDelete"/)
    const body = canvas.match(/function handleTrayDelete\(assetId: string\): void \{([\s\S]*?)\n\}/)![1]
    expect(body.replace(/\/\/[^\n]*/g, '').trim()).toBe("emit('asset-delete', assetId)")
    const script = read(TRAY_SFC).split('<script setup lang="ts">')[1].split('</script>')[0]
    expect(script).not.toMatch(/useWBStore|deleteAsset|updateAsset|apiClient|fetch\(|page\.assets/)
    expect(script.match(/emit\('delete', id\)/g)).toHaveLength(1)
  })

  it('заблокована: «Видалити» видно, але disabled, з причиною; клік не дає delete', async () => {
    const w = mountTray([card('l', 'visual_capsule', { locked: true })])
    await w.get(MENU_BTN).trigger('click')
    await flush()
    const p = popup()
    const del = p.querySelector<HTMLButtonElement>(DELETE)!
    expect(del.textContent!.trim()).toBe('Видалити з дошки')
    expect(del.disabled).toBe(true)
    const hint = p.querySelector<HTMLElement>('[data-testid="wb-board-tray-delete-locked"]')!
    expect(hint.textContent!.trim()).toBe('Розблокуйте картку, щоб видалити')
    expect(del.getAttribute('aria-describedby')).toBe(hint.id)

    del.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()
    expect(w.emitted('delete')).toBeUndefined()
  })
})

// ─── MINI-8 ─────────────────────────────────────────────────────────────────

describe('MINI-8 · меню закривається й не висить у повітрі', () => {
  it('другий клік «⋯», клік поза меню, Escape (фокус — на «⋯»); клік усередині — не закриває', async () => {
    const w = mountTray([card('a', 'theory_card'), card('b', 'nmt_task')])
    const btn = () => w.findAll(MENU_BTN)[0]

    await btn().trigger('click')
    await flush()
    expect(popups()).toHaveLength(1)
    await btn().trigger('click')
    await flush()
    expect(popups()).toHaveLength(0)
    expect(document.activeElement).toBe(btn().element)

    await btn().trigger('click')
    await flush()
    popup().dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(popups()).toHaveLength(1)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flush()
    expect(popups()).toHaveLength(0)

    await btn().trigger('click')
    await flush()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush()
    expect(popups()).toHaveLength(0)
    expect(document.activeElement).toBe(btn().element)
  })

  it('зміна сторінки й зникнення вкладки закривають меню', async () => {
    const [a, b] = [card('a', 'theory_card'), card('b', 'nmt_task')]
    const w = mountTray([a, b])

    await w.findAll(MENU_BTN)[0].trigger('click')
    await flush()
    await w.setProps({ items: [card('p2', 'theory_card')] })
    await flush()
    expect(popups()).toHaveLength(0)

    await w.setProps({ items: [a, b] })
    await w.findAll(MENU_BTN)[1].trigger('click')
    await flush()
    expect(popups()).toHaveLength(1)
    await w.setProps({ items: [a] })
    await flush()
    expect(popups()).toHaveLength(0)
  })
})

// ─── MINI-9 ─────────────────────────────────────────────────────────────────

describe('MINI-9 · багато вкладок і горизонтальний скрол', () => {
  it('меню останньої вкладки видно, воно в межах viewport і їде за карткою під час скролу', async () => {
    stubLayout({ width: 800, height: 600 }, { width: 212, height: 120 })
    const items = Array.from({ length: 8 }, (_, i) => card(`k${i}`, 'theory_card'))
    const w = mountTray(items)
    let left = 1400
    ;(w.findAll(TAB)[7].element as HTMLElement).getBoundingClientRect = () => rect(left, 540, 200, 44)

    await w.findAll(MENU_BTN)[7].trigger('click')
    await flush()
    let p = popup()
    expect(p.dataset.assetId).toBe('k7')
    expect(p.style.left).toBe(`${800 - 212 - 8}px`)

    left = 500
    const rail = w.get(RAIL).element as HTMLElement
    rail.scrollLeft = 900
    rail.dispatchEvent(new Event('scroll'))
    await flush()
    p = popup()
    expect(p.style.left).toBe(`${700 - 212}px`)
    expect(p.style.top).toBe(`${540 - 6 - 120}px`)
    expect(p.dataset.placement).toBe('above')

    p.querySelector<HTMLElement>(DELETE)!.click()
    expect(w.emitted('delete')).toEqual([['k7']])
  })
})

// ─── MINI-10 ────────────────────────────────────────────────────────────────

describe('MINI-10 · учень, replay і не-edit режими', () => {
  it('трей (а з ним і меню) лише в учителя в режимі редагування', () => {
    expect(canShowTray({ isTutor: false, mode: 'edit' }, 3)).toBe(false)
    expect(canShowTray({ isTutor: true, mode: 'replay' }, 3)).toBe(false)
    expect(canShowTray({ isTutor: true, mode: 'view' }, 3)).toBe(false)
    expect(canShowTray({ isTutor: true, mode: 'edit' }, 3)).toBe(true)
    const canvas = read(CANVAS_SFC)
    expect(canvas).toContain('const showTray = computed(() => canShowTray(trayViewer.value, trayList.value.length))')
    const sfc = read(TRAY_SFC)
    expect(sfc.match(/<Teleport/g)).toHaveLength(1)
    expect(sfc.indexOf('<Teleport')).toBeGreaterThan(sfc.indexOf('<nav'))
    expect(sfc.indexOf('<Teleport')).toBeLessThan(sfc.indexOf('</nav>'))
  })

  it('трей зник (роль чи режим змінились) — відкрите меню зникає разом із ним', async () => {
    const w = mountTray([card('a', 'theory_card')])
    await w.get(MENU_BTN).trigger('click')
    await flush()
    expect(popups()).toHaveLength(1)
    unmountTray(w)
    await flush()
    expect(popups()).toHaveLength(0)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
})
