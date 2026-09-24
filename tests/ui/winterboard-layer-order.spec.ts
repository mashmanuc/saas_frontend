import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

async function pixelAt(page: import('@playwright/test').Page, x: number, y: number): Promise<[number, number, number]> {
  const png = PNG.sync.read(await page.screenshot({ clip: { x, y, width: 1, height: 1 } }))
  return [png.data[0], png.data[1], png.data[2]]
}

test('PDF і HTML-картка: стрілки міняють видимий шар і шар кнопок', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('local_ws_enabled', 'true'))
  await page.goto('/workspace')
  await expect(page.locator('.wb-canvas')).toBeVisible()

  await page.evaluate(async () => {
    const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
    const store = useWBStore()
    const current = store.currentPage
    if (!current) throw new Error('Немає сторінки тестової дошки')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#ff0000"/></svg>`
    store.pages[store.currentPageIndex] = {
      ...current,
      assets: [
        { id: 'layer-pdf', type: 'document_viewer', src: '', x: 100, y: 100, w: 400, h: 300,
          rotation: 0, locked: false, currentPage: 0, totalPages: 1,
          pages: [{ index: 0, url: `data:image/svg+xml,${encodeURIComponent(svg)}` }] },
        { id: 'layer-theory', type: 'theory_card', src: '', x: 280, y: 120, w: 400, h: 300,
          rotation: 0, locked: false, data: { version: 1, title: 'ВЕРХНЯ КАРТКА', body: 'Тест порядку', formulas: [] } },
      ],
    }
    store.selectItems(['layer-pdf'])
  })

  const nativeCanvas = page.locator('.wb-canvas .konvajs-content > canvas').nth(1)
  const strokesCanvas = page.locator('.wb-canvas .konvajs-content > canvas').nth(2)
  const strokesMirror = page.locator('.wb-strokes-overlay')
  const controls = page.locator('[data-testid="wb-card-window-controls"]')
  const toolbar = page.locator('.wb-selection-toolbar')
  await expect(controls).toHaveAttribute('data-asset-id', 'layer-pdf')
  await expect(controls).toHaveCSS('z-index', '3')
  await expect(controls).toHaveCSS('visibility', 'hidden')
  await expect(nativeCanvas).toHaveCSS('z-index', 'auto')
  const overlap = await page.locator('[data-theory-card-id="layer-theory"]').boundingBox()
  if (!overlap) throw new Error('HTML-картку не намальовано')
  const point = { x: Math.round(overlap.x + overlap.width * 0.3), y: Math.round(overlap.y + overlap.height * 0.3) }
  const before = await pixelAt(page, point.x, point.y)

  await toolbar.locator('button').first().click() // ↑: PDF перед HTML-карткою
  await expect(nativeCanvas).toHaveCSS('z-index', '6')
  await expect(strokesCanvas).toHaveCSS('z-index', '7')
  await expect(strokesMirror).toHaveCSS('visibility', 'hidden')
  await expect(controls).toHaveCSS('z-index', '10')
  await expect(controls).toHaveCSS('visibility', 'visible')
  const after = await pixelAt(page, point.x, point.y)
  expect(after[0] - after[1], `Колір до: ${before}; після ↑: ${after}`).toBeGreaterThan(100)
  expect(before[0] - before[1], `Колір до ↑: ${before}`).toBeLessThan(100)

  await toolbar.locator('button').nth(1).click() // ↓: PDF за HTML-карткою
  await expect(nativeCanvas).toHaveCSS('z-index', 'auto')
  await expect(strokesCanvas).toHaveCSS('z-index', 'auto')
  await expect(strokesMirror).toHaveCSS('visibility', 'visible')
  await expect(controls).toHaveCSS('z-index', '3')
  await expect(controls).toHaveCSS('visibility', 'hidden')
  const restored = await pixelAt(page, point.x, point.y)
  expect(Math.max(...restored.map((value, i) => Math.abs(value - before[i]))),
    `Колір до ↑: ${before}; після ↓: ${restored}`).toBeLessThanOrEqual(5)
})

test('кнопки HTML-картки живуть усередині її власного шару', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('local_ws_enabled', 'true'))
  await page.goto('/workspace')
  await expect(page.locator('.wb-canvas')).toBeVisible()
  await page.evaluate(async () => {
    const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
    const store = useWBStore()
    const current = store.currentPage
    if (!current) throw new Error('Немає сторінки тестової дошки')
    const card = (id: string, x: number) => ({
      id, type: 'theory_card', src: '', x, y: 100, w: 400, h: 300,
      rotation: 0, locked: false,
      data: { version: 1, title: id, body: 'Тест накладання', formulas: [] },
    })
    store.pages[store.currentPageIndex] = {
      ...current,
      assets: [card('lower', 100), card('upper', 280)],
    }
    store.selectItems(['lower'])
  })

  const controls = page.locator('[data-testid="wb-card-window-controls"]')
  await expect(controls.locator('xpath=..')).toHaveAttribute('data-theory-card-id', 'lower')
  await expect(controls).toHaveCSS('z-index', 'auto')
  await expect(controls).toHaveCSS('visibility', 'hidden')
  const closeBox = await controls.locator('[data-testid="wb-card-window-delete"]').evaluate((el) => {
    const box = el.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  })
  const x = Math.round(closeBox.x + closeBox.width / 2)
  const y = Math.round(closeBox.y + closeBox.height / 2)
  const covered = await pixelAt(page, x, y)

  await page.evaluate(async () => {
    const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
    useWBStore().clearSelection()
  })
  await expect(controls).toHaveCount(0)
  const noControls = await pixelAt(page, x, y)
  expect(Math.max(...covered.map((value, i) => Math.abs(value - noControls[i]))),
    `Кнопки нижньої картки просвічують крізь верхню: ${covered} / ${noControls}`).toBeLessThanOrEqual(5)

  await page.evaluate(async () => {
    const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
    useWBStore().selectItems(['upper'])
  })
  await expect(controls.locator('xpath=..')).toHaveAttribute('data-theory-card-id', 'upper')
  await expect(controls).toHaveCSS('visibility', 'visible')
  await controls.locator('[data-testid="wb-card-window-minimize"]').click()
  await expect(page.locator('[data-theory-card-id="upper"]')).toHaveCSS('display', 'none')
})

test('кнопки PDF не проступають крізь HTML-картку, навіть коли PDF пізніше у списку', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('local_ws_enabled', 'true'))
  await page.goto('/workspace')
  await expect(page.locator('.wb-canvas')).toBeVisible()
  await page.evaluate(async () => {
    const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
    const store = useWBStore()
    const current = store.currentPage
    if (!current) throw new Error('Немає сторінки')
    store.pages[store.currentPageIndex] = {
      ...current,
      assets: [
        { id: 'earlier-native', type: 'image', src: '', x: 20, y: 20, w: 50, h: 50, rotation: 0, locked: false },
        { id: 'upper-card', type: 'theory_card', src: '', x: 280, y: 120, w: 400, h: 300,
          rotation: 0, locked: false, data: { version: 1, title: 'КАРТКА', body: 'Тест', formulas: [] } },
        { id: 'late-pdf', type: 'document_viewer', src: '', x: 100, y: 100, w: 400, h: 300,
          rotation: 0, locked: false, currentPage: 0, totalPages: 1, pages: [] },
      ],
    }
    store.selectItems(['late-pdf'])
  })
  const controls = page.locator('[data-testid="wb-card-window-controls"]')
  await expect(controls).toHaveAttribute('data-asset-id', 'late-pdf')
  await expect(controls).toHaveCSS('visibility', 'hidden')
})

test('під час перетягування PDF рамка виділення не лишається на старому місці', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('local_ws_enabled', 'true'))
  await page.goto('/workspace')
  await page.waitForFunction(() => !!localStorage.getItem('m4sh:local-ws:v1'))
  const snapshotJson = await page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem('m4sh:local-ws:v1') || 'null')
    if (!snapshot?.state?.pages?.length) throw new Error('Немає локального стану')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#ff0000"/></svg>`
    snapshot.state.pages = [{
      ...snapshot.state.pages[0],
      strokes: [],
      assets: [
        { id: 'drag-pdf', type: 'document_viewer', src: '', x: 100, y: 100, w: 400, h: 300,
          rotation: 0, locked: false, currentPage: 0, totalPages: 1,
          pages: [{ index: 0, url: `data:image/svg+xml,${encodeURIComponent(svg)}` }] },
        { id: 'drag-card', type: 'theory_card', src: '', x: 280, y: 120, w: 400, h: 300,
          rotation: 0, locked: false, data: { version: 1, title: 'КАРТКА', body: 'Тест', formulas: [] } },
      ],
    }]
    snapshot.state.currentPageIndex = 0
    return JSON.stringify(snapshot)
  })
  await page.addInitScript((value) => localStorage.setItem('m4sh:local-ws:v1', value), snapshotJson)
  await page.reload()
  const card = page.locator('[data-theory-card-id="drag-card"]')
  await expect(card).toBeVisible()
  await expect(page.locator('.wb-canvas-loader')).toHaveCount(0)
  const box = await card.boundingBox()
  if (!box) throw new Error('Немає картки')
  const zoom = box.width / 400
  const x = box.x - 120 * zoom
  const y = box.y + 100 * zoom
  await page.mouse.click(x, y)
  await expect(page.locator('[data-testid="wb-card-window-controls"]')).toHaveAttribute('data-asset-id', 'drag-pdf')
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 220, y + 35, { steps: 12 })
  const staleAlpha = await page.evaluate(({ x, y }) => {
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>('.wb-canvas .konvajs-content > canvas')]
    const ui = canvases.at(-1)
    if (!ui) throw new Error('Немає UI шару')
    const rect = ui.getBoundingClientRect()
    const px = Math.round((x - rect.x) * ui.width / rect.width)
    const py = Math.round((y - rect.y) * ui.height / rect.height)
    return ui.getContext('2d')?.getImageData(px, py, 1, 1).data[3] ?? -1
  }, { x, y })
  await page.mouse.up()
  expect(staleAlpha, `На старому місці лишилась напівпрозора рамка (alpha ${staleAlpha})`).toBe(0)
})
