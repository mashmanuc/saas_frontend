/** Локальний E2E трьох дій на РУЧНИХ прикладах, не предметний AI-замір. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = [], api = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => { if (/^\/(api\/|v1\/)/.test(new URL(request.url()).pathname)) api.push(request.url()) })
  await page.route('**/*', (route) => route.request().url().startsWith('http://127.0.0.1:5242/') ? route.continue() : route.abort())
  await page.goto('http://127.0.0.1:5242/dictation-analysis-preview.html')
  const board = page.getByTestId('preview-board')
  await board.locator('svg').waitFor()
  for (const kind of ['orthograms', 'basis', 'parts']) {
    const before = await page.getByTestId('preview-ops').textContent()
    await page.locator(`[data-analysis-kind="${kind}"]`).click()
    await page.getByTestId('analysis-review').waitFor()
    assert.equal(await page.getByTestId('preview-ops').textContent(), before)
    await page.getByTestId('analysis-confirm').click()
    await page.getByTestId('analysis-review').waitFor({ state: 'hidden' })
  }
  assert.ok(await board.locator('polyline[stroke="#dc2626"]').count() > 0)
  assert.equal(await board.locator('path').count(), 2)
  assert.equal(await board.locator('text').count(), 3)
  await page.locator('[data-word-id="w1"]').click()
  await page.getByTestId('sentence-word').click()
  await page.getByTestId('sentence-word').filter({ hasText: 'Показати слово' }).waitFor()
  assert.equal(await board.locator('text').count(), 2)
  assert.equal(await board.locator('path').count(), 1)
  assert.equal(await board.locator('polyline[stroke="#dc2626"]').count(), 0)
  await page.getByTestId('sentence-restore').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="preview-board"] text').length === 3)
  await page.getByTestId('preview-undo').click()
  assert.equal(await board.locator('text').count(), 2)
  await page.getByTestId('preview-redo').click()
  assert.equal(await board.locator('text').count(), 3)
  await page.screenshot({ path: 'test-results/dictation-analysis.png', fullPage: true })
  await page.getByTestId('preview-available').uncheck()
  assert.equal(await page.getByTestId('sentence-analysis').count(), 0)
  assert.equal(await page.getByTestId('sentence-restore').count(), 1)
  await page.getByTestId('preview-available').check()
  for (const example of ['ruled', 'multiline', 'short']) {
    await page.getByTestId('preview-example').selectOption(example)
    await page.getByTestId('preview-zoom').selectOption('0.68')
    for (const kind of ['parts', 'basis', 'orthograms']) {
      await page.locator(`[data-analysis-kind="${kind}"]`).click()
      await page.getByTestId('analysis-confirm').click()
      await page.getByTestId('analysis-review').waitFor({ state: 'hidden' })
    }
    const measured = await board.locator('svg').evaluate((svg) => {
      const ink = [...svg.querySelectorAll('polyline')].map((node) => node.getBoundingClientRect())
      const top = Math.min(...ink.map((box) => box.top))
      return [...svg.querySelectorAll('text')].map((node) => ({
        font: Number(node.getAttribute('font-size')), compressed: node.hasAttribute('textLength'),
        visibleHeight: node.getBoundingClientRect().height,
        aboveInk: node.getBoundingClientRect().bottom < top,
      }))
    })
    assert.equal(measured.length, example === 'multiline' ? 6 : example === 'short' ? 2 : 3)
    assert.ok(measured.every((label) => label.font >= 24 && !label.compressed && label.visibleHeight >= 15 && label.aboveInk), JSON.stringify(measured))
    await page.screenshot({ path: `test-results/dictation-analysis-${example}-68.png`, fullPage: true })
  }
  assert.deepEqual(errors, []); assert.deepEqual(api, [])
  console.log('PASS: чернетки/confirm/hide/restore/undo/redo; OFF ховає лише аналіз; ruled/multiline/short на68% — підписи >=24px, не стиснуті, поза чорнилом; pageerror0/API0.')
} finally { await browser.close() }
