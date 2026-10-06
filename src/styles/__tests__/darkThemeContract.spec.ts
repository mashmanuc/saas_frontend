/**
 * Темна тема — контракт кольорів (Б-156, фаза 1).
 *
 * Рішення власника 2026-10-05: «став тему Графіт, а Ліс запасна і прихована».
 * Контракт: saas_docs/frontend/design-system/DARK_THEME_CONTRACT_2026-10-05.md
 *
 * Що стережемо:
 *  1. Темна тема («Графіт») оголошує всі канонічні токени; запасна палітра «Нічний ліс»
 *     перевизначає ті самі (крім похідних --color-selected / --color-link).
 *  2. Контраст обох палітр на всіх поверхнях не нижчий за таблицю контракту (WCAG).
 *  3. Світла й класична не оголошують канонічних імен, які компоненти вже вживають як
 *     фантоми з власним запасним кольором: оголошення змінило б світлий вигляд
 *     (це зробить фаза 4 разом із заміною викликів).
 *  4. Перехідний міст діє лише в темній темі — жодне його правило не досягає світлої.
 *  5. Немає глобального `[data-theme="dark"] label`: він фарбував підписи у світлий колір
 *     і на білих островах вони зникали («Зберегти як урок», 2026-10-05).
 *  6. Білий текст на акцентній заливці не повертається: у темній темі акцент світлий,
 *     тож текст на ньому — лише var(--color-on-accent) (у світлій він і далі білий).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = resolve(__dirname, '../..')
const mainCss = readFileSync(join(SRC, 'assets/main.css'), 'utf8')
const bridgeCss = readFileSync(join(SRC, 'styles/theme-dark-bridge.css'), 'utf8')

const CANONICAL = [
  'page', 'chrome', 'surface', 'surface-sunken', 'surface-elevated', 'hover', 'selected',
  'text', 'text-secondary', 'text-muted', 'border', 'border-strong',
  'accent', 'accent-hover', 'accent-soft', 'on-accent', 'link',
  'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft',
  'info', 'info-soft', 'scrim', 'canvas-area',
].map((n) => `--color-${n}`)
const DERIVED = ['--color-selected', '--color-link']

/** Декларації всіх блоків із точно таким селектором (у main.css блоків темної теми кілька). */
function declarations(selectorRe: RegExp): Record<string, string> {
  const out: Record<string, string> = {}
  const blockRe = new RegExp(`${selectorRe.source}\\s*\\{([^}]*)\\}`, 'g')
  for (const m of mainCss.matchAll(blockRe)) {
    for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim()
  }
  return out
}

const dark = declarations(/(?<![\w\]-])\[data-theme="dark"\]/)
const forest = declarations(/\[data-theme="dark"\]\[data-dark-palette="forest"\]/)
const light = declarations(/:root,\s*\[data-theme="light"\]/)
const classic = declarations(/(?<![\w\]-])\[data-theme="classic"\]/)

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('Темна тема: палітри', () => {
  it('«Графіт» (dark) оголошує всі канонічні токени', () => {
    expect(CANONICAL.filter((t) => !(t in dark))).toEqual([])
  })

  it('запасна «Нічний ліс» перевизначає ті самі токени, крім похідних', () => {
    const own = CANONICAL.filter((t) => !DERIVED.includes(t))
    expect(own.filter((t) => !(t in forest))).toEqual([])
    expect(Object.keys(forest).filter((t) => !CANONICAL.includes(t))).toEqual([])
  })

  const palettes = { 'Графіт': dark, 'Нічний ліс': { ...dark, ...forest } }
  const surfaces = ['page', 'chrome', 'surface', 'surface-sunken', 'surface-elevated']
  const minimum: Array<[string, number]> = [
    ['text', 7],
    ['text-secondary', 4.5],
    ['text-muted', 3],
    ['accent', 4.5],
    ['success', 4.5],
    ['warning', 4.5],
    ['danger', 4.5],
    ['info', 4.5],
  ]
  for (const [name, p] of Object.entries(palettes)) {
    it(`${name}: контраст тексту на всіх поверхнях не нижчий за контракт`, () => {
      const low: string[] = []
      for (const s of surfaces) {
        for (const [fg, min] of minimum) {
          const c = contrast(p[`--color-${fg}`], p[`--color-${s}`])
          if (c < min) low.push(`${fg} на ${s}: ${c.toFixed(2)} < ${min}`)
        }
      }
      expect(low).toEqual([])
    })

    it(`${name}: текст на акценті ≥ 4,5`, () => {
      expect(contrast(p['--color-on-accent'], p['--color-accent'])).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('Темна тема: світла й класична не змінюються', () => {
  // Канонічні імена, які компоненти вже вживають як фантоми (`var(--color-border, #e5e7eb)`).
  const usedAsPhantoms = ['surface', 'surface-elevated', 'text', 'text-muted', 'border', 'accent',
    'success', 'warning', 'danger', 'info', 'warning-soft'].map((n) => `--color-${n}`)

  it('світла й класична не оголошують канонічних імен-фантомів', () => {
    expect(usedAsPhantoms.filter((t) => t in light || t in classic)).toEqual([])
  })

  it('текст на акценті у світлій і класичній — білий, як і був', () => {
    expect(light['--color-on-accent']).toBe('#ffffff')
    expect(classic['--color-on-accent']).toBe('#ffffff')
  })

  it('кожне правило мосту діє лише в темній темі', () => {
    const css = bridgeCss.replace(/\/\*[\s\S]*?\*\//g, '')
    const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim())
    expect(selectors.length).toBeGreaterThan(0)
    const leaking = selectors.filter(
      (s) => !s.startsWith('html[data-theme="dark"]') && !s.startsWith(':where(html[data-theme="dark"])'),
    )
    expect(leaking).toEqual([])
  })

  it('міст не перевизначає канонічних токенів палітри', () => {
    // 2026-10-06: міст оголошував `--color-warning-soft: var(--color-warning-soft)` — самопосилання робило
    // токен недійсним, і бурштинові плашки в темній темі мали прозоре тло (на проді з фази 1).
    const declaredInBridge = [...bridgeCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
    expect(declaredInBridge.filter((n) => CANONICAL.includes(n))).toEqual([])
  })

  it('жодна змінна не посилається сама на себе', () => {
    const selfRefs = [...`${mainCss}\n${bridgeCss}`.matchAll(/(--[\w-]+)\s*:\s*var\(\s*(--[\w-]+)\s*[,)]/g)]
      .filter((m) => m[1] === m[2])
      .map((m) => m[1])
    expect(selfRefs).toEqual([])
  })

  it('немає глобального правила, що фарбує всі підписи темної теми', () => {
    expect(mainCss).not.toMatch(/\[data-theme="dark"\]\s+label\s*[,{]/)
  })
})

describe('Темна тема: фаза 2 (дошка, уроки, Розклад і спільне)', () => {
  // Розділи, які фаза 2 уже пройшла; наступні пакети додають сюди свої.
  const ROOTS = [
    'modules/winterboard', 'modules/knowledge', 'modules/lesson_constructor', 'modules/lessons',
    'modules/booking', 'components', 'modules/assignments', 'modules/auth', 'modules/intent', 'modules/billing',
    'modules/chat', 'modules/platform-feedback', 'modules/people', 'views', 'ui',
  ].map((r) => join(SRC, r))
  // «Папір»: аркуш і все, що на ньому малюється, від теми не залежить (контракт, розділ 2),
  // а пульт телефона має власну палітру. Ці файли тема не чіпає. Свідомо поза фазою 2:
  // налагоджувальні панелі Розкладу, сторінка Lighthouse, запити маркетплейсу (вимкнено).
  const PAPER = new RegExp(
    '/(booking/debug|__lighthouse__|components/inquiries)/|' +
      '/(vendor|components/board/objects|components/remote|components/test/elements)/|' +
      '/(WBRemoteView|WBRemoteEntry|WBStickyNote|WBGridOverlay|WBLaserDot|WBSpotlightOverlay|' +
      'DocumentViewerAsset|WBPreviewCanvas|AudioBadge|LinkBadge|SourceBadge|TextBadge|TextOverlay|' +
      'WBCanvas|WBOverlayLayer|WBTheoryOverlay|WBTestElement|WBTestOverlay)\\.vue$',
  )
  const vueFiles = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') vueFiles(p, out)
      } else if (name.endsWith('.vue')) out.push(p)
    }
    return out
  }
  const styles = (path: string) =>
    [...readFileSync(path, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
      .map((m) => m[1])
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')

  function isLight(value: string): boolean {
    let rgb: number[]
    let alpha = 1
    const v = value.toLowerCase()
    if (v === 'white') rgb = [1, 1, 1]
    else if (v.startsWith('#')) {
      let h = v.slice(1)
      if (h.length <= 4) h = [...h].map((c) => c + c).join('')
      rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      if (h.length === 8) alpha = parseInt(h.slice(6, 8), 16) / 255
    } else {
      const n = (v.match(/[\d.]+/g) ?? []).map(Number)
      rgb = n.slice(0, 3).map((x) => x / 255)
      if (n.length > 3) alpha = n[3]
    }
    if (alpha < 0.6) return false
    const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] > 0.75
  }

  it('правила фази 2 діють лише в темній темі', () => {
    const leaking: string[] = []
    for (const path of ROOTS.flatMap((r) => vueFiles(r))) {
      const text = readFileSync(path, 'utf8')
      for (const block of text.split('Б-156, фаза 2').slice(1)) {
        const css = block.slice(block.indexOf('*/') + 2, block.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '')
        for (const m of css.matchAll(/([^{};]+)\{/g)) {
          const head = m[1].trim()
          if (head.startsWith('@')) continue
          for (const sel of head.split(',')) {
            if (!sel.trim().startsWith('[data-theme="dark"]')) leaking.push(`${relative(SRC, path)} :: ${sel.trim()}`)
          }
        }
      }
    }
    expect(leaking).toEqual([])
  })

  it('компонент пройденого розділу з жорстко світлим тлом має темні правила', () => {
    const missing = ROOTS.flatMap((r) => vueFiles(r))
      .filter((p) => !PAPER.test(p.replace(/\\/g, '/')))
      .filter((p) => {
        const css = styles(p)
        const light = [...css.matchAll(/(?<![\w-])background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}\b|white\b|rgba?\([^)]*\))/g)]
          .some((m) => isLight(m[1]))
        return light && !css.includes('[data-theme="dark"]')
      })
      .map((p) => relative(SRC, p))
    expect(missing).toEqual([])
  })
})

describe('Темна тема: фаза 3 — одна система замість трьох', () => {
  // Tailwind `dark:` дублював тему третьою системою кольорів (контракт, правило 2). Темну тему
  // дають токени й міст; новий `dark:`-клас — червоний тест.
  const sources = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') sources(p, out)
      } else if (/\.(vue|ts|js)$/.test(name)) out.push(p)
    }
    return out
  }

  it('жодного Tailwind dark:-класу в коді', () => {
    const found = sources(SRC)
      .filter((p) => /\bdark:[a-zA-Z]/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(SRC, p))
    expect(found).toEqual([])
  })
})

describe('Темна тема: нових фантомних токенів немає', () => {
  // Фантом — var(--x), де --x ніде не оголошено: колір тоді береться із запасного значення й не
  // перемикається з темою (головна причина «невидимого тексту», контракт §1). База 2026-10-06 — назви,
  // що лишилися свідомо: папір віджетів аркуша, вимкнений маркетплейс, нетематичні розміри й відступи,
  // запасні кольори з суфіксом -dark. Нова назва поза базою — червоний тест; база лише зменшується.
  const BASELINE = new Set(
    ('--accent-muted --accent-rgb --bg-hover-dark --bg-secondary-dark --border-color-dark --calendar-first-lesson ' +
      '--calendar-no-show --calendar-regular-lesson --calendar-slot-label --color-error-bg-dark ' +
      '--color-error-border-dark --color-info-bg-dark --disabled --font-mono --font-size-2xl --font-size-base ' +
      '--font-size-lg --font-size-sm --font-size-xs --font-subtitle --formula-bg --gc-border --gc-pf-accent ' +
      '--gc-pf-tint --green --green-dark --green-light --green-mid --ink --ink-2 --ink-3 --line-2 --paper ' +
      '--radius-2xl --shadow-1 --shadow-2 --space-1 --space-10 --space-2 --space-3 --space-4 --space-6 ' +
      '--spacing-lg --spacing-md --spacing-sm --spacing-xl --spacing-xs --text-3xl --text-primary-dark ' +
      '--wb-card-text-scale --wb-z-page-nav --white').split(' '),
  )
  const sources = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') sources(p, out)
      } else if (/\.(vue|css|scss|ts|js)$/.test(name)) out.push(p)
    }
    return out
  }

  it('кожна var(--x) у коді має оголошення (або є в базі)', () => {
    const used = new Set<string>()
    const declared = new Set<string>()
    for (const path of sources(SRC)) {
      const text = readFileSync(path, 'utf8')
      for (const m of text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) used.add(m[1])
      for (const m of text.matchAll(/(?<![A-Za-z0-9_-])(--[A-Za-z0-9_-]+)\s*:/g)) declared.add(m[1])
      for (const m of text.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9_-]+)|['"](--[A-Za-z0-9_-]+)['"]\s*:/g)) {
        declared.add(m[1] ?? m[2])
      }
    }
    const fresh = [...used].filter((n) => !declared.has(n) && !BASELINE.has(n)).sort()
    expect(fresh).toEqual([])
  })
})

describe('Темна тема: текст на акцентній заливці', () => {
  const ACCENTISH = /var\(\s*--(accent|primary|color-primary|color-accent|wb-brand|wb-primary|success-bg|danger-bg|info-bg|color-success|color-danger|color-info|primary-color|brand-primary)(?:-hover|-dark)?\s*[,)]/
  const WHITE = /^\s*(white|#fff|#ffffff)\s*(!important)?\s*$/i

  function files(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__' && name !== 'vendor') files(p, out)
      } else if (/\.(vue|css)$/.test(name)) out.push(p)
    }
    return out
  }

  it('жодне правило не ставить жорстко білий текст на акцентне чи статусне тло', () => {
    const bad: string[] = []
    for (const path of files(SRC)) {
      const text = readFileSync(path, 'utf8')
      const css = path.endsWith('.vue')
        ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
        : text
      for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        let bg = ''
        let color = ''
        for (const d of m[2].matchAll(/(?:^|;)\s*(background(?:-color)?|color)\s*:\s*([^;]+)/g)) {
          if (d[1].startsWith('background')) bg = d[2]
          else color = d[2]
        }
        if (ACCENTISH.test(bg) && WHITE.test(color)) {
          bad.push(`${relative(SRC, path)} :: ${m[1].trim().split('\n').pop()}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
