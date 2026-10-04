/**
 * Поле, яке перерисовка не скидає, поки людина в ньому друкує.
 *
 * Власник 2026-10-04 (прод): під час ▶ поля «мін / макс / крок» графкалькулятора «заблоковані».
 * Параметр біжить — панель перерисовується до 30 разів на секунду, а `:value="p.max"` на кожній
 * перерисовці повертав у поле старе число поверх набраного. Поки поле у фокусі, показуємо
 * набране; після виходу з поля — знову значення з даних.
 */
import { ref } from 'vue'

export function useFieldDraft() {
  const draft = ref<{ key: string; text: string } | null>(null)
  return {
    /** Що показати в полі: набране (поки фокус) або значення з даних. */
    value: (key: string, current: number | string): string =>
      draft.value?.key === key ? draft.value.text : String(current),
    focus: (key: string, current: number | string): void => {
      draft.value = { key, text: String(current) }
    },
    input: (key: string, text: string): void => {
      if (draft.value?.key === key) draft.value = { key, text }
    },
    blur: (key: string): void => {
      if (draft.value?.key === key) draft.value = null
    },
  }
}
