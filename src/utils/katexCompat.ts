/**
 * Сумісність згенерованого LaTeX із KaTeX.
 *
 * ── Чому цей файл існує ───────────────────────────────────────────────────
 * Ми просимо мовну модель писати LaTeX, а малюємо KaTeX. KaTeX реалізує лише
 * МАТЕМАТИЧНИЙ LaTeX — підмножину. Модель пише справжній: текстові середовища
 * (`tabular`, `center`), пакетні можливості (`@{}` з `array`), стандартні
 * роздільники `\(…\)`, документну розмітку (`\par`, `\textbf`). Кожне окремо
 * валідне. Жодне не сумісне. Між ними ніхто не перевіряв.
 *
 * ⚠️ 2026-08-27 я полагодила ОДИН випадок (`@{\,}`) і за десять хвилин
 * отримала від власника два нові. Він відповів: «комплексно без латки — нехай
 * довше, але надійно». Тому нижче — не перелік того, що трапилось на очі, а
 * покриття ВИМІРЯНИХ класів.
 *
 * ── Вимір, з якого це зроблено (гейт G-KATEX) ─────────────────────────────
 * `backend/tools/gate_katex/extract_corpus.py` витяг усе, що потрапляє в
 * рендер: умови, розбори, варіанти, теорію — **126 488 унікальних фрагментів**
 * (378 145 входжень). `frontend/tools/gate_katex/audit.cjs` прогнав кожен
 * через справжній конвеєр (той самий регекс сегментів + KaTeX).
 *
 *     чисті          126 210  (99.78%)
 *     🟥 червоні          72  — KaTeX покликано, він не взяв
 *     ⬛ чорні           211  — LaTeX навіть не розпізнано як математику
 *
 * 59 класів дефектів згорнулись у сім причин — кожна закрита нижче:
 *
 *   A (91)  літеральний `\n` замість переносу       → normalizeSourceText
 *   B (72)  документна розмітка (\par, \textbf…)    → cleanTextSegment
 *   C (66)  формули поза роздільниками, `\(…\)`     → normalizeSourceText
 *   D (33)  математичне середовище поза `$…$`       → promoteBareEnvironments
 *   E (21)  `\hline` не після `\\`                  → toKatexCompatible
 *   F (10)  `$…$` з переносом рядка                 → SEGMENT_RE
 *   G (96)  `@{}` у специфікації колонок            → toKatexCompatible
 *
 * ── Розподіл обов'язків ───────────────────────────────────────────────────
 * Три шари, і плутати їх не можна — те саме `\quad` у формулі валідне, а в
 * тексті сміття:
 *
 *   normalizeSourceText(raw)      — до сегментації: те, що СТВОРЮЄ роздільники
 *   cleanTextSegment(text)        — лише текстові шматки
 *   toKatexCompatible(math)       — лише математичні шматки
 */
import katex from 'katex'

// ─────────────────────────────────────────────────────────────────────────
// Шар 1 — сирий текст, до сегментації
// ─────────────────────────────────────────────────────────────────────────

/**
 * Привести джерело до вигляду, у якому сегментер бачить усю математику.
 *
 * Тільки те, що змінює МЕЖІ формул або структуру рядків. Усе інше — нижче,
 * у шарах, які знають, текст перед ними чи формула.
 */
export function normalizeSourceText(raw: string): string {
  if (!raw) return raw
  let s = raw

  // A. Літеральний `\n` — два символи замість переносу. У банку 91 входження
  //    на кшталт `Правильні?\nI. Серед. перпенд...` — нумерований список
  //    злипався в один абзац.
  //    `(?![a-z])` рятує справжні команди: \nu, \ne, \neq, \not, \nabla.
  //    Команди `\n` у LaTeX не існує, тож інших жертв немає.
  s = s.replace(/\\n(?![a-z])/g, '\n')

  // H. Градуси, записані як `^{o}` — латинською «о» замість `\circ`.
  //    Знахідка власника 2026-08-28, урок «Трикутники»: у варіантах відповіді
  //    стояв сирий текст `90^{o}` замість «90°».
  //
  //    Запис неправильний ДВІЧІ, і кожна половина дає свій дефект:
  //      • `o` — це літера, не знак градуса; навіть у справжньому LaTeX
  //        вийшов би курсивний «о» у верхньому індексі, а не кружечок;
  //      • навколо немає `$…$`, тож у нас це взагалі не математика, а текст.
  //    Вимір: 114 входжень, і ВСІ 114 поза роздільниками. Правильні форми
  //    (`^\circ`, `^{\circ}`, разом 1521) навпаки — завжди всередині.
  //
  //    Тому заміна залежить від позиції: у тексті ставимо готовий символ
  //    (він уже працює — 8 624 таких у банку), у формулі — валідний `\circ`.
  //    Одна заміна на обидва випадки була б помилкою: `°` усередині
  //    математики KaTeX не приймає, а `\circ` у тексті лишиться сирим.
  s = replaceByPosition(s, /\^\{o\}/g, (inMath) => (inMath ? '^\\circ' : '°'))

  // C. Стандартні роздільники LaTeX. Сегментер знає лише `$`, тож 83 фрагменти
  //    з `\(…\)` і 28 із `\[…\]` показувались сирими — формула є, обгортки
  //    для неї немає.
  //
  //    🔴 `(?<!\\)` — не косметика, а виправлення РЕГРЕСУ, який я сюди внесла.
  //    Перша редакція без нього зіпсувала 22 фрагменти: у LaTeX `\\[2pt]` —
  //    це ПЕРЕНОС РЯДКА з відступом (дуже частий усередині `array`), а не
  //    початок display-формули. Заміна рвала його навпіл і лишала в тексті
  //    хвости на кшталт «4pt] \hline», а червоних ставало БІЛЬШЕ, ніж було
  //    до фіксу. Спіймано переміром корпусу — оглядом коду це не видно.
  s = s.replace(/(?<!\\)\\\[/g, '$$$$').replace(/(?<!\\)\\\]/g, '$$$$')
  s = s.replace(/(?<!\\)\\\(/g, '$').replace(/(?<!\\)\\\)/g, '$')

  // Непарна кількість `$` — загублений роздільник. У банку це майже завжди
  // ЗАКРИВНА без відкривної: «...ціни: \frac{600 \times 10}{100} = 60$ (грн)».
  //
  // Перша редакція просто ВИДАЛЯЛА самотній `$` — і формула лишалась сирою,
  // бо проблема була не в зайвому доларі, а у відсутньому. Перемір показав
  // ~38 таких фрагментів, найбільший залишковий клас. Тому тепер навпаки:
  // шукаємо, де формула почалась, і ставимо відкривну туди.
  if (countLoneDollars(s) % 2 === 1) s = repairMissingOpener(s)

  // D. Математичні середовища беремо в `$$…$$` ще ДО сегментації.
  //
  // Інакше сегментер ріже їх навпіл: у розборі стовпчика поруч трапляються
  // окремі формули в `$…$`, і межа лягає всередину `\begin{tabular}…\end`.
  // У перемірі це давало найбільший залишок — 18 входжень, де в одному
  // шматку лишався `\begin{tabular}`, а в іншому осиротілий `\end{tabular}`.
  // Підняти їх пізніше (у шарі 2) уже неможливо: половинки в різних сегментах.
  s = wrapBareMathEnvironments(s)

  return s
}

/**
 * Обгорнути голі математичні середовища в `$$…$$`, якщо вони поза формулою.
 *
 * «Поза формулою» визначаємо кількістю РОЗДІЛЬНИКІВ перед середовищем:
 * парна — ми в тексті, непарна — уже всередині математики, і друга обгортка
 * все зламала б.
 *
 * 🔴 Рахувати треба саме роздільники, а не символи `$`. Перша редакція
 * рахувала символи — і для `$$…\begin{array}…$$` бачила два долари, тобто
 * «парно, отже текст», обгортала вдруге й отримувала `$$` усередині формули.
 * KaTeX на це каже «Can't use function '$' in math mode»: червоних стало
 * 62 замість 10, тобто вшестеро БІЛЬШЕ, ніж до цієї «оптимізації».
 */
function wrapBareMathEnvironments(s: string): string {
  if (!s.includes('\\begin{')) return s
  MATH_ENV_RE.lastIndex = 0
  return s.replace(MATH_ENV_RE, (m, _env, offset: number) => {
    const delims = (s.slice(0, offset).match(/\$\$|\$/g) || []).length
    if (delims % 2 === 1) return m           // уже всередині формули
    return `$$${m}$$`
  })
}

/**
 * Заміна, що знає, всередині формули вона чи в тексті.
 *
 * Потрібна тому, що та сама конструкція вимагає різного лікування по різні
 * боки роздільника: `°` валідний у тексті й ламає KaTeX у математиці, а
 * `\circ` — навпаки. Позицію визначаємо лічбою РОЗДІЛЬНИКІВ (`$$` — один
 * роздільник із двох символів), а не символів `$`: на цьому я вже
 * помилялась у `wrapBareMathEnvironments` і отримала вшестеро більше
 * червоних, ніж було до фіксу.
 */
function replaceByPosition(
  s: string,
  re: RegExp,
  make: (inMath: boolean) => string,
): string {
  return s.replace(re, (match, offset: number) => {
    const delims = (s.slice(0, offset).match(/\$\$|\$/g) || []).length
    return make(delims % 2 === 1)
  })
}

/** Кількість одиночних `$` (подвійні — окремий роздільник, не рахуємо). */
function countLoneDollars(s: string): number {
  return (s.match(/(?<!\$)\$(?!\$)/g) || []).length
}

/**
 * Дописати відкривну `$` перед формулою, що її втратила.
 *
 * Межу шукаємо назад від самотнього `$` до найближчого природного початку —
 * двокрапки, тире, кінця речення або початку рядка. Саме там модель починає
 * формулу в усіх переглянутих випадках («Отже, \frac{25}{12}$»).
 *
 * Якщо між межею і доларом немає жодної математики — вставляти нема сенсу,
 * і тоді самотній долар прибираємо, як робила перша редакція: це або валюта,
 * або друкарська помилка.
 */
function repairMissingOpener(s: string): string {
  const LONE = /(?<!\$)\$(?!\$)/g
  let last = -1
  let m: RegExpExecArray | null
  while ((m = LONE.exec(s)) !== null) last = m.index
  if (last === -1) return s

  const head = s.slice(0, last)
  // Найпізніша межа: кінець речення, двокрапка, тире або перенос рядка.
  const boundary = Math.max(
    head.lastIndexOf(': '), head.lastIndexOf('— '), head.lastIndexOf('\n'),
    head.lastIndexOf('. '), head.lastIndexOf(', '),
  )
  const start = boundary === -1 ? 0 : boundary + (s[boundary] === '\n' ? 1 : 2)
  const candidate = s.slice(start, last)

  const looksLikeMath = /\\[a-zA-Z]+|[=<>]|\^|_\{/.test(candidate)
  if (!looksLikeMath) return s.slice(0, last) + s.slice(last + 1)

  return s.slice(0, start) + '$' + candidate + s.slice(last)
}

// ─────────────────────────────────────────────────────────────────────────
// Шар 2 — текстові сегменти
// ─────────────────────────────────────────────────────────────────────────

/** Математичні середовища: у тексті їх треба підняти в display-формулу. */
const MATH_ENVS = [
  'array', 'tabular', 'align', 'align*', 'aligned', 'equation', 'equation*',
  'gathered', 'gather', 'gather*', 'multline', 'multline*', 'matrix',
  'pmatrix', 'bmatrix', 'vmatrix', 'cases',
]

const MATH_ENV_RE = new RegExp(
  '\\\\begin\\{(' + MATH_ENVS.map((e) => e.replace('*', '\\*')).join('|') + ')\\}' +
  '[\\s\\S]*?\\\\end\\{\\1\\}', 'g')

/**
 * Знайти математичні середовища, що лежать голими в тексті, і повернути їх
 * як окремі display-шматки.
 *
 * D-клас виміру: 33 входження — `\begin{tabular}` зі стовпчиком додавання,
 * `\begin{array}` без `$`, `align*`, `gathered`. Модель пише їх так, як
 * пишуть у справжньому документі: середовище САМЕ по собі є display-режимом,
 * долари в LaTeX там зайві. KaTeX так не вміє — йому потрібен явний виклик.
 */
export function splitBareMathEnvironments(
  text: string,
): Array<{ math: boolean; value: string }> {
  const parts: Array<{ math: boolean; value: string }> = []
  let last = 0
  MATH_ENV_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MATH_ENV_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ math: false, value: text.slice(last, m.index) })
    parts.push({ math: true, value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ math: false, value: text.slice(last) })
  const withEnvs = parts.length ? parts : [{ math: false, value: text }]

  // Другий прохід — голі формули БЕЗ середовища (див. extractBareMathRuns).
  return withEnvs.flatMap((p) => (p.math ? [p] : extractBareMathRuns(p.value)))
}

/**
 * Команди, які бувають ЛИШЕ у формулі. Наявність будь-якої означає, що навколо
 * неї математика, навіть якщо роздільників немає.
 */
const MATH_ONLY_CMD =
  /\\(?:d?frac|tfrac|sqrt|times|div|cdot|pm|mp|leq?|geq?|neq?|approx|equiv|hline|phantom|overline|underline|angle|circ|degree|sum|prod|int|lim|infty|cdots|ldots|dots|binom|choose|vec|hat|bar|widehat)\b/

/** Символи, які можуть стояти всередині формули поруч із командами. */
const MATH_SAFE = /[\d\s{}()[\]^_=+\-*/<>|,.:;!%°'"°−–—]/

/**
 * Чи візьме KaTeX цей вираз.
 *
 * Кеш — не передчасна оптимізація: у корпусі 378 145 входжень на 126 488
 * унікальних фрагментів, тобто той самий текст рендериться втричі частіше за
 * потребу, а всередині фрагмента команди повторюються ще й між собою.
 */
const renderable = new Map<string, boolean>()

function canKatexRender(tex: string): boolean {
  if (!tex) return false
  const hit = renderable.get(tex)
  if (hit !== undefined) return hit
  let ok: boolean
  try {
    katex.renderToString(toKatexCompatible(tex), { throwOnError: true, strict: false })
    ok = true
  } catch {
    ok = false
  }
  if (renderable.size < 5000) renderable.set(tex, ok)
  return ok
}

/**
 * Підрізати межі так, щоб фігурні дужки всередині були збалансовані.
 *
 * Дві дії, обидві потрібні:
 *   • зайва `}` на початку — рухаємо ліву межу праворуч (група почалась
 *     раніше, ніж наш шматок, і її відкривної тут немає);
 *   • незакрита `{` — рухаємо праву межу ліворуч до місця, де глибина 0.
 */
function balanceBraces(text: string, start: number, end: number): [number, number] {
  let s = start
  // Ліворуч: поки перша значуща дужка — закривна без пари, зсуваємось.
  for (;;) {
    let depth = 0
    let bad = -1
    for (let i = s; i < end; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') {
        if (depth === 0) { bad = i; break }
        depth--
      }
    }
    if (bad === -1) break
    s = bad + 1
    if (s >= end) return [start, start]   // рятувати нема чого
  }
  // Праворуч: обрізаємо до останньої позиції з нульовою глибиною.
  let depth = 0
  let lastZero = s
  for (let i = s; i < end; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') depth--
    if (depth === 0) lastZero = i + 1
  }
  return [s, depth === 0 ? end : lastZero]
}

/**
 * Витягти з тексту голі формули — ті, що загубили роздільники.
 *
 * 🔴 Найбільший залишковий клас після першого кола фіксів (~38 фрагментів), і
 * причина виявилась не та, на яку я думала. Спершу я вирішила, що доларів
 * НЕПАРНА кількість, і навчилась дописувати відкривну. Перемір не зрушив
 * жодного фрагмента — бо доларів парна кількість, просто сегментер парує їх
 * не з тими партнерами:
 *
 *     Знижка $10\%$ від ціни: \frac{600 \times 10}{100} = 60$ (грн) ... $540$
 *                                                          ↑ ця пара
 *
 * Перша пара збігається правильно, далі роздільники «злипаються» через один,
 * і формула між ними лишається голою. Полагодити парування неможливо — воно
 * коректне, зіпсоване саме джерело. Тому шукаємо математику за ЗМІСТОМ:
 * якщо у шматку є команда, яка буває лише у формулі, розширюємо межі навколо
 * неї, поки трапляються математичні символи, і піднімаємо знайдене у формулу.
 */
export function extractBareMathRuns(
  text: string,
): Array<{ math: boolean; value: string }> {
  if (!text || !MATH_ONLY_CMD.test(text)) return [{ math: false, value: text }]

  const out: Array<{ math: boolean; value: string }> = []
  let cursor = 0

  for (;;) {
    const rest = text.slice(cursor)
    const hit = rest.match(MATH_ONLY_CMD)
    if (!hit || hit.index === undefined) break

    const at = cursor + hit.index
    let start = at
    let end = at + hit[0].length

    // Праворуч: команди, групи `{…}` і математичні символи.
    while (end < text.length) {
      const ch = text[end]
      if (ch === '\\') {
        const cmd = text.slice(end).match(/^\\[a-zA-Z]+|^\\[^a-zA-Z]/)
        if (!cmd) break
        end += cmd[0].length
      } else if (MATH_SAFE.test(ch)) {
        end++
      } else break
    }
    // Ліворуч — так само, але назад.
    while (start > 0) {
      const ch = text[start - 1]
      if (MATH_SAFE.test(ch)) start--
      else if (ch === '\\') { start--; break }
      else break
    }

    // 🔴 Дужки мусять бути збалансовані. Перша редакція розширювала межі
    // лише за символами — і різала формули посеред групи: у перемірі
    // з'явились нові червоні «Expected 'EOF', got '}'» (уривок `}(8, 7) = …`)
    // і «Unexpected end of input in a macro argument» (уривок `) = \frac{`).
    // Чорних поменшало, червоних побільшало — тобто «фікс» зробив гірше, і
    // побачити це можна було ЛИШЕ переміром.
    ;[start, end] = balanceBraces(text, start, end)

    // Хвостові пробіли лишаємо тексту, щоб не з'їдати відступи.
    const value = text.slice(start, end)
    const trimmed = value.trim()
    const lead = value.length - value.trimStart().length
    const tail = value.length - value.trimEnd().length

    // 🔴 ТОЧНА перевірка замість евристики. Після балансування дужок лишалось
    // 37 червоних: уламки середовищ, які сегментер розрізав по `$`. Витягнутий
    // шматок на кшталт `\hline \end` або `) = \frac` — це не формула, а її
    // хвіст, і жодне правило «на вигляд» цього не відрізнить надійно.
    //
    // Тому питаємо самого KaTeX: береш? Не бере — лишаємо текстом, як було.
    // Гірше не стане ніколи: текст і так показувався текстом.
    if (!canKatexRender(trimmed)) {
      cursor = at + hit[0].length
      continue
    }

    if (start + lead > cursor) out.push({ math: false, value: text.slice(cursor, start + lead) })
    out.push({ math: true, value: trimmed })
    cursor = end - tail
    if (end <= at) break   // страховка від нескінченного циклу
  }

  if (cursor < text.length) out.push({ math: false, value: text.slice(cursor) })
  return out.length ? out : [{ math: false, value: text }]
}

/**
 * Прибрати документну розмітку LaTeX із текстового шматка.
 *
 * B-клас виміру: 72 входження. Це команди верстки документа, а не формул —
 * KaTeX їх не побачить навіть теоретично, бо вони поза математикою.
 * Перетворюємо у markdown-lite, який рендерер уже вміє (`**`), або в пробіл.
 */
export function cleanTextSegment(text: string): string {
  if (!text || !text.includes('\\')) return text
  let s = text

  // Обгортки-середовища без власного змісту.
  s = s.replace(/\\(begin|end)\{(center|itemize|enumerate|flushleft|flushright|small|footnotesize)\}/g, '')

  // Абзац і елементи списку.
  // `(?![a-zA-Z])` — щоб `\par` не з'їв `\parallel`, а `\item` — `\itemsep`.
  s = s.replace(/\\par(?![a-zA-Z])/g, '\n\n')
  s = s.replace(/\\item(?![a-zA-Z])\s*/g, '\n• ')

  // Накреслення → markdown-lite (renderInlineMarkdown уже розуміє **).
  s = s.replace(/\\textbf\{([^{}]*)\}/g, '**$1**')
  s = s.replace(/\\(?:textit|emph)\{([^{}]*)\}/g, '**$1**')
  s = s.replace(/\\(?:text|mathrm|operatorname)\{([^{}]*)\}/g, '$1')

  // Відступи й розміри — у тексті це просто пробіл.
  s = s.replace(/\\(?:quad|qquad|,|;|:|!)(?![a-zA-Z])/g, ' ')
  s = s.replace(/\\(?:kern|hspace|vspace)\s*\{?[-\d.]+[a-z]{0,2}\}?/g, ' ')
  s = s.replace(/\\(?:small|large|Large|normalsize|footnotesize)(?![a-zA-Z])/g, '')
  s = s.replace(/\\\\(?!\S)/g, '\n')

  return s
}

// ─────────────────────────────────────────────────────────────────────────
// Шар 3 — математичні сегменти
// ─────────────────────────────────────────────────────────────────────────

const ARRAY_OPEN = '\\begin{array}{'

/**
 * Вирізати `@{...}` зі специфікації колонок `\begin{array}{...}`.
 *
 * G-клас, найбільший серед червоних: 96 входжень. `@{}` — вставка між
 * колонками з пакета `array`; KaTeX її не знає й не планує. Для стовпчика
 * вона суто косметична (тонкий пробіл), тож видалення не змінює змісту.
 *
 * Скан із підрахунком глибини, а НЕ регекс. Перша спроба була регексом
 * `\{([^}]*)\}` — і мовчки давала spec `r@{\,`, бо специфікація сама містить
 * дужки. Вердикт після «фіксу» не мінявся, і без окремої перевірки це
 * виглядало б як «фікс не допоміг».
 */
export function stripArrayColumnSeparators(tex: string): string {
  if (!tex.includes(ARRAY_OPEN)) return tex

  let out = ''
  let i = 0
  for (;;) {
    const at = tex.indexOf(ARRAY_OPEN, i)
    if (at === -1) { out += tex.slice(i); break }
    out += tex.slice(i, at + ARRAY_OPEN.length)

    let depth = 1
    let j = at + ARRAY_OPEN.length
    while (j < tex.length && depth > 0) {
      if (tex[j] === '{') depth++
      else if (tex[j] === '}') depth--
      if (depth > 0) j++
    }
    out += removeAtGroups(tex.slice(at + ARRAY_OPEN.length, j))
    i = j
  }
  return out
}

function removeAtGroups(spec: string): string {
  let clean = ''
  let k = 0
  while (k < spec.length) {
    if (spec[k] === '@' && spec[k + 1] === '{') {
      let depth = 1
      let m = k + 2
      while (m < spec.length && depth > 0) {
        if (spec[m] === '{') depth++
        else if (spec[m] === '}') depth--
        m++
      }
      k = m
    } else {
      clean += spec[k]
      k++
    }
  }
  return clean
}

/**
 * `tabular` → `array`.
 *
 * D-клас: 16 входжень. `tabular` — текстове середовище LaTeX; KaTeX його не
 * має взагалі. Але зміст у наших випадках суто числовий (стовпчик додавання),
 * а `array` приймає ту саму специфікацію колонок — тож заміна імені досить.
 */
function tabularToArray(tex: string): string {
  return tex
    .replace(/\\begin\{tabular\}/g, '\\begin{array}')
    .replace(/\\end\{tabular\}/g, '\\end{array}')
}

/**
 * Рядки, розділені ПЕРЕНОСОМ, перетворити на рядки, розділені `\\`.
 *
 * 🔴 Найпідступніший клас: KaTeX такий `array` рендерить БЕЗ ПОМИЛКИ — просто
 * складає всі рядки в один. Формально чисто, а стовпчик зник:
 *
 *     \begin{array}{r@{\,}l}⏎10{,}4⏎-6{,}2⏎\hline⏎\end{array}
 *     → «10,4 − 6,2» одним рядком замість стовпчика
 *
 * Мій аудит цього не ловив узагалі, бо міряв «KaTeX не впав», а не «виглядає
 * правильно». Знайшов ВЛАСНИК очима на скріншоті — і саме тому вимір ніколи
 * не замінює погляд на екран.
 *
 * Масштаб після заміру: **59 із 141** середовищ у банку (42%) — саме такі.
 */
function newlineRowsToBreaks(tex: string): string {
  return tex.replace(
    /(\\begin\{(array|tabular)\}(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?)([\s\S]*?)(\\end\{\2\})/g,
    (whole, open: string, _env: string, body: string, close: string) => {
      if (/\\\\/.test(body)) return whole            // розриви вже є
      const rows = body.split('\n').map((r) => r.trim()).filter(Boolean)
      if (rows.length < 2) return whole
      let joined = rows.join(' \\\\ ')
      // Після горизонтальної риски розрив зайвий — інакше з'явиться порожній рядок.
      joined = joined.replace(/\\hline\s*\\\\/g, '\\hline ')
      joined = joined.replace(/\s*\\\\\s*$/, '')
      return `${open} ${joined} ${close}`
    })
}

/**
 * `\hline` мусить стояти на початку рядка таблиці.
 *
 * E-клас: 21 входження, і всі — червоні. У банку трапляється
 * `...\\+19{,}6\hline\end{array}`: риска приліплена до кінця останнього
 * числа без `\\` перед нею. KaTeX на це каже «\hline valid only within array
 * environment» — повідомлення збиває з пантелику, бо середовище на місці.
 */
function fixHlinePosition(tex: string): string {
  if (!tex.includes('\\hline')) return tex
  // Ставимо `\\` перед `\hline`, якщо його там немає.
  return tex.replace(/([^\\\s])\s*\\hline/g, '$1\\\\\\hline')
}

/**
 * Єдина точка входу для математичних сегментів.
 *
 * Навмисно одна функція, а не набір: наступну несумісність додавати сюди,
 * щоб обидва рендерери (`contentRenderer`, `MathExpr`) лікувались разом.
 * Розійтись вони можуть тихо — у них навіть `throwOnError` різний.
 */
export function toKatexCompatible(tex: string): string {
  if (!tex) return tex
  // Долари всередині математичного сегмента не валідні НІКОЛИ — KaTeX уже в
  // режимі формули. У банку вони трапляються всередині середовищ:
  // `\begin{tabular}{r} $6{,}2$ $+$\kern0.5em$2{,}5$ \hline \end{tabular}` —
  // модель поставила роздільники навколо кожного числа, ніби це текст.
  // Поки середовище лежало голим, вони були нешкідливі; щойно ми стали брати
  // його в `$$…$$`, KaTeX почав казати «Can't use function '$' in math mode».
  const noDollars = tex.replace(/\$\$?/g, '')
  // `\-` — це м'який перенос слова з текстового LaTeX; у формулі модель ставить
  // його замість мінуса, і KaTeX друкує бекслеш буквально: «20,43\-10,75» на
  // скріншоті власника. Трьох таких фрагментів у банку, але вигляд псують
  // повністю, а виправлення однозначне.
  //
  // 🔴 `(?<!\\)` — той самий капкан, що й із `\\[2pt]`, і я вскочила в нього
  // вдруге. У рядку `10{,}4 \\ -6{,}2` послідовність `\\-` — це ПЕРЕНОС плюс
  // мінус; регекс без захисту з'їдав другий бекслеш і перетворював розрив на
  // справжній `\-`, якого KaTeX не знає. Червоних побільшало з 10 до 11 —
  // тобто «фікс» на три випадки зламав два інших.
  const noSoftHyphen = noDollars.replace(/(?<!\\)\\-/g, '-')
  return fixHlinePosition(
    newlineRowsToBreaks(stripArrayColumnSeparators(tabularToArray(noSoftHyphen))))
}
