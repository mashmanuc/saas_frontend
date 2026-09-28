/**
 * Показ відео дошки «на весь екран» (власник 2026-09-28, «так»: «чи можемо ми відео таким
 * самим чином на цілий екран розтягнути» — як презентацію з ▶ у «Матеріалах»).
 *
 * Що це: відео-картка ПОТОЧНОЇ сторінки розгортається поверх усього екрана цього ноутбука —
 * темне тло, відео по центру, угорі назва й ×, Esc закриває (вигляд — як `PresentationPlayer`).
 *
 * Той самий програвач, не копія: картка лише змінює стиль (WBCanvas, `position: fixed`), її DOM
 * не переноситься. Тому YouTube-iframe не перезавантажується, відео не починається спочатку, а
 * ▶/⏸ і гучність з пульта (LAW §9 v1.15) працюють і в показі — реєстри програвачів ті самі.
 *
 * Лише вигляд цього екрана: без ops, Replay, запису й мережі (як `view.fit` v1.2). Відкриває
 * пульт (`view.focus` для відео — `useRemoteViewAdapter.focusObject`); закривають «Уся сторінка»
 * пульта, інша сторінка, × чи Esc на ноутбуці.
 */
import { reactive } from 'vue'

/** Типи, що відкриваються показом (решта «На весь екран» — масштаб полотна до об'єкта). */
export const MEDIA_SHOW_TYPES: ReadonlySet<string> = new Set(['youtube_player', 'video_player'])

export function isMediaShowType(type: string | undefined | null): boolean {
  return !!type && MEDIA_SHOW_TYPES.has(type)
}

/** id відео в показі; null — показу немає. Реактивне: WBCanvas і стан пульта читають його. */
export const mediaShow = reactive<{ id: string | null }>({ id: null })

function onShowKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    // Показ накриває все — Esc спершу закриває його, а не знімає виділення на дошці під ним
    e.preventDefault()
    e.stopPropagation()
    closeMediaShow()
    return
  }
  // Показ модальний: клавіші дошки під ним (Delete, Ctrl+Z, стрілки…) не діють, поки вчитель
  // його не закрив, — інакше Delete прибрав би виділене, якого за показом не видно.
  // Клавіші самого програвача (фокус усередині показу) проходять.
  const show = typeof document !== 'undefined' ? document.querySelector('.wb-media-overlay--show') : null
  const target = e.target as Node | null
  if (show && target && show.contains(target)) return
  e.stopPropagation()
}

export function openMediaShow(id: string): void {
  if (!id) return
  if (!mediaShow.id && typeof window !== 'undefined') window.addEventListener('keydown', onShowKey, true)
  mediaShow.id = id
}

export function closeMediaShow(): void {
  if (!mediaShow.id) return
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onShowKey, true)
  mediaShow.id = null
}
