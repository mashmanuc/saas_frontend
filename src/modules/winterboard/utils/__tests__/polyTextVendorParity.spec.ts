import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderPoly } from '../polyText'

/**
 * ⚠️ НАВІЩО ЦЕЙ ТЕСТ. Правило «не писати коефіцієнт 1 і нульовий доданок»
 * живе у ДВОХ місцях: `utils/polyText.ts` (спільний помічник) і
 * `vendor/quad/quad-card.js` (самодостатній IIFE без імпортів — узяти
 * спільний він не може за побудовою).
 *
 * Дубль без тесту розходиться з першою ж правкою. Тому тут беремо
 * СПРАВЖНІЙ вихідний код vendor-файлу, витягуємо з нього `fmt`, `term` і
 * `poly` як вони є, і проганяємо тими самими випадками, що й
 * `polyText.spec.ts`. Розбіжність — падіння тесту, а не сюрприз на дошці.
 */

const VENDOR = resolve(
  __dirname, '..', '..', 'vendor', 'quad', 'quad-card.js',
)

/** Витягти тіло однієї стрілкової константи з вихідника vendor-файлу. */
function extractConst(src: string, name: string): string {
  const start = src.indexOf(`  const ${name} = `)
  if (start < 0) throw new Error(`у vendor немає const ${name}`)
  // кінець — рядок «  };» на тому самому рівні відступу
  const end = src.indexOf('\n  };', start)
  if (end < 0) throw new Error(`не знайдено кінець const ${name}`)
  return src.slice(start, end + '\n  };'.length)
}

function loadVendorPoly(): (t: Array<[number, string]>) => string {
  const src = readFileSync(VENDOR, 'utf8')
  const code = [
    extractConst(src, 'fmt'),
    extractConst(src, 'term'),
    extractConst(src, 'poly'),
    'return poly;',
  ].join('\n')
  // eslint-disable-next-line no-new-func
  return new Function(code)() as (t: Array<[number, string]>) => string
}

const CASES: Array<[Array<[number, string]>, string]> = [
  [[[1, 'x²'], [-1, 'x'], [-6, '']], 'x² − x − 6'],
  [[[-1, 'x²'], [3, 'x'], [2, '']], '−x² + 3x + 2'],
  [[[2, 'x²'], [0, 'x'], [-5, '']], '2x² − 5'],
  [[[2, 'x²'], [3, 'x'], [0, '']], '2x² + 3x'],
  [[[1, 'x²'], [0, 'x'], [1, '']], 'x² + 1'],
  [[[0, 'x²'], [0, 'x'], [0, '']], '0'],
  [[[0.5, 'x²'], [-2.25, '']], '0,5x² − 2,25'],
]

describe('vendor/quad — запис многочлена не розійшовся зі спільним', () => {
  const vendorPoly = loadVendorPoly()

  it.each(CASES)('%j → %s', (terms, want) => {
    expect(vendorPoly(terms)).toBe(want)
    expect(renderPoly(terms)).toBe(want)
  })

  it('обидві копії дають однаковий результат на випадкових наборах', () => {
    let seed = 7
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let i = 0; i < 300; i++) {
      const pick = () => Math.round((rnd() * 8 - 4) * 100) / 100
      const terms: Array<[number, string]> = [
        [pick(), 'x²'], [pick(), 'x'], [pick(), ''],
      ]
      expect(vendorPoly(terms)).toBe(renderPoly(terms))
    }
  })
})
