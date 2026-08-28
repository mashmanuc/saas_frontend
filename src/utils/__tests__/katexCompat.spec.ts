/**
 * Сумісність згенерованого LaTeX із KaTeX — по одному тесту на ВИМІРЯНИЙ клас.
 *
 * Усі вхідні рядки нижче — справжні, з корпусу (126 488 унікальних фрагментів
 * банку). Не вигадані приклади: вигаданий приклад доводить, що функція робить
 * задумане, а не те, що потрібно на реальних даних.
 *
 * Тести ганяють САМ KaTeX, а не порівнюють рядки — з тієї ж причини.
 *
 * 🔬 Походження: гейт G-KATEX, 2026-08-27.
 *    до фіксу:  чистих 126 210 (99.78%),  зламаних 283
 *    після:     чистих 126 475 (99.99%),  зламаних  15
 *    Залишок — побитий LaTeX джерела (амперсанд усередині `\underline`,
 *    колонок ужито більше, ніж оголошено), а не несумісність.
 */
import { describe, it, expect } from 'vitest'
import katex from 'katex'
import {
  toKatexCompatible,
  normalizeSourceText,
  cleanTextSegment,
  splitBareMathEnvironments,
  stripArrayColumnSeparators,
} from '../katexCompat'

/** Чи бере KaTeX вираз без поблажок. */
function renders(tex: string, display = true): boolean {
  try {
    katex.renderToString(toKatexCompatible(tex), {
      throwOnError: true, strict: false, displayMode: display,
    })
    return true
  } catch { return false }
}

/** Повний конвеєр рендера: нормалізація → сегментація → підняття → KaTeX. */
function pipelineLeavesRawLatex(raw: string): boolean {
  const text = normalizeSourceText(raw)
  const SEG = /(\$\$[\s\S]+?\$\$|\$[^$]{1,800}?\$)/g
  const segs: Array<{ math: boolean; value: string }> = []
  let last = 0, m: RegExpExecArray | null
  while ((m = SEG.exec(text)) !== null) {
    if (m.index > last) segs.push({ math: false, value: text.slice(last, m.index) })
    segs.push({ math: true, value: m[0].replace(/^\$\$?|\$\$?$/g, '') })
    last = m.index + m[0].length
  }
  if (last < text.length) segs.push({ math: false, value: text.slice(last) })

  for (const s of segs) {
    if (s.math) { if (!renders(s.value)) return true; continue }
    for (const part of splitBareMathEnvironments(s.value)) {
      if (part.math) { if (!renders(part.value)) return true }
      else if (/\\[a-zA-Z]+/.test(cleanTextSegment(part.value))) return true
    }
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────
describe('G (96 входжень) — @{} у специфікації колонок', () => {
  const OWNER =
    '\\begin{array}{r@{\\,}l@{\\,}l@{\\,}} & 1 & 1{,} & 6 \\\\ - & 4 & ,7 \\\\ \\hline \\end{array}'

  it('🔴 випадок зі скріншота власника: було червоне — стало формулою', () => {
    // Контроль — БЕЗ шару сумісності, інакше він теж пройде й нічого не
    // доведе (перша редакція тесту саме так і впала).
    expect(() => katex.renderToString(OWNER, { throwOnError: true })).toThrow()
    expect(renders(OWNER)).toBe(true)
  })

  it('специфікація стає `rll`', () => {
    expect(toKatexCompatible(OWNER).match(/\\begin\{array\}\{([^{}]*)\}/)?.[1]).toBe('rll')
  })

  it('вкладені дужки в @{...} не збивають скан', () => {
    // Регекс `[^}]*` тут і ламався — обривався на першій `}` усередині.
    expect(stripArrayColumnSeparators('\\begin{array}{r@{\\hspace{2pt}}l} 1 & 2 \\end{array}'))
      .toBe('\\begin{array}{rl} 1 & 2 \\end{array}')
  })
})

describe('A (91) — літеральний \\n замість переносу', () => {
  it('🔴 нумерований список перестає злипатись', () => {
    const raw = 'Правильні?\\nI. Перше.\\nII. Друге.\\nIII. Третє.'
    expect(normalizeSourceText(raw).split('\n')).toHaveLength(4)
  })

  it('справжні команди на \\n не постраждали', () => {
    for (const cmd of ['\\nu', '\\ne', '\\neq', '\\nabla', '\\not']) {
      expect(normalizeSourceText(`$x ${cmd} y$`)).toContain(cmd)
    }
  })
})

describe('C (66) — роздільники \\(…\\) і \\[…\\]', () => {
  it('🔴 \\(…\\) стає $…$', () => {
    const raw = 'ціну (\\(40\\) гривень) поділимо'
    expect(pipelineLeavesRawLatex(raw)).toBe(false)
  })

  it('🔴 \\\\[2pt] — це ПЕРЕНОС, а не формула (регрес, який я внесла)', () => {
    // Без захисту `(?<!\\)` заміна рвала `\\[2pt]` навпіл і лишала «2pt]».
    expect(normalizeSourceText('a \\\\[2pt] b')).toContain('\\\\[2pt]')
    expect(normalizeSourceText('a \\\\[2pt] b')).not.toContain('$$')
  })
})

describe('D (33) — математичне середовище поза $…$', () => {
  it('🔴 tabular зі стовпчиком піднімається у формулу', () => {
    const raw = 'Запишемо у стовпчик:\n\\begin{tabular}{r}\n19,9\n\\hline\n\\end{tabular}'
    expect(pipelineLeavesRawLatex(raw)).toBe(false)
  })

  it('tabular перетворюється на array', () => {
    expect(toKatexCompatible('\\begin{tabular}{r} 1 \\end{tabular}'))
      .toContain('\\begin{array}')
  })

  it('🔴 середовище всередині $$ НЕ обгортається вдруге', () => {
    // Лічба символів `$` замість роздільників давала тут `$$` усередині
    // формули й учетверо більше червоних, ніж було до фіксу.
    const already = '$$\\begin{array}{r} 1 \\\\ 2 \\end{array}$$'
    expect((normalizeSourceText(already).match(/\$\$/g) || []).length).toBe(2)
  })

  it('долари ВСЕРЕДИНІ середовища прибираються', () => {
    const withInner = '\\begin{tabular}{r} $6{,}2$ \\hline \\end{tabular}'
    expect(renders(withInner)).toBe(true)
  })
})

describe('E (21) — \\hline не після \\\\', () => {
  it('🔴 риска, приліплена до числа, більше не валить рендер', () => {
    expect(renders('\\begin{array}{r}14{,}3\\\\+19{,}6\\hline\\end{array}')).toBe(true)
  })
})

describe('F (10) — $…$ з переносом рядка', () => {
  it('🔴 формула між доларами на власних рядках стає математикою', () => {
    const raw = 'Додаємо чисельники.\n$\n\\frac{6}{8} + \\frac{1}{8} = \\frac{7}{8}\n$\nОтже.'
    expect(pipelineLeavesRawLatex(raw)).toBe(false)
  })
})

describe('B (72) — документна розмітка LaTeX', () => {
  it('\\par стає абзацом, \\parallel лишається', () => {
    expect(cleanTextSegment('\\par Тепер обчислимо')).toContain('\n\n')
    expect(cleanTextSegment('a \\parallel b')).toContain('\\parallel')
  })

  it('накреслення → markdown, відступи → пробіл, обгортки зникають', () => {
    expect(cleanTextSegment('\\textbf{Випадок 1}')).toBe('**Випадок 1**')
    expect(cleanTextSegment('НСД: \\quad 10')).not.toContain('\\quad')
    expect(cleanTextSegment('\\begin{center}текст\\end{center}')).toBe('текст')
  })
})

describe('🔴 знайдено ОЧИМА, не виміром — стовпчик має лишитись стовпчиком', () => {
  /** Скільки рядків матиме array після сумісності. */
  const rows = (tex: string) =>
    (toKatexCompatible(tex).replace(/^[\s\S]*?\}/, '').match(/\\\\/g) || []).length + 1

  it('рядки через ПЕРЕНОС стають рядками через \\\\', () => {
    // KaTeX рендерив це БЕЗ помилки, склеюючи все в один рядок: аудит бачив
    // «чисто», власник на екрані — зниклий стовпчик. 59 зі 141 середовищ.
    const collapsed = '\\begin{array}{r@{\\,}l}\n10{,}4\n-6{,}2\n\\hline\n\\end{array}'
    expect(rows(collapsed)).toBeGreaterThan(2)
    expect(renders(collapsed)).toBe(true)
  })

  it('де розриви вже є — не чіпаємо', () => {
    const proper = '\\begin{array}{rl} 1 & 2 \\\\ 3 & 4 \\end{array}'
    expect(toKatexCompatible(proper)).toContain('1 & 2 \\\\ 3 & 4')
  })

  it('однорядковий array лишається однорядковим', () => {
    // `189,7 | 7` — запис ділення, там один рядок і має бути.
    expect(rows('\\begin{array}{r|l}\n   189{,}7 & 7 \n   \\end{array}')).toBe(1)
  })

  it('\\- друкувався бекслешем — стає мінусом', () => {
    expect(toKatexCompatible('20{,}43 \\- 10{,}75')).toBe('20{,}43 - 10{,}75')
  })

  it('🔴 але `\\\\-` — це ПЕРЕНОС плюс мінус, не м\'який дефіс', () => {
    // Другий раз у той самий капкан: без `(?<!\\)` регекс з'їдав другий
    // бекслеш розриву й робив із нього невідому команду `\-`.
    expect(toKatexCompatible('10{,}4 \\\\ -6{,}2')).toContain('\\\\ -6')
    expect(renders('\\begin{array}{r} 10{,}4 \\\\ -6{,}2 \\end{array}')).toBe(true)
  })
})

describe('нічого справного не зламано', () => {
  it('вирази без array повертаються байт-у-байт', () => {
    for (const tex of ['\\frac{1}{2}', 'x^2 + 1', '\\sqrt{16}=4', '']) {
      expect(stripArrayColumnSeparators(tex)).toBe(tex)
    }
  })

  it('матриця з роздільником `|` не змінюється', () => {
    const m = '\\begin{array}{c|c} 1 & 2 \\\\ 3 & 4 \\end{array}'
    expect(stripArrayColumnSeparators(m)).toBe(m)
    expect(renders(m)).toBe(true)
  })

  it('звичайний текст без LaTeX проходить наскрізь', () => {
    const plain = 'Обчисли різницю чисел 11,6 і 4,7 у стовпчик.'
    expect(normalizeSourceText(plain)).toBe(plain)
    expect(cleanTextSegment(plain)).toBe(plain)
  })
})

describe('обидва рендерери лікуються разом', () => {
  it('contentRenderer кличе сумісність ДО katex', async () => {
    // `throwOnError: false` не кидає виняток — catch не рятує. Приберуть
    // виклик — червоний LaTeX повернеться мовчки, без жодної помилки.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(path.resolve(process.cwd(),
      'src/modules/learning-content/utils/contentRenderer.ts'), 'utf-8')
    expect(src).toContain('katex.renderToString(toKatexCompatible(formula)')
    expect(src).toContain('normalizeSourceText(rawText)')
  })

  it('MathExpr теж', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(path.resolve(process.cwd(),
      'src/modules/winterboard/components/shared/MathExpr.vue'), 'utf-8')
    expect(src).toContain('toKatexCompatible(asciiMathToLatex(src))')
  })
})

describe('H (114) — градуси, записані як `^{o}`', () => {
  it('🔴 у тексті стає символом градуса', () => {
    // Знахідка власника: варіант відповіді показувався як «90^{o}».
    expect(normalizeSourceText('90^{o}')).toBe('90°')
    expect(normalizeSourceText('нахилена під кутом 45^{o}'))
      .toBe('нахилена під кутом 45°')
  })

  it('🔴 КИРИЛИЧНА «о» — та сама на вигляд, і саме її я пропустила', () => {
    // Перший фікс ловив лише латинську `o`. Я поміряла регексом з латинською,
    // дістала 114 і доповіла «усі 114» — а на картці власника стояла
    // кирилична, яких у банку 694. Фікс не змінив на екрані нічого.
    expect(normalizeSourceText('90^{о}')).toBe('90°')          // U+043E
    expect(normalizeSourceText('$x = 60^{о}$')).toBe('$x = 60^\\circ$')
  })

  it('градус у дужках теж: `^{°}`', () => {
    expect(normalizeSourceText('cos 330^{°}')).toBe('cos 330°')
  })

  it('без фігурних дужок теж ловиться', () => {
    expect(normalizeSourceText('кут 45^о')).toBe('кут 45°')
    expect(normalizeSourceText('кут 45^o')).toBe('кут 45°')
  })

  it('🔴 законні показники НЕ чіпаємо', () => {
    // `^{0}` — це показник нуль (`\int_{-3}^{0}`), а не градус: 30 входжень
    // у банку. Якби регекс узяв і його, ми зіпсували б інтеграли.
    for (const tex of ['$\\int_{-3}^{0} f(x)dx$', '$x^{2}$', '$a^{n}$', '$x^{one}$']) {
      expect(normalizeSourceText(tex)).toBe(tex)
    }
  })

  it('🔴 у формулі стає `\\circ`, а не символом', () => {
    // `°` усередині математики KaTeX не приймає — одна заміна на обидва
    // випадки зробила б із чорного дефекту червоний.
    const out = normalizeSourceText('$\\angle A = 90^{o}$')
    expect(out).toBe('$\\angle A = 90^\\circ$')
    expect(renders('\\angle A = 90^\\circ', false)).toBe(true)
  })

  it('правильні форми не чіпаємо', () => {
    for (const tex of ['$45^\\circ$', '$45^{\\circ}$', 'кут 45°']) {
      expect(normalizeSourceText(tex)).toBe(tex)
    }
  })

  it('змішаний рядок: у тексті символ, у формулі команда', () => {
    // ⚠️ Цей файл я дописувала через heredoc — і він з'їв по одному бекслешу
    // в кожному рядку, через що `\\angle` став `angle`, а `\\circ` — `circ`.
    // Тести падали на СПРАВНОМУ коді. Дописувати сюди — лише редактором.
    const out = normalizeSourceText('Кут 30^{o}, тобто $x = 60^{o}$ і ще 90^{o}')
    expect(out).toBe('Кут 30°, тобто $x = 60^\\circ$ і ще 90°')
  })
})
