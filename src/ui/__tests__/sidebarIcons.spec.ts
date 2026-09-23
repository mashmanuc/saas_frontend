/**
 * Кожна іконка з `config/menu.js` мусить існувати в ICON_MAP бічного меню.
 *
 * Привід (2026-09-23, скрін власника): пункт «Ідеї та відгуки» малювався
 * порожнім кружком. `menu.js` просив `lightbulb`, а в ICON_MAP такого ключа не
 * було — `AppSidebarItem` мовчки падав на запасний `Circle`. Помилка не видна
 * ні в типах (icon: string), ні в жодному тесті: меню рендериться, просто не
 * тим значком. Схоже, саме тому в напис колись вставили емодзі 💡.
 *
 * Guard структурний: читаємо обидва файли як текст, щоб не тягнути lucide.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const menu = readFileSync(resolve(__dirname, '../../config/menu.js'), 'utf8')
const item = readFileSync(resolve(__dirname, '../AppSidebarItem.vue'), 'utf8')

/**
 * Значення `icon: '…'` із ЖИВОГО меню — `SECTIONED_MENU_BY_ROLE`.
 * Легасі-блок `MENU_BY_ROLE` вище по файлу ніде, крім тестів, не читається
 * (перевірено grep-ом 2026-09-23), тож його іконки нікому не видно.
 */
const sectioned = menu.slice(menu.indexOf('export const SECTIONED_MENU_BY_ROLE'))
const usedIcons = [...sectioned.matchAll(/icon:\s*'([^']+)'/g)].map((m) => m[1])

/** Ключі ICON_MAP: рядки виду `'name': Component,`. */
const mapBlock = item.slice(item.indexOf('const ICON_MAP'), item.indexOf('}', item.indexOf('const ICON_MAP')))
const mappedIcons = [...mapBlock.matchAll(/'([^']+)':/g)].map((m) => m[1])

describe('іконки бічного меню', () => {
  it('меню взагалі просить іконки (страховка від порожнього regexp)', () => {
    expect(usedIcons.length).toBeGreaterThan(5)
    expect(mappedIcons.length).toBeGreaterThan(5)
  })

  it('кожна іконка з menu.js є в ICON_MAP — інакше буде порожній кружок', () => {
    const missing = [...new Set(usedIcons)].filter((name) => !mappedIcons.includes(name))
    expect(missing).toEqual([])
  })

  it('написи пунктів живого меню не містять емодзі замість іконки', () => {
    const labels = readFileSync(resolve(__dirname, '../../i18n/locales/uk.json'), 'utf8')
    const sidebarItems = JSON.parse(labels).sidebar.item as Record<string, string>
    const usedLabels = [...sectioned.matchAll(/label:\s*'sidebar\.item\.([^']+)'/g)].map((m) => m[1])
    const withEmoji = usedLabels
      .filter((key) => /\p{Extended_Pictographic}/u.test(sidebarItems[key] ?? ''))
    expect(withEmoji).toEqual([])
  })
})
