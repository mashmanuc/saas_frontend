/**
 * Другий рядок підказки на порожньому аркуші: де взяти графіки, фігури й PDF.
 *
 * Права панель буває в трьох станах, і підказка мусить казати правду про кожен:
 *   • відкрита (ноутбук; у вчителя є матеріали або він розгорнув панель сам);
 *   • згорнута до смужки з ▶ біля правого краю — так стартує НОВАЧОК
 *     (FIRST USER GATE 2026-09-23: порожня бібліотека → згортаємо, щоб аркуш
 *     не стискався; `onMaterialsLibraryState` у WBSoloRoom);
 *   • висувна (≤768 px): відкривається кнопкою ⊞ у шапці.
 *
 * Раніше напис завжди казав «з панелі «Інструменти» праворуч», а новачок праворуч
 * бачив лише сіру смужку (обхід очима новачка 2026-10-05). У демо-дошці гостя
 * вкладки «Матеріали» немає (GroupContentSidebar, localMode) — там без PDF.
 *
 * Графіки й фігури стоять першими навмисно: у новачка без файлів панель
 * відкривається на «Інструментах» (INV-FIRST-1, firstMinuteSidebar.spec.ts).
 *
 * У висувній панелі прапорець «згорнута» нічого не ховає: автозгортання порожньої
 * бібліотеки спрацьовує й там, а панель лишається на екрані (виміряно на стенді
 * 2026-10-05, 768 px). Тому для висувної дивимось лише, відкрита вона чи ні.
 */
export interface EmptyHintPanelState {
  /** Демо-дошка гостя (/workspace): у панелі лише «Інструменти». */
  localMode: boolean
  /** Панель висувна (≤768 px). */
  drawer: boolean
  /** Панель показана (для висувної — відкрита). */
  panelShown: boolean
  /** Бокова панель згорнута до смужки з ▶. */
  collapsed: boolean
}

export interface EmptyHintKeys {
  /** Ключ речення «де»; містить параметр `{what}`. */
  where: string
  /** Ключ переліку «що» для параметра `{what}`. */
  what: string
}

export function emptyCanvasHintKeys(state: EmptyHintPanelState): EmptyHintKeys {
  const what = state.localMode
    ? 'winterboard.emptyCanvas.whatTools'
    : 'winterboard.emptyCanvas.whatAll'
  if (state.drawer) {
    const where = state.panelShown ? 'winterboard.emptyCanvas.whereOpen' : 'winterboard.emptyCanvas.whereDrawer'
    return { where, what }
  }
  if (state.collapsed) return { where: 'winterboard.emptyCanvas.whereCollapsed', what }
  return { where: 'winterboard.emptyCanvas.whereOpen', what }
}
