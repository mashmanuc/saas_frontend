/**
 * Б-115 (2026-09-29): на ширині 640–768 px з панелі інструментів було видно одну кнопку з сімнадцяти.
 * Причина — два правила: `@media (max-width: 768px)` клав панель у рядок, а варіант «планшет» (від 640 px,
 * resolveDeviceMode) тримав її вузькою колонкою 48–56 px з overflow-x: hidden.
 *   • кімната уроку до 768 px кладе панель унизу (dock="bottom") → планшетна панель — нижня смуга, як телефонна;
 *   • збоку (клас, dock за замовчуванням) — планшет лишається колонкою з прокруткою, без рядка з того правила.
 * Media-запитів jsdom не обчислює — правила звіряємо в тексті стилів; наживо — стенд (640, 683, 720, 744, 768: 16/16).
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import toolbarSource from '../components/toolbar/WBToolbar.vue?raw'
import soloRoomSource from '../views/WBSoloRoom.vue?raw'

const ICON_STUBS = {
  WBIconPen: true, WBIconHighlighter: true, WBIconEraser: true, WBIconLine: true,
  WBIconRectangle: true, WBIconCircle: true, WBIconText: true, WBIconSelect: true,
  WBIconUndo: true, WBIconRedo: true, WBIconTrash: true, WBIconLaser: true,
  WBIconSticky: true, WBIconLock: true, WBIconUnlock: true,
}

async function mountToolbar(props: Record<string, unknown> = {}) {
  const WBToolbar = (await import('../components/toolbar/WBToolbar.vue')).default
  return mount(WBToolbar, {
    props: { variant: 'tablet', ...props } as never,
    global: { stubs: ICON_STUBS, mocks: { $t: (key: string) => key } },
  })
}

/** Тіло першого блоку `@media (max-width: 768px) { … }` у стилях панелі. */
function mobileMediaBlock(): string {
  const start = toolbarSource.indexOf('@media (max-width: 768px) {')
  expect(start).toBeGreaterThan(0)
  let depth = 0
  for (let i = toolbarSource.indexOf('{', start); i < toolbarSource.length; i++) {
    if (toolbarSource[i] === '{') depth++
    if (toolbarSource[i] === '}' && --depth === 0) return toolbarSource.slice(start, i + 1)
  }
  throw new Error('блок не закрито')
}

describe('Б-115: панель інструментів на 640–768 px', () => {
  it('кімната каже панелі, де вона стоїть: data-dock (за замовчуванням — збоку)', async () => {
    const side = await mountToolbar()
    expect(side.attributes('data-dock')).toBe('side')
    const bottom = await mountToolbar({ dock: 'bottom' })
    expect(bottom.attributes('data-dock')).toBe('bottom')
    expect(bottom.attributes('data-variant')).toBe('tablet')
  })

  it('кімната уроку ставить dock="bottom" рівно тоді, коли її стилі кладуть панель униз (той самий поріг 768)', () => {
    expect(soloRoomSource).toContain(":dock=\"isSidebarDrawer ? 'bottom' : 'side'\"")
    expect(soloRoomSource).toContain("const SIDEBAR_DRAWER_QUERY = '(max-width: 768px)'")
    expect(soloRoomSource).toMatch(/@media \(max-width: 768px\) \{[\s\S]*?\.wb-solo-room__toolbar \{\s*order: 2;/)
  })

  it('правило «рядок до 768 px» не чіпає планшетний варіант (інакше — рядок у колонці 56 px, одна кнопка)', () => {
    const block = mobileMediaBlock()
    const selectors = [...block.matchAll(/^\s{2}([^{}\n@][^{}\n]*)\{/gm)].map((m) => m[1].trim())
    expect(selectors.length).toBeGreaterThan(0)
    for (const sel of selectors) expect(sel, sel).toContain(':not([data-variant="tablet"])')
  })

  it('внизу планшетна панель — нижня смуга: рядок з переносом, на всю ширину, нічого не обрізано', () => {
    const rule = toolbarSource.match(/\.wb-toolbar\[data-variant="tablet"\]\[data-dock="bottom"\],\s*\.wb-toolbar\[data-variant="tablet"\]\[data-dock="bottom"\]\.wb-toolbar--expanded \{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const body = rule![1]
    for (const decl of ['flex-direction: row;', 'flex-wrap: wrap;', 'width: 100%;', 'height: auto;', 'overflow: visible;']) {
      expect(body, decl).toContain(decl)
    }
    // групи не окремими коробками (усі кнопки одним потоком), роздільники й перемикач ширини колонки — сховані
    expect(toolbarSource).toMatch(/\.wb-toolbar\[data-variant="tablet"\]\[data-dock="bottom"\] \.wb-toolbar__group \{\s*display: contents;/)
    expect(toolbarSource).toMatch(/\.wb-toolbar\[data-variant="tablet"\]\[data-dock="bottom"\] \.wb-toolbar__toggle \{\s*display: none;/)
  })
})
