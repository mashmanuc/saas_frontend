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

const INK = '#0f5f57'

/** Тло-кружечок. */
const RING = '<circle cx="50" cy="50" r="46" fill="#d6f1ed" stroke="#0d9488" stroke-width="3"></circle>'

/** Тіло-«інтеграл». */
const BODY =
  `<path d="M60 22 C55 12, 42 14, 42 27 C42 42, 58 52, 58 70 C58 85, 45 92, 40 82" fill="none" stroke="${INK}"`
  + ' stroke-width="8" stroke-linecap="round" stroke-linejoin="round"></path>'

/** Рука — нею палітра махає (`.itg-arm`). */
const ARM = `<path class="itg-arm" d="M68 58 Q76 52 74 42" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"></path>`

/** Легка сльозинка — екран помилки: трохи винуватий, що підвів. */
const TEAR = '<path d="M40 44 Q37 51 40 55 Q43 51 40 44 Z" fill="#7fc8ff" stroke="#3b9fe0" stroke-width="1"></path>'

function brow(d: string): string {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"></path>`
}

/** Око: білок + зіниця. `pupilDy` — наскільки зіниця опущена (винуватий погляд). */
function eye(cx: number, cy: number, extraClass: string, pupilClass: boolean, pupilDy: number): string {
  const cls = extraClass ? `itg-eye ${extraClass}` : 'itg-eye'
  const pupil = pupilClass ? ' class="itg-pupil"' : ''
  return `<g class="${cls}" style="transform-origin:${cx}px ${cy}px;">`
    + `<circle cx="${cx}" cy="${cy}" r="7" fill="#fff" stroke="${INK}" stroke-width="2"></circle>`
    + `<circle${pupil} cx="${cx}" cy="${cy + pupilDy}" r="3.5" fill="${INK}"></circle></g>`
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
}

export function buildIntegralykSvg(options: IntegralykSvgOptions): string {
  const look = LOOKS[options.look]
  return `<svg viewBox="0 0 100 100"${options.ariaHidden ? ' aria-hidden="true"' : ''}>`
    + RING
    + (options.slots ? '<g class="itg-mood"></g>' : '')
    + '<g class="itg-body">'
    + BODY
    + brow(look.brows[0])
    + brow(look.brows[1])
    + eye(43, 34, '', look.pupilClass, look.pupilDy)
    + eye(55, 40, 'itg-e2', look.pupilClass, look.pupilDy)
    + (options.arm ? ARM : '')
    + (options.tear ? TEAR : '')
    + (options.slots ? '<g class="itg-accessory"></g>' : '')
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
