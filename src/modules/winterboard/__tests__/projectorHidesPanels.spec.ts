/**
 * Режим проєктора (⛶): після бездіяльності ховаються шапка, ліва панель інструментів і нижня панель —
 * на екрані лишається тільки дошка (власник 2026-09-28: «ліва панель інструментів автоматично ховалась,
 * хоча б при повноекранному режимі»). Кімната уроку в тестах не монтується — звіряємо правило стилю й
 * те, що клас вмикається лише в режимі ⛶ (живий доказ — стенд).
 */
import { describe, it, expect } from 'vitest'
import soloRoomSource from '../views/WBSoloRoom.vue?raw'

describe('режим ⛶: після бездіяльності — лише дошка', () => {
  it('клас схованого інтерфейсу — лише в режимі ⛶ і лише коли інтерфейс схований', () => {
    expect(soloRoomSource).toContain("'wb-solo-room--ui-hidden': projector.enabled.value && !projector.uiVisible.value,")
  })

  it('ховаються шапка, ліва панель інструментів, нижня панель і відкриті бічні панелі', () => {
    const rule = soloRoomSource.match(/((?:\.wb-solo-room--ui-hidden \.[\w-]+,?\s*)+)\{\s*display: none;\s*\}/)
    expect(rule).not.toBeNull()
    const selectors = rule![1].split(',').map((s) => s.trim()).filter(Boolean)
    expect(selectors).toEqual([
      '.wb-solo-room--ui-hidden .wb-solo-room__header',
      '.wb-solo-room--ui-hidden .wb-solo-room__toolbar',
      '.wb-solo-room--ui-hidden .wb-solo-room__page-panel',
      '.wb-solo-room--ui-hidden .wb-solo-room__resize-handle',
      '.wb-solo-room--ui-hidden .wb-solo-room__sidebar-toggle',
      '.wb-solo-room--ui-hidden .wb-solo-room__content-sidebar',
      '.wb-solo-room--ui-hidden .wb-solo-room__footer',
    ])
  })
})
