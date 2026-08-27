/**
 * Масштаб розбору — межі, а не приклади.
 *
 * ⚠️ Запит власника 2026-08-27: показати класу хід розв'язання крупно, не
 * збільшуючи решту дошки. Рішення про обсяг — його: «тільки розбір».
 *
 * Головне, що стережуть тести, — те, чого НЕ видно на екрані: розмір є
 * особистим налаштуванням і НЕ потрапляє в дошку. Якби потрапив, він
 * поїхав би учневі через ops, а це вже SYSTEM_LAW.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const LS_KEY = 'wb_solution_font_px'

async function fresh() {
  vi.resetModules()
  return import('../composables/useSolutionZoom')
}

describe('сходинки й межі', () => {
  beforeEach(() => { localStorage.removeItem(LS_KEY) })

  it('типовий розмір — рівно той, що стояв у CSS до зміни', async () => {
    // 13px. Без дотику до кнопок вигляд не змінюється ні на піксель — це
    // умова того, що зміна нікого не здивує.
    const { useSolutionZoom } = await fresh()
    expect(useSolutionZoom().fontPx.value).toBe(13)
  })

  it('🔴 більшає і меншає по сходинках', async () => {
    const { useSolutionZoom, SOLUTION_FONT_STEPS } = await fresh()
    const z = useSolutionZoom()
    z.zoomIn()
    expect(z.fontPx.value).toBe(SOLUTION_FONT_STEPS[2])
    z.zoomOut()
    expect(z.fontPx.value).toBe(SOLUTION_FONT_STEPS[1])
  })

  it('упирається в стелю і в підлогу, не вилітає за масив', async () => {
    const { useSolutionZoom, SOLUTION_FONT_STEPS } = await fresh()
    const z = useSolutionZoom()
    for (let i = 0; i < 20; i++) z.zoomIn()
    expect(z.fontPx.value).toBe(SOLUTION_FONT_STEPS[SOLUTION_FONT_STEPS.length - 1])
    expect(z.canZoomIn.value).toBe(false)
    for (let i = 0; i < 20; i++) z.zoomOut()
    expect(z.fontPx.value).toBe(SOLUTION_FONT_STEPS[0])
    expect(z.canZoomOut.value).toBe(false)
  })

  it('скидання повертає типовий розмір одним рухом', async () => {
    const { useSolutionZoom } = await fresh()
    const z = useSolutionZoom()
    z.zoomIn(); z.zoomIn(); z.zoomIn()
    expect(z.isDefault.value).toBe(false)
    z.reset()
    expect(z.fontPx.value).toBe(13)
    expect(z.isDefault.value).toBe(true)
  })
})

describe('🔴 один розмір на всі картки', () => {
  beforeEach(() => { localStorage.removeItem(LS_KEY) })

  it('збільшив на одній — більший на всіх', async () => {
    // Стан навмисно на рівні модуля: інакше вчитель клацав би на кожній
    // картці окремо. Якщо цей тест впаде — хтось переніс ref усередину
    // функції, і поведінка змінилась непомітно.
    const { useSolutionZoom } = await fresh()
    const cardA = useSolutionZoom()
    const cardB = useSolutionZoom()
    cardA.zoomIn()
    expect(cardB.fontPx.value).toBe(cardA.fontPx.value)
  })
})

describe('🔴 розмір НЕ їде в дошку', () => {
  it('composable не має доступу до стану дошки', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(path.resolve(process.cwd(),
      'src/modules/winterboard/composables/useSolutionZoom.ts'), 'utf-8')

    // ⚠️ Перевіряємо КОД, не коментарі. Перша редакція шукала по всьому
    // файлу — і впала на моєму ж поясненні, чому `update:asset` тут не
    // використано. Тест мусив би тоді або збрехати, або заборонити
    // документувати рішення; обидва варіанти гірші за зняття коментарів.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')   // блокові
      .replace(/(^|\s)\/\/.*$/gm, '')     // рядкові

    // Жодного зі шляхів запису: ні стору, ні емітів, ні ops, ні мережі.
    for (const forbidden of ['update:asset', 'useBoardStore', 'emit(', 'OpsApply', 'axios', 'apiClient']) {
      expect(code).not.toContain(forbidden)
    }
    expect(code).toContain('localStorage')
  })

  it('картка малює розмір інлайном, а не через update:asset', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(path.resolve(process.cwd(),
      'src/modules/winterboard/components/board/objects/NmtTaskRenderer.vue'), 'utf-8')
    expect(src).toContain("fontSize: solutionZoom.fontPx.value + 'px'")
    // Кнопки не повинні тягнути за собою емітів у стан.
    const block = src.slice(src.indexOf('nmt-task__solution-zoom'),
      src.indexOf('nmt-task__solution-zoom') + 1400)
    expect(block).not.toContain('emitDataUpdate')
    expect(block).not.toContain('update:asset')
  })
})

describe('сховище', () => {
  beforeEach(() => { localStorage.removeItem(LS_KEY) })

  it('розмір переживає перезавантаження', async () => {
    const first = await fresh()
    first.useSolutionZoom().zoomIn()
    const saved = localStorage.getItem(LS_KEY)

    const second = await fresh()          // імітація нового завантаження
    expect(second.useSolutionZoom().fontPx.value).toBe(Number(saved))
  })

  it('🔴 сміття в localStorage не стає розміром шрифту', async () => {
    for (const junk of ['999', 'абв', '', '14.5', '-3']) {
      localStorage.setItem(LS_KEY, junk)
      const { useSolutionZoom } = await fresh()
      expect(useSolutionZoom().fontPx.value).toBe(13)
    }
  })
})
