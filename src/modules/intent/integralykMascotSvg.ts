/**
 * Інтегралик — ОДИН малюнок персонажа на весь застосунок (вигляд — з DATA/integral/integral4).
 *
 * До 2026-10-11 SVG був вшитий рядком у двох місцях (палітра команд на дошці й екран помилки),
 * і третє місце (лендінг /start, ТЗ TZ_START_INTEGRALYK_HINTS_2026-10-11) дало б третю копію.
 * Тепер усі беруть звідси; рядки для наявних місць побайтово ті самі, що були (хеші — у тесті
 * `__tests__/integralykMascotSvg.spec.ts`), тож їхній вигляд не змінився.
 *
 * БЕЗ РОТА (дизайнерське рішення): вираз — очима, бровами, рукою. Дихання/кліпання — CSS того,
 * хто показує (класи `itg-body`, `itg-eye`, `itg-e2`; `itg-pupil` — зіниці, за якими стежить палітра).
 *
 * ⚠️ БЕЗ ІМПОРТІВ: модуль бере `AppErrorBoundary` — екран, що мусить намалюватись, навіть коли
 * впало все інше. Тут лише рядки.
 */

/**
 * Вигляд помічника (рішення власника 2026-10-12, ТЗ TZ_INTEGRALYK_INTEGRALKA_VARIANT): «Інтегралка» —
 * той самий персонаж, ті самі контури, очі, брови, рука й анімації. Відмінності — лише з вихідника
 * дизайнера (DATA/integral/integral5.zip → grapher/assistant-icon.js, `ASSISTANT_ICON_GIRL`):
 * малиновий колір, вії над очима й бантик. Бантик малюється ПІСЛЯ слота аксесуара — поверх капелюха
 * чи ковпака (слово власника: «бантик поверх капелюха»).
 */
export type IntegralykLook = 'integralyk' | 'integralka'

interface LookPalette {
  /** Контур тіла, брів, білків і рука. */
  ink: string
  /** Зіниці. */
  pupil: string
  /** Вії (лише «Інтегралка»). */
  lashes: [string, string] | null
  /** Бантик (лише «Інтегралка»). */
  bow: string
}

const PALETTES: Record<IntegralykLook, LookPalette> = {
  integralyk: { ink: '#0f5f57', pupil: '#0f5f57', lashes: null, bow: '' },
  integralka: {
    ink: '#b3476a',
    pupil: '#7a2d45',
    lashes: ['M36 30 l-3 -2 M37 28 l-2 -3 M40 27 l-1 -3', 'M62 36 l3 -2 M61 34 l2 -3 M58 33 l1 -3'],
    bow: '<g class="itg-bow">'
      + '<path d="M50 13 L39 7 L39 19 Z" fill="#f9738d" stroke="#b3476a" stroke-width="1.6" stroke-linejoin="round"></path>'
      + '<path d="M50 13 L61 7 L61 19 Z" fill="#f9738d" stroke="#b3476a" stroke-width="1.6" stroke-linejoin="round"></path>'
      + '<circle cx="50" cy="13" r="3.2" fill="#fda4b8" stroke="#b3476a" stroke-width="1.6"></circle></g>',
  },
}

/** Тло-кружечок — однакове для обох виглядів. */
const RING = '<circle cx="50" cy="50" r="46" fill="#d6f1ed" stroke="#0d9488" stroke-width="3"></circle>'

/** Тіло-«інтеграл». */
function body(ink: string): string {
  return `<path d="M60 22 C55 12, 42 14, 42 27 C42 42, 58 52, 58 70 C58 85, 45 92, 40 82" fill="none" stroke="${ink}"`
    + ' stroke-width="8" stroke-linecap="round" stroke-linejoin="round"></path>'
}

/** Рука — нею палітра махає (`.itg-arm`). */
function arm(ink: string): string {
  return `<path class="itg-arm" d="M68 58 Q76 52 74 42" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"></path>`
}

/** Легка сльозинка — екран помилки: трохи винуватий, що підвів. */
const TEAR = '<path d="M40 44 Q37 51 40 55 Q43 51 40 44 Z" fill="#7fc8ff" stroke="#3b9fe0" stroke-width="1"></path>'

function brow(d: string, ink: string): string {
  return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"></path>`
}

/**
 * Око: білок + зіниця (+ вії «Інтегралки» — усередині ока, тож кліпають разом із ним).
 * `pupilDy` — наскільки зіниця опущена (винуватий погляд).
 */
function eye(cx: number, cy: number, extraClass: string, pupilClass: boolean, pupilDy: number,
  p: LookPalette, lashes: string | null): string {
  const cls = extraClass ? `itg-eye ${extraClass}` : 'itg-eye'
  const pupil = pupilClass ? ' class="itg-pupil"' : ''
  return `<g class="${cls}" style="transform-origin:${cx}px ${cy}px;">`
    + `<circle cx="${cx}" cy="${cy}" r="7" fill="#fff" stroke="${p.ink}" stroke-width="2"></circle>`
    + `<circle${pupil} cx="${cx}" cy="${cy + pupilDy}" r="3.5" fill="${p.pupil}"></circle>`
    + (lashes ? `<path d="${lashes}" stroke="${p.pupil}" stroke-width="1.4" stroke-linecap="round"></path>` : '')
    + '</g>'
}

/** Вираз обличчя: брови + положення зіниць. */
const LOOKS = {
  /** Звичайний: брови рівні, зіниці по центру й «живі» (`itg-pupil`). */
  calm: { brows: ['M37 24 Q43 23 48 26', 'M51 29 Q56 28 61 31'], pupilClass: true, pupilDy: 0 },
  /** Винуватий (екран помилки): брови домиком, погляд донизу. */
  sorry: { brows: ['M37 25 Q43 27 48 25', 'M51 30 Q56 32 61 30'], pupilClass: false, pupilDy: 1.5 },
} as const

export interface IntegralykSvgOptions {
  look: keyof typeof LOOKS
  /** Рука `.itg-arm`. */
  arm?: boolean
  /**
   * Порожні слоти настрою (`.itg-mood`) й аксесуара (`.itg-accessory`). Палітра заповнює їх
   * через `document.querySelectorAll` — тобто ВСІ слоти на сторінці, тож там, де настрій палітри
   * не потрібен, слотів не ставимо.
   */
  slots?: boolean
  tear?: boolean
  /** `aria-hidden` на самому `<svg>` (коли обгортка його не ставить). */
  ariaHidden?: boolean
  /** Вигляд помічника; без нього — чинний Інтегралик (побайтово той самий рядок). */
  appearance?: IntegralykLook
}

export function buildIntegralykSvg(options: IntegralykSvgOptions): string {
  const look = LOOKS[options.look]
  const p = PALETTES[options.appearance ?? 'integralyk']
  return `<svg viewBox="0 0 100 100"${options.ariaHidden ? ' aria-hidden="true"' : ''}>`
    + RING
    + (options.slots ? '<g class="itg-mood"></g>' : '')
    + '<g class="itg-body">'
    + body(p.ink)
    + brow(look.brows[0], p.ink)
    + brow(look.brows[1], p.ink)
    + eye(43, 34, '', look.pupilClass, look.pupilDy, p, p.lashes?.[0] ?? null)
    + eye(55, 40, 'itg-e2', look.pupilClass, look.pupilDy, p, p.lashes?.[1] ?? null)
    + (options.arm ? arm(p.ink) : '')
    + (options.tear ? TEAR : '')
    + (options.slots ? '<g class="itg-accessory"></g>' : '')
    // Після слота аксесуара — бантик лежить поверх капелюха/ковпака.
    + p.bow
    + '</g></svg>'
}

/**
 * Палітра команд на дошці (`CommandPalette.vue`): зі слотами настрою/аксесуара — скіни за часом
 * доби. Рендериться двічі (fab + шапка), тому класи, а не id.
 */
export const INTEGRALYK_SVG = buildIntegralykSvg({ look: 'calm', arm: true, slots: true, ariaHidden: true })

/** Екран помилки (`AppErrorBoundary.vue`): винуватий погляд і сльозинка, без руки. */
export const INTEGRALYK_SVG_SORRY = buildIntegralykSvg({ look: 'sorry', tear: true })

/**
 * Окремо від палітри (лендінг /start): той самий персонаж, але без слотів — настрій і скіни
 * палітри (якщо вона десь відкрита) його не зачеплять.
 */
export const INTEGRALYK_SVG_STANDALONE = buildIntegralykSvg({ look: 'calm', arm: true, ariaHidden: true })

/** «Інтегралка» для палітри — ті самі слоти, що в `INTEGRALYK_SVG`. */
export const INTEGRALKA_SVG = buildIntegralykSvg({ look: 'calm', arm: true, slots: true, ariaHidden: true, appearance: 'integralka' })

/** «Інтегралка» на екрані помилки — коли застосунок знає вибір користувача. */
export const INTEGRALKA_SVG_SORRY = buildIntegralykSvg({ look: 'sorry', tear: true, appearance: 'integralka' })

/** Прев'ю для вибору вигляду: без слотів — скіни палітри (капелюх, кава) його не чіпають. */
export function previewMascotSvg(appearance: IntegralykLook): string {
  return buildIntegralykSvg({ look: 'calm', arm: true, ariaHidden: true, appearance })
}

/** Малюнок палітри за виглядом. */
export function paletteMascotSvg(appearance: IntegralykLook): string {
  return appearance === 'integralka' ? INTEGRALKA_SVG : INTEGRALYK_SVG
}
