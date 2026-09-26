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

test('перетягування документа: кнопки йдуть за ним, і він не заїжджає за лівий край', async ({ page }) => {
  // Скрін власника 2026-09-24: DOCX потягли ліворуч — «— ×» лишились на старому
  // місці, а документ заїхав за лівий край аркуша.
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
        { id: 'move-doc', type: 'document_viewer', src: '', x: 300, y: 200, w: 400, h: 300,
          rotation: 0, locked: false, currentPage: 0, totalPages: 1,
          pages: [{ index: 0, url: `data:image/svg+xml,${encodeURIComponent(svg)}` }] },
      ],
    }]
    snapshot.state.currentPageIndex = 0
    return JSON.stringify(snapshot)
  })
  await page.addInitScript((value) => localStorage.setItem('m4sh:local-ws:v1', value), snapshotJson)
  await page.reload()
  await expect(page.locator('.wb-canvas-loader')).toHaveCount(0)
  await page.waitForFunction(() => {
    const K = (window as any).Konva
    return !!K?.stages?.some((s: any) => s.findOne('#move-doc'))
  })

  const docRect = () => page.evaluate(() => {
    const K = (window as any).Konva
    const stage = K?.stages?.find((s: any) => s.findOne('#move-doc'))
    const node = stage?.findOne('#move-doc')
    if (!node) throw new Error('Немає вузла документа')
    const abs = node.getClientRect({ skipShadow: true, skipStroke: true })
    const onPage = node.getClientRect({ relativeTo: node.getLayer(), skipShadow: true, skipStroke: true })
    const box = stage.container().getBoundingClientRect()
    return { left: box.x + abs.x, right: box.x + abs.x + abs.width, top: box.y + abs.y, bottom: box.y + abs.y + abs.height, pageX: onPage.x }
  })

  const start = await docRect()
  const x = (start.left + start.right) / 2
  const y = (start.top + start.bottom) / 2
  const controls = page.locator('[data-testid="wb-card-window-controls"]')
  // Перший клік одразу після завантаження полотно може ще не прийняти — повторюємо до виділення.
  await expect(async () => {
    await page.mouse.click(x, y)
    await expect(controls).toHaveAttribute('data-asset-id', 'move-doc', { timeout: 500 })
  }).toPass()

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 900, y + 20, { steps: 15 })
  // Ще тримаємо мишу — стор нової позиції не знає.
  const during = await docRect()
  const cBox = await controls.boundingBox()
  await page.mouse.up()
  if (!cBox) throw new Error('Немає кнопок')
  expect(during.pageX, 'документ заїхав за лівий край аркуша').toBeGreaterThanOrEqual(-0.5)
  expect(Math.abs(cBox.x + cBox.width - (during.right - 4)), 'кнопки не пішли за документом').toBeLessThan(4)
  expect(cBox.y).toBeGreaterThanOrEqual(during.top - 1)
  expect(cBox.y).toBeLessThan(during.top + 20)

  // Після відпускання — стор отримав нову позицію, кнопки там само, у куті документа.
  await expect(async () => {
    const after = await docRect()
    const box = await controls.boundingBox()
    if (!box) throw new Error('Немає кнопок')
    expect(Math.abs(box.x + box.width - (after.right - 4))).toBeLessThan(4)
  }).toPass()
})

/** Чи малюється обгортка картки `a` над `b` (той самий шар): z-index, при рівності — DOM-порядок. */
async function paintedAbove(page: import('@playwright/test').Page, a: string, b: string): Promise<boolean> {
  return page.evaluate(([a, b]) => {
    const ea = document.querySelector<HTMLElement>(`[data-theory-card-id="${a}"]`)
    const eb = document.querySelector<HTMLElement>(`[data-theory-card-id="${b}"]`)
    if (!ea || !eb) throw new Error('Немає обгорток карток')
    const za = Number(getComputedStyle(ea).zIndex) || 0
    const zb = Number(getComputedStyle(eb).zIndex) || 0
    if (za !== zb) return za > zb
    return !!(eb.compareDocumentPosition(ea) & Node.DOCUMENT_POSITION_FOLLOWING)
  }, [a, b])
}

test('стрілки ↑/↓ видимо міняють порядок і для ВИДІЛЕНОЇ картки', async ({ page }) => {
  // Власник 2026-09-24 (/workspace): «кнопки ↑↓ не працюють». Виділена картка
  // піднімалась над усіма (z-index:5), тож її переміщення в списку не було видно.
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
        { id: 'z-low', type: 'theory_card', src: '', x: 100, y: 100, w: 400, h: 300, rotation: 0, locked: false,
          data: { version: 1, title: 'НИЖНЯ', body: 'нижня', formulas: [] } },
        { id: 'z-high', type: 'theory_card', src: '', x: 260, y: 180, w: 400, h: 300, rotation: 0, locked: false,
          data: { version: 1, title: 'ВЕРХНЯ', body: 'верхня', formulas: [] } },
      ],
    }
    store.selectItems(['z-low'])
  })
  await expect(page.locator('[data-theory-card-id="z-low"]')).toBeVisible()
  // Виділення не змінює порядку: верхня лишається зверху.
  expect(await paintedAbove(page, 'z-high', 'z-low')).toBe(true)

  const toolbar = page.locator('.wb-selection-toolbar')
  await toolbar.getByTitle('Показати поверх').click()
  await expect.poll(() => paintedAbove(page, 'z-low', 'z-high')).toBe(true)

  await toolbar.getByTitle('Перемістити назад').click()
  await expect.poll(() => paintedAbove(page, 'z-high', 'z-low')).toBe(true)
})

test('кнопки документа стоять у його куті за будь-якого масштабу й прокрутки', async ({ page }) => {
  // Власник 2026-09-24: «при зумові кнопки переставляються окремо».
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('local_ws_enabled', 'true'))
  await page.goto('/workspace')
  await expect(page.locator('.wb-canvas')).toBeVisible()
  await page.evaluate(async () => {
    const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
    const store = useWBStore()
    const current = store.currentPage
    if (!current) throw new Error('Немає сторінки')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#ff0000"/></svg>`
    store.pages[store.currentPageIndex] = {
      ...current,
      assets: [
        { id: 'anchor-doc', type: 'document_viewer', src: '', x: 300, y: 250, w: 900, h: 560,
          rotation: 0, locked: false, currentPage: 0, totalPages: 1,
          pages: [{ index: 0, url: `data:image/svg+xml,${encodeURIComponent(svg)}` }] },
      ],
    }
    store.selectItems(['anchor-doc'])
  })
  const controls = page.locator('[data-testid="wb-card-window-controls"]')
  await expect(controls).toHaveAttribute('data-asset-id', 'anchor-doc')

  const gap = () => page.evaluate(() => {
    const K = (window as any).Konva
    const stage = K.stages.find((s: any) => s.findOne('#anchor-doc'))
    const node = stage.findOne('#anchor-doc')
    const r = node.getClientRect({ skipShadow: true, skipStroke: true })
    const box = stage.container().getBoundingClientRect()
    const c = document.querySelector('[data-testid="wb-card-window-controls"]')!.getBoundingClientRect()
    return { right: Math.round(box.x + r.x + r.width - c.right), top: Math.round(c.top - (box.y + r.y)) }
  })
  const steps: Array<{ zoom: number; scroll: [number, number] }> = [
    { zoom: 0.5, scroll: [0, 0] }, { zoom: 1.3, scroll: [300, 200] }, { zoom: 2, scroll: [900, 600] }, { zoom: 0.75, scroll: [0, 0] },
  ]
  for (const step of steps) {
    await page.evaluate(async ({ zoom, scroll }) => {
      const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
      const store = useWBStore()
      store.setZoom(zoom)
      store.setScroll(scroll[0], scroll[1])
    }, step)
    await expect.poll(gap, { message: `зум ${step.zoom}, прокрутка ${step.scroll}` }).toEqual({ right: 4, top: 2 })
  }

  // Як власник на /workspace: виділення КЛІКОМ (чіпляється Transformer) і
  // справжнє колесо з Ctrl над документом. Саме тут кнопки відставали рівно на
  // крок масштабу (читались посеред пакета змін Konva).
  await page.evaluate(async () => {
    const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
    const store = useWBStore()
    store.clearSelection()
  })
  const center = await page.evaluate(() => {
    const K = (window as any).Konva
    const stage = K.stages.find((s: any) => s.findOne('#anchor-doc'))
    const r = stage.findOne('#anchor-doc').getClientRect()
    const box = stage.container().getBoundingClientRect()
    return { x: box.x + r.x + r.width / 2, y: box.y + r.y + r.height / 2 }
  })
  await expect(async () => {
    await page.mouse.click(center.x, center.y)
    await expect(controls).toHaveAttribute('data-asset-id', 'anchor-doc', { timeout: 500 })
  }).toPass()
  await expect.poll(gap).toEqual({ right: 4, top: 2 })
  for (const delta of [-100, -100, 100, 100, 100]) {
    await page.mouse.move(center.x, center.y)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, delta)
    await page.keyboard.up('Control')
    await page.waitForTimeout(150)
    expect(await gap(), `Ctrl+колесо ${delta}`).toEqual({ right: 4, top: 2 })
  }
})

// 2026-09-26: у режимі виділення медіакартку накриває прозорий шар перетягування
// (.wb-media-drag-surface), а «×» телепортовано в ту саму обгортку з z-index: auto.
// Шар мав z-index: 5 і лежав над кнопкою — клік по «×» лише виділяв картку.
for (const media of [
  { id: 'media-video', type: 'video_player', fields: {} },
  { id: 'media-youtube', type: 'youtube_player', fields: { youtubeUrl: '' } },
] as const) {
  test(`«×» картки ${media.type} натискається в режимі виділення`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('local_ws_enabled', 'true'))
    await page.goto('/workspace')
    await expect(page.locator('.wb-canvas')).toBeVisible()
    await page.evaluate(async ({ id, type, fields }) => {
      const { useWBStore } = await import('/src/modules/winterboard/board/state/boardStore.ts')
      const store = useWBStore()
      const current = store.currentPage
      if (!current) throw new Error('Немає сторінки тестової дошки')
      store.pages[store.currentPageIndex] = {
        ...current,
        assets: [{ id, type, src: '', x: 100, y: 100, w: 640, h: 360, rotation: 0, locked: false, ...fields }],
      }
      store.setTool('select')
      store.selectItems([id])
    }, media)

    const card = page.locator(`[data-media-id="${media.id}"]`)
    const close = page.locator('[data-testid="wb-card-window-delete"]')
    await expect(card.locator('.wb-media-drag-surface')).toHaveCount(1)
    await expect(close).toBeVisible()
    // Клік отримує той, хто зверху: у центрі «×» — сама кнопка. Для відео ще й центр
    // картки — шар: нативні кнопки плеєра в режимі виділення глухі.
    const top = await page.evaluate((id) => {
      const at = (el: Element) => {
        const r = el.getBoundingClientRect()
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      }
      return {
        close: !!at(document.querySelector('[data-testid="wb-card-window-delete"]')!)
          ?.closest('[data-testid="wb-card-window-delete"]'),
        center: at(document.querySelector(`[data-media-id="${id}"]`)!)
          ?.classList.contains('wb-media-drag-surface') ?? false,
      }
    }, media.id)
    expect(top.close, 'шар перетягування накриває «×»').toBe(true)
    if (media.type === 'video_player') expect(top.center, 'плеєр відео вийшов з-під шару').toBe(true)

    await close.click()
    await expect(card).toHaveCount(0)
  })
}
