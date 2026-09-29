/**
 * Помилка рушія калькулятора графіків → текст під рядком (власник 2026-09-29, «як у Desmos»).
 *
 * Рушій пише технічно й лише українською («Очікувалось «)», отримано «END»», «(§4.5)»). Тут —
 * ключ `winterboard.graphCalc.err.*` і параметри, щоб учитель прочитав людською мовою своєї локалі.
 * Невідомий текст повертається `null` — тоді показуємо сире пояснення рушія: краще воно, ніж жодного.
 */
import { useI18n } from 'vue-i18n'

export interface GraphCalcErrorMessage {
  key: string
  params?: Record<string, string>
}

type Rule = [RegExp, (m: RegExpMatchArray) => GraphCalcErrorMessage]

const RULES: Rule[] = [
  // «на позиції N» не показуємо: після нормалізації вводу (sin x → sin(x)) номер може зсунутись
  [/^Невідомий символ «(.+)» на позиції \d+$/, (m) => ({ key: 'unknownSymbol', params: { ch: m[1] } })],
  [/^Очікувалось «(.+)», отримано «END»$/, (m) => ({ key: 'missing', params: { tok: m[1] } })],
  [/^Очікувалось «(.+)», отримано «(.+)»$/, (m) => ({ key: 'expectedGot', params: { expected: m[1], got: m[2] } })],
  [/^Неочікуваний токен «END»$/, () => ({ key: 'incomplete' })],
  [/^Неочікуваний токен «(.+)»$/, (m) => ({ key: 'unexpected', params: { tok: m[1] } })],
  [/^Подвійний знак рівності/, () => ({ key: 'doubleEq' })],
  [/^Кортеж може мати рівно 2 елементи/, () => ({ key: 'pointArity' })],
  [/^Зайві токени після виразу$/, () => ({ key: 'trailing' })],
  [/^Невідома функція/, () => ({ key: 'unknownFunc' })],
  [/^Очікується рівняння або точка$/, () => ({ key: 'notEquation' })],
]

export function graphCalcErrorMessage(raw: string): GraphCalcErrorMessage | null {
  for (const [re, make] of RULES) {
    const m = raw.match(re)
    if (m) return make(m)
  }
  return null
}

/** Для шаблону: сирий текст рушія → рядок локалі (невідомий — як є). */
export function useGraphCalcErrorText(): (raw: string) => string {
  const { t } = useI18n()
  return (raw) => {
    const m = graphCalcErrorMessage(raw)
    return m ? t(`winterboard.graphCalc.err.${m.key}`, m.params ?? {}) : raw
  }
}
