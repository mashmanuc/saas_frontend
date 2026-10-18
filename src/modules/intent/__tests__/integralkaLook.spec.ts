/**
 * «Інтегралка» — другий вигляд того самого помічника (рішення власника 2026-10-12: «Додавати, але з
 * назвою Інтегралка»; «все лишити, бантик поверх капелюха»). ТЗ
 * `saas_docs/domains/intent/TZ_INTEGRALYK_INTEGRALKA_VARIANT_2026-10-11.md`.
 *
 * Тут — малюнок (з вихідника дизайнера integral5 `ASSISTANT_ICON_GIRL`), назви й ключі перекладу.
 * Вибір і збереження — `AssistantLookPicker.spec.ts`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  INTEGRALYK_SVG,
  INTEGRALKA_SVG,
  INTEGRALKA_SVG_SORRY,
  INTEGRALYK_SVG_SORRY,
  paletteMascotSvg,
  previewMascotSvg,
} from '../integralykMascotSvg'
import { ASSISTANT_NAMES, assistantKey, assistantLookOf } from '../assistantLook'
import { integralykServerDisabledMessage } from '../integralykAccess'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import paletteSource from '../CommandPalette.vue?raw'

const BODY_D = 'M60 22 C55 12, 42 14, 42 27 C42 42, 58 52, 58 70 C58 85, 45 92, 40 82'

describe('малюнок «Інтегралки»', () => {
  it('той самий персонаж: контур, очі, рука, слоти й класи анімацій — як у Інтегралика', () => {
    for (const marker of [BODY_D, 'cx="43" cy="34"', 'cx="55" cy="40"', 'M68 58 Q76 52 74 42',
      'class="itg-mood"', 'class="itg-accessory"', 'class="itg-body"', 'class="itg-pupil"', 'class="itg-arm"',
      'itg-eye itg-e2', '<circle cx="50" cy="50" r="46" fill="#d6f1ed" stroke="#0d9488"']) {
      expect(INTEGRALYK_SVG, marker).toContain(marker)
      expect(INTEGRALKA_SVG, marker).toContain(marker)
    }
  })

  it('відмінності — лише з макета: малиновий колір, вії, бантик', () => {
    expect(INTEGRALKA_SVG).toContain('stroke="#b3476a"')
    expect(INTEGRALKA_SVG).toContain('fill="#7a2d45"')
    expect(INTEGRALKA_SVG).not.toContain('#0f5f57')
    expect(INTEGRALKA_SVG).toContain('class="itg-bow"')
    expect(INTEGRALKA_SVG).toContain('M36 30 l-3 -2')    // вії лівого ока
    expect(INTEGRALKA_SVG).toContain('M62 36 l3 -2')     // вії правого ока
    expect(INTEGRALYK_SVG).not.toContain('itg-bow')
    expect(INTEGRALYK_SVG).not.toContain('M36 30 l-3 -2')
  })

  it('бантик поверх капелюха: малюється ПІСЛЯ слота аксесуара', () => {
    expect(INTEGRALKA_SVG.indexOf('class="itg-bow"')).toBeGreaterThan(INTEGRALKA_SVG.indexOf('class="itg-accessory"'))
  })

  it('вії — усередині ока (кліпають разом із ним)', () => {
    const leftEye = INTEGRALKA_SVG.slice(INTEGRALKA_SVG.indexOf('<g class="itg-eye"'), INTEGRALKA_SVG.indexOf('</g>', INTEGRALKA_SVG.indexOf('<g class="itg-eye"')))
    expect(leftEye).toContain('M36 30 l-3 -2')
  })

  it('екран помилки й прев\'ю — теж у вигляді; прев\'ю без слотів палітри', () => {
    expect(INTEGRALKA_SVG_SORRY).toContain('itg-bow')
    expect(INTEGRALKA_SVG_SORRY).toContain('M40 44 Q37 51')   // сльозинка
    expect(INTEGRALYK_SVG_SORRY).not.toContain('itg-bow')
    expect(previewMascotSvg('integralka')).not.toContain('itg-accessory')
    expect(previewMascotSvg('integralka')).toContain('itg-bow')
    expect(paletteMascotSvg('integralka')).toBe(INTEGRALKA_SVG)
    expect(paletteMascotSvg('integralyk')).toBe(INTEGRALYK_SVG)
  })
})

describe('вибір і назви', () => {
  it('дефолт — чинний Інтегралик: нове, старе (без поля) й невідоме значення', () => {
    expect(assistantLookOf(null)).toBe('integralyk')
    expect(assistantLookOf({})).toBe('integralyk')
    expect(assistantLookOf({ integralyk_appearance: 'radikalka' })).toBe('integralyk')
    expect(assistantLookOf({ integralyk_appearance: 'integralka' })).toBe('integralka')
  })

  it('відмінки в українській', () => {
    expect(ASSISTANT_NAMES.integralka.uk).toMatchObject({
      nom: 'Інтегралка', gen: 'Інтегралки', dat: 'Інтегралці', acc: 'Інтегралку', ins: 'Інтегралкою',
      // Власник 2026-10-18: ім'я помічника одне — без «AI».
      role: 'помічниця', roleAcc: 'помічницю',
    })
    expect(ASSISTANT_NAMES.integralyk.uk.acc).toBe('Інтегралика')
    expect(integralykServerDisabledMessage('integralka')).toBe('Інтегралку вимкнено на цьому сервері.')
    expect(integralykServerDisabledMessage('integralyk')).toBe('Інтегралик вимкнено на цьому сервері.')
  })

  it('ключ: варіант «Інтегралки», якщо є в мові або в запасній uk; інакше — базовий', () => {
    const have = new Set(['a.bIntegralka@uk'])
    const te = (k: string, l?: string) => have.has(`${k}@${l ?? 'ru'}`)
    expect(assistantKey('a.b', 'integralyk', te)).toBe('a.b')
    expect(assistantKey('a.b', 'integralka', te)).toBe('a.bIntegralka')   // ru бере з uk, як і базовий
    expect(assistantKey('c.d', 'integralka', te)).toBe('c.d')
  })
})

type Tree = Record<string, unknown>
function flat(o: Tree, p = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k
    if (v && typeof v === 'object') Object.assign(out, flat(v as Tree, key))
    else if (typeof v === 'string') out[key] = v
  }
  return out
}

describe('переклади «Інтегралки»', () => {
  const L = { uk: flat(uk as Tree), en: flat(en as Tree), ru: flat(ru as Tree) }
  const OLD = /Інтегралик|Integralyk|Интегралик/
  const variants = (loc: keyof typeof L) => Object.keys(L[loc]).filter((k) => k.endsWith('Integralka'))

  it('кожен варіант має базовий ключ у тій самій мові й не містить старого імені', () => {
    for (const loc of ['uk', 'en', 'ru'] as const) {
      for (const k of variants(loc)) {
        expect(L[loc][k.slice(0, -'Integralka'.length)], `${loc}:${k}`).toBeTruthy()
        expect(L[loc][k], `${loc}:${k}`).not.toMatch(OLD)
      }
    }
  })

  it('UI помічника: кожен рядок з іменем має варіант (uk, en; ru — де є базовий)', () => {
    const SCOPE = /^(winterboard\.remote\.(assistant\.|minimizeAssistant)|winterboard\.imageReading\.|winterboard\.enrich\.question|users\.settings\.general\.(integralyk|subjectsHint))/
    for (const loc of ['uk', 'en', 'ru'] as const) {
      const missing = Object.entries(L[loc])
        .filter(([k, v]) => SCOPE.test(k) && !k.endsWith('Integralka') && OLD.test(v) && !L[loc][`${k}Integralka`])
        .map(([k]) => k)
      expect(missing, loc).toEqual([])
    }
  })

  it('«Радикалка» (назва з макета) у продукті ніде не з’являється', () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) { if (name !== '__tests__') walk(p); continue }
        if (/\.(vue|ts|js|json)$/.test(name) && /Радикалк|Radikalk|Радикалочк/i.test(readFileSync(p, 'utf8'))) hits.push(p)
      }
    }
    walk(join(__dirname, '../../..'))
    expect(hits).toEqual([])
  })
})

describe('панель помічника читає вигляд, а не вшите ім’я', () => {
  it('малюнок і назви — з вигляду; перемикач у шапці панелі, не на плаваючій кнопці', () => {
    expect(paletteSource).toContain('const MASCOT_SVG = computed(() => paletteMascotSvg(assistantLook.value))')
    expect(paletteSource).toContain('assistantName: nameUk.value.nom')
    expect(paletteSource).toContain('openAssistant: `Відкрити ${nameUk.value.acc} — ${nameUk.value.roleAcc}`')
    expect(paletteSource).toContain('`Приховати ${nameUk.value.acc}? Увімкнути назад — у Налаштуваннях.`')
    expect(paletteSource).toContain('`Привіт! Я ${nameUk.value.nom} 👋')
    // Відповіді пульту складає ноутбук — у вигляді вчителя
    expect(paletteSource).toContain('t: (key, params) => tAssistant(key, params)')
    // Перемикач — двічі (шапка команд і шапка діалогу), і жодного біля FAB
    expect(paletteSource.match(/<AssistantLookPicker variant="compact"/g)).toHaveLength(2)
    const fab = paletteSource.slice(0, paletteSource.indexOf('class="cmdp-head cmdp-brand"'))
    expect(fab).not.toContain('AssistantLookPicker')
  })

  it('у видимих рядках панелі не лишилось вшитого «Інтегралик»', () => {
    const lines = paletteSource.split('\n')
      .filter((l) => /Інтегралик/.test(l))
      .filter((l) => !/^\s*(\/\/|\*|<!--|\/\*)/.test(l))      // коментарі
      .filter((l) => !/console\.(error|warn)/.test(l))        // журнал розробника
      .filter((l) => !/'Інтегралику' : 'Інтегралик'|'Інтегралку' : 'Інтегралик'/.test(l))
    expect(lines).toEqual([])
  })
})
