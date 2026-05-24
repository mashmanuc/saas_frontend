/**
 * INV-EP-8 enforcement test — FE capture boundary.
 *
 * Ref: saas_docs/domains/winterboard/export/EXPORT_PREPARATION_SSOT.md INV-EP-8
 *
 * Кожен виклик useExportCapture у widget renderer має бути THIN ADAPTER.
 * Заборонені patterns ВНУТРІШНЬОГО CAPTURE FUNCTION:
 *   - store mutation (setX, commit, dispatch)
 *   - widget business logic (engine.solve, recompute, layout)
 *   - side effects (analytics, broadcast, ops)
 *
 * Ця перевірка static: ми не виконуємо capture у jsdom (canvas відсутній),
 * а пробігаємось по source файлах renderer-ів і assert-имо, що блок
 * useExportCapture(...) обмежений списком дозволених patterns.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

const RENDERERS = [
  'components/board/objects/TrigCircleRenderer.vue',
  'components/board/objects/TrigSolverRenderer.vue',
  'components/board/objects/GraphCalculatorRenderer.vue',
  'components/board/objects/CalculusRenderer.vue',
  'components/board/objects/HelixRenderer.vue',
  'components/board/objects/Geometry2DRenderer.vue',
  'components/board/objects/Nmt3dRenderer.vue',
  'components/board/SolidCardRenderer.vue',
]

/**
 * Витягує внутрішнє тіло useExportCapture(..., (signal) => { ... }).
 * Спрощений regex — захоплює до `)` після arrow body.
 */
function extractCaptureBody(source: string): string | null {
  // Patterns we accept:
  //   useExportCapture(\n  () => ...,\n  (signal) => snapshotElement(... , signal),\n)
  const m = source.match(
    /useExportCapture\(\s*[^,]+,\s*\(signal\)\s*=>\s*([^,)]+(?:\([^)]*\))?)/m,
  )
  return m ? m[1].trim() : null
}

describe('INV-EP-8 — FE capture boundary (static guard)', () => {
  for (const rel of RENDERERS) {
    const abs = resolve(ROOT, rel)

    it(`${rel} — useExportCapture body is a thin adapter`, () => {
      if (!existsSync(abs)) {
        // We added wiring to this file in PR-2; if file missing, test should fail.
        throw new Error(`Renderer file not found: ${rel}`)
      }
      const src = readFileSync(abs, 'utf-8')

      // 1. useExportCapture MUST be present (wiring not removed).
      expect(
        src.includes('useExportCapture('),
        `${rel}: useExportCapture call missing`,
      ).toBe(true)

      // 2. Capture body MUST call snapshotElement (the only allowed adapter).
      const body = extractCaptureBody(src)
      expect(body, `${rel}: could not parse useExportCapture body`).toBeTruthy()
      expect(
        body!.startsWith('snapshotElement('),
        `${rel}: capture body must be snapshotElement(...), got: ${body}`,
      ).toBe(true)

      // 3. Capture body MUST NOT mention forbidden patterns.
      const FORBIDDEN_PATTERNS = [
        // Store mutations
        /\.commit\s*\(/,
        /\.dispatch\s*\(/,
        /useBoardStore\s*\(/,
        // Widget business calls inside capture
        /\.solve\s*\(/,
        /\.recompute\s*\(/,
        /\.layout\s*\(/,
        // DOM screenshot libs explicitly banned for math widgets
        /html2canvas/,
        // emit() inside capture would mean side effect
        /emit\s*\(/,
      ]
      for (const pat of FORBIDDEN_PATTERNS) {
        expect(
          pat.test(body!),
          `${rel}: capture body contains forbidden pattern ${pat}: ${body}`,
        ).toBe(false)
      }
    })
  }

  it('snapshotElement module imports no widget-specific code (compositor isolation)', () => {
    const src = readFileSync(resolve(ROOT, 'utils/snapshotElement.ts'), 'utf-8')
    // Must not import any widget engine, store, or state module.
    const FORBIDDEN_IMPORTS = [
      /from\s+['"][^'"]*\/board\/state\//,  // widget UI state
      /from\s+['"][^'"]*\/stores\//,         // global pinia
      /from\s+['"][^'"]*\/vendor\//,         // widget engines
      /from\s+['"][^'"]*html2canvas/,        // banned screenshot lib
    ]
    for (const pat of FORBIDDEN_IMPORTS) {
      expect(pat.test(src), `snapshotElement imports forbidden module ${pat}`).toBe(false)
    }
  })

  it('exportPreviewService imports no widget runtime modules', () => {
    const src = readFileSync(resolve(ROOT, 'services/exportPreviewService.ts'), 'utf-8')
    const FORBIDDEN = [
      /from\s+['"][^'"]*\/vendor\//,
      /from\s+['"][^'"]*\/board\/state\//,
      // Service should only depend on the api client wrapper — not widget code.
    ]
    for (const pat of FORBIDDEN) {
      expect(pat.test(src), `exportPreviewService imports forbidden ${pat}`).toBe(false)
    }
  })
})
