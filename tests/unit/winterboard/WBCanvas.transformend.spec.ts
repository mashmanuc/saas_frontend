/**
 * Regression guard: commit 46ffb40 (P2 event delegation, 2026-04-23) переніс
 * `dragend` на layer-level delegation, але разом з цим вилучив `@transformend`
 * з `<v-image>` і `<v-group>`-обгортки (borderRadius > 0). Transformer
 * рендериться у uiLayer, тож події не bubble до assetsLayer — handler
 * `handleAssetTransformEnd` став dead-code, resize зображень переставав
 * зберігатися (state lost after page switch).
 *
 * Фікс: повернули per-node `@transformend="handleAssetTransformEnd(asset, $event)"`.
 * Цей тест — гарант, що майбутні refactor-и event-delegation не повторять
 * той самий промах.
 *
 * Тест читає вихідник шаблону і перевіряє наявність binding-у у двох
 * очікуваних місцях (v-group для borderRadius > 0, v-image для regular image).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const canvasPath = resolve(
  __dirname,
  '../../../src/modules/winterboard/components/canvas/WBCanvas.vue',
)

describe('WBCanvas — transformend regression guard (46ffb40)', () => {
  const source = readFileSync(canvasPath, 'utf8')

  it('has @transformend binding on <v-group> clip wrapper (borderRadius > 0 case)', () => {
    // Знаходимо весь блок <v-group v-else-if="...borderRadius..."> ... </v-group>.
    // Використовуємо [\s\S]*? бо [^>]* натикається на `>` усередині виразу `> 0`.
    const vGroupBlock = /<v-group\b[\s\S]*?v-else-if="\(asset\.borderRadius[\s\S]*?<\/v-group>/
    const match = source.match(vGroupBlock)
    expect(match, 'Expected v-group clip wrapper to exist in template').not.toBeNull()
    expect(
      match![0],
      'v-group (borderRadius > 0) must bind @transformend. ' +
        'Regression 46ffb40 removed it — image resize with borderRadius no longer saves.',
    ).toMatch(/@transformend="handleAssetTransformEnd\(asset, \$event\)"/)
  })

  it('has @transformend binding on regular <v-image> (no borderRadius case)', () => {
    // Шукаємо <v-image v-else ... /> — це регулярне зображення без clip.
    // [\s\S]*? щоб атрибути могли бути на кількох рядках.
    const vImageBlock = /<v-image\s+v-else\b[\s\S]*?\/>/
    const match = source.match(vImageBlock)
    expect(match, 'Expected regular <v-image v-else> to exist in template').not.toBeNull()
    expect(
      match![0],
      'Regular <v-image v-else> must bind @transformend. ' +
        'Regression 46ffb40 removed it — image resize no longer saves across page switch.',
    ).toMatch(/@transformend="handleAssetTransformEnd\(asset, \$event\)"/)
  })

  it('handleAssetTransformEnd handler still exists (not dead code)', () => {
    // Якщо хтось видалить сам handler — треба попередити явно.
    expect(
      source,
      'handleAssetTransformEnd function must be defined in WBCanvas.vue',
    ).toMatch(/function handleAssetTransformEnd\s*\(/)
  })

  it('handleAssetTransformEnd emits asset-update with width/height (no scale)', () => {
    // Інваріант: handler скидає scaleX/Y і переводить їх у width/height.
    // Якщо хтось випадково видалить цю логіку — resize знову зламається.
    const handlerRegex = /function handleAssetTransformEnd[\s\S]*?(?=\n\nfunction |\n\/\/ ─|\n\/\*\*)/
    const match = source.match(handlerRegex)
    expect(match, 'handleAssetTransformEnd body must be parseable').not.toBeNull()
    const body = match![0]

    expect(body).toMatch(/scaleX\(1\)/)
    expect(body).toMatch(/scaleY\(1\)/)
    expect(body).toMatch(/emit\(['"]asset-update['"]/)
    expect(body).toMatch(/w:\s*Math\.round\(node\.width\(\)\s*\*\s*scaleX\)/)
    expect(body).toMatch(/h:\s*Math\.round\(node\.height\(\)\s*\*\s*scaleY\)/)
  })
})
