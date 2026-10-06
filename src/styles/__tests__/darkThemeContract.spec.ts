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

  it('немає глобального правила, що фарбує всі підписи темної теми', () => {
    expect(mainCss).not.toMatch(/\[data-theme="dark"\]\s+label\s*[,{]/)
  })
})

describe('Темна тема: дошка (фаза 2)', () => {
  const BOARD = join(SRC, 'modules/winterboard')
  // «Папір»: аркуш і все, що на ньому малюється, від теми не залежить (контракт, розділ 2),
  // а пульт телефона має власну палітру. Ці файли тема не чіпає.
  const PAPER = new RegExp(
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
    for (const path of vueFiles(BOARD)) {
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

  it('компонент дошки з жорстко світлим тлом має темні правила', () => {
    const missing = vueFiles(BOARD)
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
