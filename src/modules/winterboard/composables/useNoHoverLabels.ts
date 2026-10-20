/**
 * Слова під значками там, де немає мишки (планшет, велика дошка в класі).
 *
 * Прохід «очима вчителя 60 років» (2026-10-19): назви значків були лише в підказці при наведенні, а на планшеті й
 * на сенсорній дошці наведення немає — «що це за значок» не дізнатися взагалі. Власник 2026-10-20: «1 роби».
 * Як на пульті: під значком коротке слово. На ноутбуці з мишкою — як було (підказка при наведенні).
 *
 * Умова — `(hover: none)` (основний вказівник без наведення: планшет) АБО `(any-pointer: coarse)` (є дотик: велика
 * дошка з ПК, де основним вважається миша, ноутбук із сенсорним екраном). Лише вигляд цього пристрою: ні ops,
 * ні налаштувань.
 */
import { getCurrentInstance, onBeforeUnmount, ref, type Ref } from 'vue'

export const NO_HOVER_QUERY = '(hover: none), (any-pointer: coarse)'

export function useNoHoverLabels(): Ref<boolean> {
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(NO_HOVER_QUERY)
    : null
  const on = ref(Boolean(mq?.matches))
  if (mq && typeof mq.addEventListener === 'function') {
    const onChange = (e: MediaQueryListEvent) => { on.value = e.matches }
    mq.addEventListener('change', onChange)
    if (getCurrentInstance()) onBeforeUnmount(() => mq.removeEventListener('change', onChange))
  }
  return on
}
