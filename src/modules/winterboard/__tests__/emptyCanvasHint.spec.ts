/**
 * Підказка на порожньому аркуші каже правду про праву панель (обхід очима новачка 2026-10-05).
 *
 * Новачок бачив «Або додайте графік чи фігуру з панелі «Інструменти» праворуч», а праворуч була
 * лише сіра смужка з ▶: панель для нього згортається навмисно (FIRST USER GATE 2026-09-23).
 * Тепер другий рядок залежить від стану панелі: згорнута → «натисніть ▶ біля правого краю»,
 * висувна (≤768 px) → «кнопка ⊞ угорі», відкрита → просто «у панелі праворуч».
 * У демо гостя вкладки «Матеріали» немає — там без PDF.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import { emptyCanvasHintKeys, type EmptyHintPanelState } from '../board/emptyCanvasHint'

const ROOM = readFileSync('src/modules/winterboard/views/WBSoloRoom.vue', 'utf8')

const base: EmptyHintPanelState = { localMode: false, drawer: false, panelShown: true, collapsed: false }

function sentence(state: EmptyHintPanelState, messages: Record<string, unknown> = uk, locale = 'uk'): string {
  const i18n = createI18n({
    legacy: false, locale, fallbackLocale: locale,
    messages: { [locale]: messages } as Record<string, typeof uk>,
  })
  const keys = emptyCanvasHintKeys(state)
  return i18n.global.t(keys.where, { what: i18n.global.t(keys.what) })
}

describe('стан панелі → речення', () => {
  it('новачок на ноутбуці: панель згорнута → куди натиснути', () => {
    expect(sentence({ ...base, collapsed: true }))
      .toBe('Графіки, фігури, PDF і презентації — у панелі праворуч: натисніть ▶ біля правого краю')
  })

  it('панель відкрита → без інструкції про ▶', () => {
    expect(sentence(base)).toBe('Графіки, фігури, PDF і презентації — у панелі праворуч')
  })

  it('вузький екран, висувна панель закрита → кнопка ⊞ угорі', () => {
    expect(sentence({ ...base, drawer: true, panelShown: false }))
      .toBe('Графіки, фігури, PDF і презентації — у панелі, яку відкриває кнопка ⊞ угорі')
  })

  it('висувна відкрита → як відкрита бокова', () => {
    expect(sentence({ ...base, drawer: true, panelShown: true })).toBe(sentence(base))
  })

  it('висувна: прапорець згортання не враховуємо — автозгортання її не ховає (стенд 768 px)', () => {
    expect(sentence({ ...base, drawer: true, panelShown: true, collapsed: true })).toBe(sentence(base))
    expect(sentence({ ...base, drawer: true, panelShown: false, collapsed: true }))
      .toBe(sentence({ ...base, drawer: true, panelShown: false }))
  })

  it('демо гостя: «Матеріалів» немає — без PDF', () => {
    const s = sentence({ ...base, localMode: true, collapsed: true })
    expect(s).toBe('Графіки й фігури — у панелі праворуч: натисніть ▶ біля правого краю')
    expect(s).not.toContain('PDF')
  })
})

describe('тексти', () => {
  it.each([['uk', uk], ['en', en], ['ru', ru]] as const)('%s: є всі ключі, «де» має {what}', (_l, dict) => {
    const ec = dict.winterboard.emptyCanvas as Record<string, string>
    for (const key of ['whereOpen', 'whereCollapsed', 'whereDrawer']) expect(ec[key]).toContain('{what}')
    expect(ec.whereCollapsed).toContain('▶')
    expect(ec.whereDrawer).toContain('⊞')
    expect(ec.whatAll).toContain('PDF')
    expect(ec.whatTools).not.toContain('PDF')
    expect(ec.sub).toBeUndefined()
  })

  it('ru: без українських літер; en: речення складається', () => {
    const ec = ru.winterboard.emptyCanvas as Record<string, string>
    for (const s of Object.values(ec)) expect(s).not.toMatch(/[іїєґІЇЄҐ]/)
    expect(sentence({ ...base, collapsed: true }, en, 'en'))
      .toBe('Graphs, shapes, PDFs and presentations are in the panel on the right: click ▶ at the right edge')
  })
})

describe('кімната дошки бере рядок зі стану панелі', () => {
  it('другий рядок — emptyHintSub, а не сталий ключ', () => {
    expect(ROOM).toContain('<span class="wb-empty-canvas-hint__sub">{{ emptyHintSub }}</span>')
    expect(ROOM).not.toContain("winterboard.emptyCanvas.sub'")
  })

  it('стан «згорнута» — той самий, що малює ▶ на ручці панелі', () => {
    expect(ROOM).toMatch(/collapsed: sidebarCollapsedBefore\.value !== null/)
    expect(ROOM).toContain("sidebarCollapsedBefore !== null ? '\\u25B6' : '\\u25C0'")
    expect('▶').toBe('▶')
  })

  it('кнопка ⊞, до якої відсилає підказка, — у приліпленому до краю блоці, а не за краєм телефона', () => {
    // 390 px: з прокручуваного `__actions` кнопка стояла на x 482–526 (стенд 2026-10-05).
    const iAuth = ROOM.indexOf('<div class="wb-header-auth">')
    const iBtn = ROOM.indexOf('class="wb-header-btn wb-header-btn--materials"')
    expect(iAuth).toBeGreaterThan(-1)
    expect(iBtn).toBeGreaterThan(iAuth)
    expect(ROOM.indexOf('</header>', iAuth)).toBeGreaterThan(iBtn)
    expect(ROOM.split('wb-header-btn--materials"').length - 1).toBe(1)
  })

  it('висувна панель — той самий прапорець, що вмикає кнопку в шапці', () => {
    expect(ROOM).toMatch(/drawer: isSidebarDrawer\.value,\s*panelShown: showMaterialsSidebar\.value/)
    expect(ROOM).toMatch(/localMode: isLocalWorkspace,/)
  })
})
