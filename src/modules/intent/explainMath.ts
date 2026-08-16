/**
 * Математика у відповідях Інтегралика — рендериться, а не показується сирою.
 *
 * Скарга власника 2026-08-16 («знову LaTeX не рендериться і це нервує»):
 * у чаті стояло `Будую графіки: a+3-(x-1)^2, sqrt(9-(x-1)^2)` — сирий текст
 * замість формул.
 *
 * ⚠️ Діагноз виявився іншим, ніж звучала скарга: LaTeX там не «не
 * рендерився» — його ТАМ НЕ БУЛО. BE кладе в `explain` вирази у ASCII-форматі
 * рушія (`sqrt(...)`, `^`), як вони зберігаються у графічному калькуляторі
 * (`parser.py:_r_board_add_graph`), а `renderTextWithLatex` шукає `$…$` і,
 * не знайшовши, чесно віддає текст як є.
 *
 * Чому конвертуємо на FE, а не на BE: ASCII→LaTeX уміє лише парсер самого
 * рушія (`GraphCalc.parse` → `asciiMathToLatex`). Робити на BE другий,
 * власний парсер математики означало б дві реалізації, які розійдуться.
 *
 * Чому не «знайти математику в тексті регексом»: вгадувати, що в реченні
 * формула, а що слово — програш. Ми ЗНАЄМО точні рядки: BE віддає їх у
 * `action.payload.expressions`. Замінюємо рівно їх — нуль здогадок.
 */
import { asciiMathToLatex } from '@/modules/winterboard/utils/asciiMathToLatex'

interface GraphExpression { src?: string }

/** Вирази з payload дії — у тій формі, як їх шле BE (`_r_board_add_graph`). */
function expressionsOf(action: unknown): string[] {
  const payload = (action as { payload?: { expressions?: GraphExpression[] } })?.payload
  const list = payload?.expressions
  if (!Array.isArray(list)) return []
  return list
    .map((e) => (typeof e === 'string' ? e : e?.src))
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
}

/**
 * Підставити `$latex$` замість ASCII-виразів у тексті відповіді.
 *
 * Незмінний текст повертається як є — жодного «покращення» тексту, якого
 * ми не розпізнали. Вираз, який парсер рушія не бере (напр. недописаний),
 * лишається сирим: краще показати як є, ніж зіпсувати.
 */
export function explainWithRenderedMath(explain: string, action: unknown): string {
  const text = String(explain ?? '')
  if (!text) return text

  // Довші першими: `sqrt(9-(x-1)^2)` містить `(x-1)^2` як підрядок, і заміна
  // короткого раніше порізала б довгий на шматки.
  const sources = [...new Set(expressionsOf(action))].sort((a, b) => b.length - a.length)

  let out = text
  for (const src of sources) {
    let latex: string
    try {
      latex = asciiMathToLatex(src)
    } catch {
      continue          // рушій не розібрав — лишаємо сирим, це не привід ламати рядок
    }
    if (!latex) continue
    // split/join, а не replace з регексом: у виразах повно символів, які в
    // регексі мають власне значення (`^`, `(`, `*`, `+`).
    out = out.split(src).join(`$${latex}$`)
  }
  return out
}
