// Точка x₀ з тексту умови задачі — для картки похідної від «Побудувати».
//
// Навіщо (прод 2026-09-22): «Знайдіть значення похідної функції … у точці
// x₀ = 3» — картка ставала в x₀ = 1, бо fingerprint задачі точки не несе
// (бекенд кладе в extracted_data лише equations/x_range). Читаємо x₀ з умови
// в момент «Побудувати», тож працює для всього банку без перезбагачення.
//
// Лише явні записи: «x₀ = 3», «x_0 = -1», «x_{0}=\frac{1}{2}», «у точці x = 2»,
// «з абсцисою 2», «f′(1)». Не впевнені — null (картка лишить своє типове x₀).

const NUM = String.raw`-?\d+(?:\.\d+)?(?:/-?\d+(?:\.\d+)?)?`

/** LaTeX / Юнікод → плоский текст, у якому шукаємо число. */
function normalize(q: string): string {
  return q
    .replace(/\\[dt]?frac\s*\{\s*([^{}]+?)\s*\}\s*\{\s*([^{}]+?)\s*\}/g, '$1/$2')
    .replace(/\\left|\\right|\\,|\\;|\\!|\\\(|\\\)|\\\[|\\\]|\$/g, ' ')
    .replace(/[−–]/g, '-')
    .replace(/(\d),(\d)/g, '$1.$2')
    // x_0, x_{0}, x₀, x0 → один маркер
    .replace(/x\s*(?:_\s*\{\s*0\s*\}|_\s*0|₀|0)(?![\d.])/g, ' X0 ')
    // пробіли всередині числа («- 3», «1 / 2») — прибрати
    .replace(/-\s+(?=\d)/g, '-')
    .replace(/(\d)\s*\/\s*(?=-?\d)/g, '$1/')
    .replace(/\s+/g, ' ')
}

function parseNum(s: string): number | null {
  const [a, b] = s.split('/')
  const n = Number(a)
  const d = b === undefined ? 1 : Number(b)
  const v = n / d
  return Number.isFinite(v) ? v : null
}

const PATTERNS: RegExp[] = [
  new RegExp(String.raw`X0 ?= ?(${NUM})`),
  // «у точці x = 2», «в точці з абсцисою x = 2»
  new RegExp(String.raw`точц[іи] (?:з абсцисою )?x ?= ?(${NUM})`, 'i'),
  // «у точці з абсцисою 2»
  new RegExp(String.raw`абсцис(?:ою|а) (${NUM})(?![\w])`, 'i'),
  // «знайдіть f′(1)», «y'(-2)» — значення похідної в точці
  new RegExp(String.raw`[fy] ?(?:'|′|\\prime|\^\{?\\prime\}?) ?\( ?(${NUM}) ?\)`),
]

/** x₀ з умови задачі або null, якщо явного запису немає. */
export function extractX0(question: string | null | undefined): number | null {
  if (!question) return null
  const q = normalize(question)
  for (const re of PATTERNS) {
    const m = re.exec(q)
    if (m) return parseNum(m[1])
  }
  return null
}
