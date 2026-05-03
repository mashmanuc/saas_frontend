#!/usr/bin/env node
/**
 * Layout SSoT — automated guard checks (cross-platform Node version of layout-guards.sh).
 *
 * Refs:
 *   - saas_docs/plans/LAYOUT_SSOT_2026-05-02.md (INV-LAYOUT-1..9, DoD §9.2)
 *   - saas_docs/plans/LAYOUT_SSOT_2026-05-02_KILL_TESTS.md (per-stage kill-tests)
 *
 * Stage-aware:
 *   - Now (Stage 1+2): lenient mode — legacy useResponsiveLayout/useSidebar still live in PageShell.
 *   - Stage 5 (post-sweep): strict mode — fail on ANY legacy reference.
 *
 * Run: `npm run check:layout`
 * Or:  `STRICT=1 npm run check:layout` (Stage 5 mode)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

const STRICT = process.env.STRICT === '1' || process.argv.includes('--strict')

let errors = 0
let warnings = 0

function fail(msg) {
  console.error(`❌ ${msg}`)
  errors++
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`)
  warnings++
}

function pass(msg) {
  console.log(`✅ ${msg}`)
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) yield* walk(full)
    else yield full
  }
}

function findInFiles(pattern, { include = [], exclude = [], stopAfter = 0 } = {}) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern)
  const results = []
  for (const path of walk(SRC)) {
    const rel = relative(ROOT, path).replace(/\\/g, '/')
    if (include.length && !include.some((ext) => path.endsWith(ext))) continue
    if (exclude.some((p) => rel.includes(p))) continue
    let content
    try {
      content = readFileSync(path, 'utf8')
    } catch {
      continue
    }
    const lines = content.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        results.push({ path: rel, line: i + 1, text: lines[i].trim() })
        if (stopAfter && results.length >= stopAfter) return results
      }
    }
  }
  return results
}

const TS_VUE = ['.ts', '.tsx', '.vue', '.js', '.mjs', '.cjs']

const WB_INNER_WHITELIST = [
  // Layout SSoT itself — store reads window.innerWidth synchronously у init().
  'stores/layoutStore.ts',
  'config/breakpoints.ts',
  // Winterboard domain — INV-RESP-3 trust zone. WB has its own viewport
  // resolution via useDeviceMode + WB_BREAKPOINTS. Popovers/positioning у WB
  // read window.innerWidth directly (read-time, not reactive subscribe) per
  // WB-domain decision. Layout SSoT does NOT cross this boundary.
  // Refs: saas_docs/plans/LAYOUT_SSOT_2026-05-02.md §0.4 INV-RESP-3.
  'modules/winterboard/',
  // Tests — never count.
  '__tests__',
  '/tests/',
]

console.log(`\n🔍 Layout SSoT guards (mode: ${STRICT ? 'STRICT (Stage 5+)' : 'LENIENT (Stage 1-4)'})`)
console.log('─'.repeat(70))

// ─────────────────────────────────────────────
// Check 1: window.innerWidth / innerHeight outside whitelist
// ─────────────────────────────────────────────

console.log('\nCheck 1: window.innerWidth / window.innerHeight usage')

const innerHits = findInFiles(/window\.(innerWidth|innerHeight)/, {
  include: TS_VUE,
  exclude: WB_INNER_WHITELIST,
})

if (innerHits.length === 0) {
  pass('No forbidden window.innerWidth/Height references outside whitelist')
} else if (STRICT) {
  fail(`Found ${innerHits.length} forbidden window.innerWidth/Height references:`)
  innerHits.slice(0, 20).forEach((h) => console.error(`     ${h.path}:${h.line}  ${h.text}`))
  if (innerHits.length > 20) console.error(`     ... and ${innerHits.length - 20} more`)
} else {
  warn(`Found ${innerHits.length} window.innerWidth/Height (legacy — will be cleaned in Stage 5)`)
  innerHits.slice(0, 5).forEach((h) => console.warn(`     ${h.path}:${h.line}`))
  if (innerHits.length > 5) console.warn(`     ... and ${innerHits.length - 5} more (run with --strict to see all)`)
}

// ─────────────────────────────────────────────
// Check 2: useResponsiveLayout — must be 0 after Stage 5
// ─────────────────────────────────────────────

console.log('\nCheck 2: useResponsiveLayout references')

const respHits = findInFiles(/useResponsiveLayout/, {
  include: TS_VUE,
  exclude: ['__tests__', '/tests/'],
})

if (respHits.length === 0) {
  pass('useResponsiveLayout has been fully removed')
} else if (STRICT) {
  fail(`useResponsiveLayout still referenced in ${respHits.length} place(s):`)
  respHits.forEach((h) => console.error(`     ${h.path}:${h.line}  ${h.text}`))
} else {
  warn(`useResponsiveLayout still in ${respHits.length} file(s) (legacy — will be removed in Stage 5)`)
  respHits.slice(0, 5).forEach((h) => console.warn(`     ${h.path}:${h.line}`))
}

// ─────────────────────────────────────────────
// Check 3: useSidebar — must be 0 after Stage 4 (excluding useSidebarBadges)
// ─────────────────────────────────────────────

console.log('\nCheck 3: useSidebar references (excluding useSidebarBadges)')

const sidebarHits = findInFiles(/useSidebar\b(?!Badges)/, {
  include: TS_VUE,
  exclude: ['__tests__', '/tests/'],
})

if (sidebarHits.length === 0) {
  pass('useSidebar has been fully removed')
} else if (STRICT) {
  fail(`useSidebar still referenced in ${sidebarHits.length} place(s):`)
  sidebarHits.forEach((h) => console.error(`     ${h.path}:${h.line}  ${h.text}`))
} else {
  warn(`useSidebar still in ${sidebarHits.length} file(s) (legacy — will be removed in Stage 4)`)
  sidebarHits.slice(0, 5).forEach((h) => console.warn(`     ${h.path}:${h.line}`))
}

// ─────────────────────────────────────────────
// Check 4: layout.viewport.* direct reactive access (INV-LAYOUT-9)
// Always strict — popovers MUST use getViewportSnapshot().
// ─────────────────────────────────────────────

console.log('\nCheck 4: Reactive viewport misuse (INV-LAYOUT-9 — always strict)')

const viewportHits = findInFiles(/layout\.viewport\.(width|height)/, {
  include: TS_VUE,
  exclude: [
    'stores/layoutStore.ts',
    // Legitimate reactive consumers — NOT popover positioning.
    // INV-LAYOUT-9 forbids reactive viewport ONLY for popover/dropdown/menu
    // positioning (jitter risk). Composables that intentionally react to
    // resize (e.g. orientation detection) — allowed with this comment.
    'composables/useDeviceCapabilities.ts',
    '__tests__',
    '/tests/',
  ],
})

if (viewportHits.length === 0) {
  pass('No direct reactive layout.viewport.* reads (popovers using getViewportSnapshot)')
} else {
  fail(`Direct reactive layout.viewport.* reads found (use getViewportSnapshot()):`)
  viewportHits.forEach((h) => console.error(`     ${h.path}:${h.line}  ${h.text}`))
}

// ─────────────────────────────────────────────
// Check 5: WB cross-domain import boundary (INV-RESP-3)
// ─────────────────────────────────────────────

console.log('\nCheck 5: WB ↔ Dashboard composable boundary (INV-RESP-3)')

const wbViolations = []
for (const path of walk(join(SRC, 'modules', 'winterboard'))) {
  if (!TS_VUE.some((ext) => path.endsWith(ext))) continue
  const rel = relative(ROOT, path).replace(/\\/g, '/')
  if (rel.includes('__tests__') || rel.includes('/tests/')) continue
  const content = readFileSync(path, 'utf8')
  if (/from\s+['"]@\/stores\/layoutStore['"]/.test(content) || /useLayoutStore/.test(content)) {
    wbViolations.push(rel)
  }
}

if (wbViolations.length === 0) {
  pass('Winterboard does not import useLayoutStore (boundary respected)')
} else {
  fail(`Winterboard imports layoutStore (violation of INV-RESP-3):`)
  wbViolations.forEach((p) => console.error(`     ${p}`))
}

// ─────────────────────────────────────────────
// Check 6: runtime CSS var mutation (INV-LAYOUT-8)
// Whitelist: useDeviceMode + useKeyboardAvoidance + WBResponsiveShell (all WB --wb-vh writers).
// ─────────────────────────────────────────────

console.log('\nCheck 6: Runtime CSS var mutation outside WB whitelist (INV-LAYOUT-8)')

const cssMutationWhitelist = [
  'modules/winterboard/composables/useDeviceMode.ts',
  'modules/winterboard/composables/useKeyboardAvoidance.ts',
  'modules/winterboard/composables/useCanvasResize.ts',     // INV-5: writes --wb-vh / --wb-canvas-* (visualViewport sync)
  'modules/winterboard/components/layout/WBResponsiveShell.vue',
  '__tests__',
  '/tests/',
]

const cssMutationHits = findInFiles(/documentElement\.style\.(setProperty|cssText)/, {
  include: TS_VUE,
  exclude: cssMutationWhitelist,
})

if (cssMutationHits.length === 0) {
  pass('No documentElement.style mutation outside WB whitelist')
} else {
  fail(`documentElement.style mutation found outside whitelist (INV-LAYOUT-8):`)
  cssMutationHits.forEach((h) => console.error(`     ${h.path}:${h.line}  ${h.text}`))
}

// ─────────────────────────────────────────────
// Check 7: hardcoded layout pixel values у layout-critical files (G-2 PR-5)
// Sidebar widths (260/64/280) and container max (1152/1400) must come from
// tokens.css. Layout-critical files: PageShell, AppSidebar, StaffSidebar,
// StaffLayout, calendar-responsive.css.
// Refs: saas_docs/plans/G2_CSS_TOKENS_RESEARCH_2026-05-02.md §7 INV-G2-1/-5/-6.
// ─────────────────────────────────────────────

console.log('\nCheck 7: Hardcoded layout pixel values у layout-critical files (INV-G2-1)')

const LAYOUT_CRITICAL_FILES = [
  'src/ui/PageShell.vue',
  'src/ui/AppSidebar.vue',
  'src/modules/staff/components/StaffSidebar.vue',
  'src/modules/staff/layouts/StaffLayout.vue',
  'src/modules/booking/styles/calendar-responsive.css',
]

const LAYOUT_PIXEL_PATTERN = /(?:width|max-width|margin-left|margin-right):\s*(?:260|64|280|1152|1400)px/

const layoutPixelHits = []
for (const relPath of LAYOUT_CRITICAL_FILES) {
  const fullPath = join(ROOT, relPath)
  let content
  try {
    content = readFileSync(fullPath, 'utf8')
  } catch {
    continue // file may not exist
  }
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    if (LAYOUT_PIXEL_PATTERN.test(lines[i])) {
      layoutPixelHits.push({ path: relPath, line: i + 1, text: lines[i].trim() })
    }
  }
}

if (layoutPixelHits.length === 0) {
  pass('Layout-critical files use tokens.css vars (no hardcoded layout px)')
} else {
  fail(`Hardcoded layout px у layout-critical files (INV-G2-1):`)
  layoutPixelHits.forEach((h) => console.error(`     ${h.path}:${h.line}  ${h.text}`))
}

// ─────────────────────────────────────────────
// Check 8: tokens.css must define all required --app-* layout vars (G-2 PR-5)
// Verify foundation is intact — if anyone removes a var у tokens.css, fail.
// Refs: saas_docs/plans/G2_CSS_TOKENS_RESEARCH_2026-05-02.md §4.1 token candidates.
// ─────────────────────────────────────────────

console.log('\nCheck 8: tokens.css defines all required layout vars (INV-G2-1 foundation)')

const REQUIRED_TOKEN_VARS = [
  '--app-sidebar-width',
  '--app-sidebar-width-collapsed',
  '--app-sidebar-width-mobile',
  '--app-max-width',
  '--app-header-height',
  '--app-topnav-height',
  '--app-mobile-header-height',
  '--app-content-padding-mobile',
  '--app-content-padding-desktop',
  '--bp-xs',
  '--bp-sm',
  '--bp-md',
  '--bp-lg',
  '--bp-xl',
  '--bp-2xl',
  '--bp-display',
]

let tokensCss = ''
try {
  tokensCss = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8')
} catch {
  fail('Cannot read frontend/src/styles/tokens.css — foundation missing!')
}

const missingTokens = REQUIRED_TOKEN_VARS.filter((v) => !tokensCss.includes(v + ':'))

if (missingTokens.length === 0) {
  pass(`All ${REQUIRED_TOKEN_VARS.length} required layout vars defined у tokens.css`)
} else {
  fail(`Missing required layout vars у tokens.css (G-2 INV-G2-1 foundation):`)
  missingTokens.forEach((v) => console.error(`     ${v}`))
}

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log(`Errors:   ${errors}`)
console.log(`Warnings: ${warnings}`)

if (errors > 0) {
  console.error('\n❌ Layout guards FAILED — fix errors before proceeding\n')
  process.exit(1)
}

if (warnings > 0) {
  console.log(`\n🟡 Layout guards passed with ${warnings} warning(s) (lenient mode)`)
  console.log('   Run with --strict to see Stage 5 readiness\n')
} else {
  console.log('\n✅ Layout guards PASSED — clean state\n')
}

process.exit(0)
