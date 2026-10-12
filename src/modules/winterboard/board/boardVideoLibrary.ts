/**
 * Відео, яке вчитель САМ поставив на дошку, → у його «Матеріали» (без дублів).
 *
 * ТЗ `saas_docs/domains/winterboard/TZ_BOARD_VIDEO_PICKER_AND_LIBRARY_2026-10-11.md`
 * §1 п.3, §6. Кімната викликає це рівно там, де картку `youtube_player` кладе
 * людина (вікно YouTube, Ctrl+V, пульт через `handleAssetAdd`) — НЕ при
 * завантаженні дошки, не з чужих ops і не з ↶/↷.
 *
 * Пише лише в «Матеріали» (REST бібліотеки), НЕ в стан дошки: op `asset_add` уже
 * пішов штатним шляхом (LAW §2). Сервер сам тримає «один запис на пару (учитель,
 * відео)» і не повертає архівоване чи видалене. Помилка урок не зупиняє і НЕ
 * повторюється (LAW §12) — лише видима в консолі.
 */

export interface BoardVideoAssetLike {
  type: string
  src?: string
  youtubeUrl?: string
  title?: string
}

export interface BoardVideoRememberDeps {
  /** Власник дошки, хмарна дошка (не локальний робочий простір) */
  enabled: () => boolean
  /** REST «Матеріалів» з `added_from: 'board'` (rememberBoardVideo) */
  remember: (url: string, title?: string) => Promise<unknown>
  warn?: (message: string, err: unknown) => void
}

export function createBoardVideoRemember(deps: BoardVideoRememberDeps): (asset: BoardVideoAssetLike) => void {
  const warn = deps.warn ?? ((message: string, err: unknown) => console.warn(message, err))
  return (asset) => {
    if (asset.type !== 'youtube_player' || !deps.enabled()) return
    const url = String(asset.youtubeUrl || asset.src || '').trim()
    if (!url) return
    const title = typeof asset.title === 'string' ? asset.title : undefined
    deps.remember(url, title).catch((err: unknown) => {
      warn('[WB:Room] відео не збереглось у «Матеріали»', err)
    })
  }
}
