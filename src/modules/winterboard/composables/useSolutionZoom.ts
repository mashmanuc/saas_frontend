/**
 * Масштаб тексту розбору — особисте налаштування перегляду.
 *
 * ⚠️ Запит власника 2026-08-27: «чи можна розбір зробити зумовим, щоб учитель
 * міг збільшувати-зменшувати текст?» Мета — показати класу хід розв'язання
 * крупно, не збільшуючи решту дошки.
 *
 * 🔴 ЧОМУ НЕ В ДАНИХ КАРТКИ, А В localStorage. Спокуса покласти розмір у
 * `asset.data` через `update:asset` була б помилкою трьох рівнів:
 *   1. це пішло б через ops і **змінило б розмір і в учня** — а він про
 *      збільшення не просив і, можливо, дивиться з телефону;
 *   2. розмір шрифту не є вмістом дошки; писати його у стан означає плодити
 *      операції на кожне натискання кнопки;
 *   3. будь-який запис у стан підпадає під SYSTEM_LAW (мутації лише через
 *      OpsApplyService). Тут ми шляху запису не торкаємось узагалі.
 *
 * 🔴 ЧОМУ SINGLETON, А НЕ РЕФ НА КОМПОНЕНТ. Стан навмисно на рівні модуля:
 * учитель, який збільшив розбір на одній картці, хоче більший скрізь, а не
 * клацає на кожній. Усі відкриті картки реагують на одну зміну.
 */
import { computed, ref } from 'vue'

const LS_KEY = 'wb_solution_font_px'

/**
 * Сходинки розміру. Не плавний множник: із дискретними кроками вчитель
 * потрапляє в потрібний розмір за одне-два натискання й не воює з півпікселями.
 * 13 — те саме значення, що стояло в CSS до цієї зміни, тож без дотику до
 * кнопок вигляд не змінюється ні на піксель.
 */
export const SOLUTION_FONT_STEPS = [11, 13, 15, 17, 20, 24, 28] as const

const DEFAULT_PX = 13

function loadInitial(): number {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const px = raw === null ? NaN : Number(raw)
    // Приймаємо лише значення зі сходинок: сторонній рядок у localStorage не
    // має ставати розміром шрифту.
    return (SOLUTION_FONT_STEPS as readonly number[]).includes(px) ? px : DEFAULT_PX
  } catch {
    return DEFAULT_PX   // приватне вікно / вимкнене сховище
  }
}

// Модульний стан — спільний для всіх інстансів картки.
const fontPx = ref<number>(loadInitial())

function persist(px: number): void {
  try {
    localStorage.setItem(LS_KEY, String(px))
  } catch {
    // Сховище недоступне — розмір діє до перезавантаження. Це прийнятно:
    // мовчазна відмова тут краща за помилку в обличчя вчителю посеред уроку.
  }
}

export function useSolutionZoom() {
  const index = computed(() =>
    Math.max(0, (SOLUTION_FONT_STEPS as readonly number[]).indexOf(fontPx.value)))

  const canZoomIn = computed(() => index.value < SOLUTION_FONT_STEPS.length - 1)
  const canZoomOut = computed(() => index.value > 0)
  const isDefault = computed(() => fontPx.value === DEFAULT_PX)

  function zoomIn(): void {
    if (!canZoomIn.value) return
    fontPx.value = SOLUTION_FONT_STEPS[index.value + 1]
    persist(fontPx.value)
  }

  function zoomOut(): void {
    if (!canZoomOut.value) return
    fontPx.value = SOLUTION_FONT_STEPS[index.value - 1]
    persist(fontPx.value)
  }

  /** Повернути типовий розмір — щоб вибратись із 28px одним рухом. */
  function reset(): void {
    fontPx.value = DEFAULT_PX
    persist(fontPx.value)
  }

  return { fontPx, canZoomIn, canZoomOut, isDefault, zoomIn, zoomOut, reset }
}
