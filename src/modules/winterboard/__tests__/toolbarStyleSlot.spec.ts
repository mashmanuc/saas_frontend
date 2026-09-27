/**
 * TABLET 1А (рішення власника 2026-09-27): «товщина + колір» — одразу під олівцем і маркером.
 * БУЛО: окремою групою після всіх 10 інструментів, у самому низу лівої панелі.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ICON_STUBS = {
  WBIconPen: true, WBIconHighlighter: true, WBIconEraser: true, WBIconLine: true,
  WBIconRectangle: true, WBIconCircle: true, WBIconText: true, WBIconSelect: true,
  WBIconUndo: true, WBIconRedo: true, WBIconTrash: true, WBIconLaser: true,
  WBIconSticky: true, WBIconLock: true, WBIconUnlock: true,
}

async function mountToolbar(props: Record<string, unknown> = {}) {
  const WBToolbar = (await import('../components/toolbar/WBToolbar.vue')).default
  return mount(WBToolbar, {
    props: { variant: 'tablet', ...props } as any,
    attachTo: document.body,
    global: { stubs: ICON_STUBS, mocks: { $t: (key: string) => key } },
  })
}

/** Кнопки групи інструментів у порядку DOM: інструмент — його aria-label, стиль — 'STYLE'. */
function toolGroupOrder(wrapper: any): string[] {
  const group = wrapper.find('[role="group"]')
  return group.findAll('button').map((b: any) =>
    b.classes().includes('wb-color-flyout__trigger') ? 'STYLE' : String(b.attributes('aria-label')))
}

describe('WBToolbar — «товщина + колір» під олівцем (TABLET 1А)', () => {
  it('кнопка стилю стоїть одразу після олівця й маркера, у групі інструментів', async () => {
    const w = await mountToolbar({ currentTool: 'pen' })
    const order = toolGroupOrder(w)
    expect(order).toHaveLength(11)
    expect(order[3]).toBe('STYLE')
    // мітки перекладені («Ручка (P)»), тож звіряємо за клавішею інструмента
    expect(order[1]).toMatch(/\(P\)$/)
    expect(order[2]).toMatch(/\(H\)$/)
    expect(order[4]).toMatch(/\(L\)$/)
    // окремої групи кольору після інструментів більше немає
    expect(w.findAll('.wb-color-flyout__trigger')).toHaveLength(1)
    w.unmount()
  })

  it('для гумки кнопка на тому ж місці, лише приглушена — кнопки під нею не стрибають', async () => {
    const pen = await mountToolbar({ currentTool: 'pen' })
    const eraser = await mountToolbar({ currentTool: 'eraser' })
    expect(toolGroupOrder(eraser)).toEqual(toolGroupOrder(pen))
    expect(eraser.find('.wb-toolbar__style-slot').classes()).toContain('wb-toolbar__style-slot--idle')
    expect(pen.find('.wb-toolbar__style-slot').classes()).not.toContain('wb-toolbar__style-slot--idle')
    pen.unmount()
    eraser.unmount()
  })

  it('згорнута планшетна панель ховає лише додаткове, не стиль і не «скасувати»', async () => {
    const w = await mountToolbar({ currentTool: 'eraser' })
    expect(w.find('.wb-toolbar__group--extras').exists()).toBe(true)
    expect(w.find('.wb-toolbar__group--extras .wb-color-flyout__trigger').exists()).toBe(false)
    const src = await readFile(resolve(process.cwd(), 'src/modules/winterboard/components/toolbar/WBToolbar.vue'), 'utf-8')
    // БУЛО: nth-child(n+2):nth-child(-n+4) — ховало групи за позицією
    expect(src).not.toContain('nth-child(n+2):nth-child(-n+4)')
    w.unmount()
  })

  it('стрілки проходять вибір → олівець → маркер → стиль → лінія', async () => {
    const w = await mountToolbar({ currentTool: 'pen' })
    const buttons = w.find('[role="group"]').findAll('button')
    // від першої кнопки (свіжа панель — roving-позиція 0): три кроки — стиль, четвертий — лінія
    const press = () => (document.activeElement as HTMLElement)
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    ;(buttons[0].element as HTMLElement).focus()
    press(); press(); press()
    expect(document.activeElement).toBe(buttons[3].element)
    press()
    expect(document.activeElement).toBe(buttons[4].element)
    w.unmount()
  })
})

describe('Нижня смуга соло-кімнати — підпис «Клітинка» біля розміру сітки (TABLET 1А)', () => {
  it('селектор розміру сітки має підпис', async () => {
    const src = await readFile(resolve(process.cwd(), 'src/modules/winterboard/views/WBSoloRoom.vue'), 'utf-8')
    const at = src.indexOf('class="wb-grid-size-select"')
    expect(at).toBeGreaterThan(-1)
    const before = src.slice(Math.max(0, at - 600), at)
    expect(before).toContain("t('winterboard.room.gridCell', 'Клітинка')")
    expect(before).toContain('for="wb-grid-size-select"')
  })
})
