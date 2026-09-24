/**
 * useFrozenEditGuard — дошка з завершеним записом: перша спроба змінити →
 * одне питання «Запис завершено. Як продовжити?» (Почати новий запис / Скасувати).
 *
 * Рішення власника 2026-09-24. Спершу жило всередині WBSoloRoom; того ж дня
 * (P1 перед відео) класна кімната отримала ту саму поведінку — механізм винесено
 * сюди, щоб обидві кімнати мали ОДНЕ джерело, а не дві копії, що розійдуться.
 * Правила «що вважається спробою змінити» — чисті предикати в
 * `board/frozenEditGuard.ts`.
 *
 * Кімната вирішує лише ДВІ речі: коли guard активний (соло — власник поза
 * конструктором; кімната — лише вчитель) і як стартувати новий запис.
 * Решта однакова:
 *   - вибір пера/фігур/тексту/гумки → питання (Скасувати → інструмент «виділення»);
 *   - натискання на полотні не доходять до карток/Konva, а відкривають питання;
 *     колесо, середня кнопка, другий палець — вільні;
 *   - дія, передана в `guard(action)`, виконується після УСПІШНОГО старту запису
 *     (штрих пером повторити нема як — питання приходить ДО нього);
 *   - щойно дошка замерзла — виділення знімається (інакше інспектор виділеної
 *     картки міняв би дошку повз питання).
 */
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { WBToolType } from '../types/winterboard'
import {
  FROZEN_CANVAS_EVENTS,
  FROZEN_PROMPT_EVENT,
  isEditingTool,
  shouldInterceptCanvasEvent,
  type PointerLike,
} from '../board/frozenEditGuard'

export interface FrozenEditGuardOptions {
  /** Дошка заморожена (завершений запис). */
  frozen: Readonly<Ref<boolean>>
  /** Питати саме цю людину: заморожено І вона може почати новий запис. */
  active: Readonly<Ref<boolean>>
  currentTool: () => WBToolType
  setTool: (tool: WBToolType) => void
  clearSelection: () => void
  /** Контейнер полотна — на ньому перехоплюємо натискання. */
  canvasEl: Readonly<Ref<HTMLElement | null>>
  /** Старт нового запису; після нього `frozen` має стати false. Помилку показує сам. */
  startNewRecording: () => Promise<void>
}

export function useFrozenEditGuard(opts: FrozenEditGuardOptions) {
  const showPrompt = ref(false)
  let pending: (() => void) | null = null

  /** true → дію перехоплено (вікно відкрито); false → виконуй як завжди. */
  function guard(action?: () => void): boolean {
    if (!opts.active.value) return false
    pending = action ?? null
    showPrompt.value = true
    return true
  }

  /** Відкрити питання без відкладеної дії (бейдж «Запис завершено» у шапці). */
  function openPrompt(): void {
    pending = null
    showPrompt.value = true
  }

  async function onStartNew(): Promise<void> {
    await opts.startNewRecording()
    showPrompt.value = false
    const action = pending
    pending = null
    // Запис не стартував (помилку показав старт) — дію не виконуємо.
    if (action && !opts.frozen.value) action()
  }

  function onCancel(): void {
    pending = null
    if (isEditingTool(opts.currentTool())) opts.setTool('select')
  }

  watch(opts.frozen, (frozen) => { if (frozen) opts.clearSelection() })

  // Вибір пера/фігур/тексту/гумки (кнопкою чи клавішею) — теж спроба змінити.
  watch(opts.currentTool, (tool) => { if (isEditingTool(tool)) guard() })

  function onCanvasEvent(e: Event): void {
    if (!opts.active.value) return
    if (!shouldInterceptCanvasEvent(e as unknown as PointerLike)) return
    e.preventDefault()
    e.stopPropagation()
    if (e.type === FROZEN_PROMPT_EVENT) guard()
  }

  let boundEl: HTMLElement | null = null
  onMounted(() => {
    boundEl = opts.canvasEl.value
    if (!boundEl) return
    for (const type of FROZEN_CANVAS_EVENTS) boundEl.addEventListener(type, onCanvasEvent, { capture: true })
  })
  onBeforeUnmount(() => {
    if (!boundEl) return
    for (const type of FROZEN_CANVAS_EVENTS) boundEl.removeEventListener(type, onCanvasEvent, { capture: true })
    boundEl = null
  })

  return { showPrompt, guard, openPrompt, onStartNew, onCancel }
}
