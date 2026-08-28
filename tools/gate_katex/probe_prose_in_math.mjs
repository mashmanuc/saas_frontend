/**
 * Українська проза, випадково загорнута в долари.
 *
 * Знайдено під час полювання на двійників: `$перевищувала$`,
 * `$Отже, значення невідомого члена пропорції дорівнює $`.
 *
 * ЧОМУ ЦЕ ДЕФЕКТ, ХОЧ ПОМИЛКИ НЕМАЄ. KaTeX слухняно малює кожну літеру як
 * математичну змінну: курсивом, з міжсимвольними інтервалами як між
 * множниками. Слово «перевищувала» перетворюється на добуток тринадцяти
 * змінних. Рендер відпрацьовує, аудит зелений, а на екрані — покошене
 * слово посеред речення. Той самий клас, що градуси: виглядає майже
 * правильно, тому й живе довго.
 *
 * ⚠️ Не плутати з ЗАКОННОЮ кирилицею у формулі:
 *     $S_{бік}$              підпис індексу
 *     \operatorname{НСД}     усталене скорочення
 *     $\text{Маса солі}$     явно оголошений текст
 * Їх відрізняє те, що кирилиця там усередині команди або індексу.
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeSourceText } from '../../src/utils/katexCompat.ts'

const SEG = /(\$\$[\s\S]+?\$\$|\$[^$]{1,800}?\$)/g
const CYR = /[а-щьюяїієґА-ЩЬЮЯЇІЄҐ]/g

/** Прибрати те, де кирилиця законна: аргументи команд і індекси. */
function stripLegit(body) {
  return body
    .replace(/\\(?:text|textit|textbf|mathrm|operatorname|mathbf)\{[^{}]*\}/g, '')
    .replace(/_\{[^{}]*\}/g, '')
    .replace(/\^\{[^{}]*\}/g, '')
}

let total = 0, prose = 0, proseOcc = 0
const examples = []

for (const l of fs.readFileSync(
  path.resolve('../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  const text = normalizeSourceText(r.text)
  SEG.lastIndex = 0
  let m
  while ((m = SEG.exec(text)) !== null) {
    total++
    const inner = m[0].replace(/^\$\$?|\$\$?$/g, '')
    const rest = stripLegit(inner)
    const cyr = (rest.match(CYR) || []).length
    if (cyr < 3) continue
    // Проза — це коли кирилиці більше, ніж усього іншого разом, і немає
    // жодного оператора. Три літери — поріг: `АВС` у геометрії законне.
    const others = rest.replace(CYR, '').replace(/\s/g, '').length
    const hasMath = /[=+\-*/^_<>]|\\[a-zA-Z]/.test(rest)
    if (cyr > others && !hasMath) {
      prose++
      proseOcc += r.n
      if (examples.length < 12) examples.push(inner.trim().slice(0, 90))
    }
  }
}

console.log(`математичних сегментів: ${total}`)
console.log(`з них ПРОЗА в доларах:  ${prose}  (входжень ${proseOcc})`)
console.log(`частка: ${(100 * prose / total).toFixed(3)}%\n`)
console.log('приклади:')
examples.forEach((e) => console.log(`   $${e}$`))
