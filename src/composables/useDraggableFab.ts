/**
 * Перетягувана плаваюча фігурка Інтегралика — для лендінгу /start (`LandingIntegralykHint.vue`).
 *
 * ТЗ TZ_START_INTEGRALYK_HINTS_2026-10-11 §7, власник: «його не можна рухати — він прив'язаний… треба як в
 * коді, щоб його можна було переставляти». Тому тут ПОВТОРЕНО логіку кнопки Інтегралика на дошці
 * (`src/modules/intent/CommandPalette.vue`, `fabPointerDown/Move/Up`, `FAB_POS_KEY`): поріг 5 px, відступ
 * 4 px від краю (типово), запис `{x, y}` у localStorage, гасіння кліку після перетягування.
 *
 * Дошку на цей composable НЕ переведено навмисно (рішення Феї 2026-10-11): правило «don't touch working» —
 * заради лендінгу робочу дошку не чіпаємо, а перетягування на дошці наживо через composable не перевірене.
 * Отже, логіка живе у двох місцях; правите одне — гляньте й на інше. Перевести дошку — окремим рішенням,
 * із перевіркою наживо (вхід + дошка).
 *
 * Pointer-події: працює мишею, ПЕРОМ планшета і пальцем. Клік vs перетягування розрізняємо порогом руху;
 * після перетягування click-подію гасимо (`consumeDragClick`), щоб не відкривалось те, що відкриває дотик.
 */
import { computed, ref } from 'vue'

export interface FabPos {
  x: number
  y: number
}

export interface DraggableFabOptions {
  /** Ключ позиції в localStorage (на дошці — `m4sh_integralyk_pos`). */
  storageKey: string
  /** Розмір кнопки, px; функція — коли розмір залежить від екрана (лендінг: 56 на телефоні, 64 ширше). */
  size: number | (() => number)
  /** Відступ від краю екрана, px. Типово 4 — як на дошці. */
  margin?: number
  /** Поріг руху, px: менше — дотик/клік, більше — перетягування. Типово 5 — як на дошці. */
  threshold?: number
  /** Додаткові властивості стилю, коли позицію задано (лендінг: `bottom: 'auto'`). */
  positionedStyle?: Record<string, string>
  /** Кожен крок перетягування — напр. переставити бульбашку, що їде з фігуркою. */
  onMove?: () => void
}

interface DragState {
  startX: number
  startY: number
  origX: number
  origY: number
  moved: boolean
}

export function useDraggableFab(options: DraggableFabOptions) {
  const margin = options.margin ?? 4
  const threshold = options.threshold ?? 5

  /** `{x, y}` — куди переставили; `null` — типове місце з CSS. */
  const pos = ref<FabPos | null>(null)
  /** Саме зараз тягнуть (поріг руху вже пройдено). */
  const dragging = ref(false)
  let drag: DragState | null = null
  let justMoved = false

  const style = computed<Record<string, string>>(() =>
    pos.value
      ? { left: pos.value.x + 'px', top: pos.value.y + 'px', right: 'auto', ...options.positionedStyle }
      : {},
  )

  function currentSize(): number {
    return typeof options.size === 'function' ? options.size() : options.size
  }

  /** Тримає кнопку в межах екрана. */
  function clamp(x: number, y: number): FabPos {
    const size = currentSize()
    const maxX = window.innerWidth - size - margin
    const maxY = window.innerHeight - size - margin
    return { x: Math.min(Math.max(margin, x), maxX), y: Math.min(Math.max(margin, y), maxY) }
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    drag = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, moved: false }
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // Старі браузери без pointer capture — тягнеться й так, поки вказівник над кнопкою.
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < threshold) return
    drag.moved = true
    dragging.value = true
    pos.value = clamp(drag.origX + dx, drag.origY + dy)
    options.onMove?.()
  }

  function onPointerUp(): void {
    if (!drag) return
    justMoved = drag.moved
    if (drag.moved && pos.value) {
      try {
        localStorage.setItem(options.storageKey, JSON.stringify(pos.value))
      } catch {
        // Приватний режим / заборонене сховище — позиція живе до перезавантаження сторінки.
      }
    }
    drag = null
    dragging.value = false
  }

  /** Для обробника click: `true` — це було перетягування, дію дотику не виконувати. */
  function consumeDragClick(): boolean {
    if (!justMoved) return false
    justMoved = false
    return true
  }

  /** Відновити збережену позицію (у межах теперішнього екрана — раптом він став меншим). */
  function restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(options.storageKey) || 'null')
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        pos.value = clamp(saved.x, saved.y)
      }
    } catch {
      // Зіпсований запис або заборонене сховище — лишаємо типове місце.
    }
  }

  /** Після зміни розміру/повороту екрана — повернути в межі (збереженого запису не чіпаємо). */
  function reclamp(): void {
    if (pos.value) pos.value = clamp(pos.value.x, pos.value.y)
  }

  return { pos, dragging, style, clamp, onPointerDown, onPointerMove, onPointerUp, consumeDragClick, restore, reclamp }
}
