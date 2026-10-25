/** Нативний Chromium: SVG → PNG, alpha/пропуски/restore. Без API, auth і даних уроків. */
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const server = await createServer({ configFile: false, envFile: false, root: process.cwd(),
  cacheDir: 'test-results/dictation-native-vite',
  optimizeDeps: { entries: [], noDiscovery: true },
  server: { host: '127.0.0.1', port: 5241, strictPort: true },
  plugins: [{ name: 'dictation-native-test', configureServer(instance) {
    instance.middlewares.use('/__dictation_test__', (_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<!doctype html><html lang="uk"><title>Синтетичний тест речення</title><body></body></html>')
    })
  } }],
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const origin = 'http://127.0.0.1:5241'
  await page.route('**/*', (route) => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort())
  await page.goto(`${origin}/__dictation_test__`)
  const result = await page.evaluate(async () => {
    const { sentenceFixture } = await import('/src/modules/winterboard/__tests__/fixtures/dictationLineFixture.ts')
    const { applyDictationAction } = await import('/src/modules/winterboard/board/dictationLine.ts')
    const { dictationLineSvg } = await import('/src/modules/winterboard/board/dictationLineSvg.ts')
    const { snapshotElement } = await import('/src/modules/winterboard/utils/snapshotElement.ts')
    const original = sentenceFixture()
    const frozen = JSON.stringify(original)
    async function capture(data, transparent = true) {
      const root = document.createElement('div')
      root.style.cssText = 'width:111px;height:31px'
      root.innerHTML = dictationLineSvg(data)
      if (!transparent) root.querySelector('svg').removeAttribute('data-export-background')
      document.body.append(root)
      const before = root.innerHTML
      const shot = await snapshotElement(root, new AbortController().signal)
      if (!shot) throw new Error('Нативний capture повернув null')
      if (root.innerHTML !== before) throw new Error('Capture змінив живий DOM')
      const bitmap = await createImageBitmap(shot.blob)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
      let transparentPixels = 0, inkPixels = 0
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) transparentPixels++
        if (pixels[i] > 0 && pixels[i - 3] < 120) inkPixels++
      }
      const bytes = Array.from(new Uint8Array(await shot.blob.arrayBuffer())).join(',')
      root.remove(); bitmap.close()
      return { width: shot.width, height: shot.height, transparentPixels, inkPixels, bytes }
    }
    const hidden = applyDictationAction(original, { source_revision: original.source.revision,
      action: 'set_word', token_id: 'w1', hidden: true })
    const restored = applyDictationAction(hidden, { source_revision: original.source.revision, action: 'restore' })
    const a = await capture(original), b = await capture(hidden), c = await capture(restored), old = await capture(original, false)
    return { dimensions: [a.width, a.height, b.width, b.height], alpha: a.transparentPixels,
      ink: a.inkPixels, hiddenDifferent: a.bytes !== b.bytes, restoreExact: a.bytes === c.bytes,
      oldWhite: old.transparentPixels === 0, sourceUnchanged: frozen === JSON.stringify(original) }
  })
  assert.deepEqual(result.dimensions, [111, 31, 111, 31])
  assert.ok(result.alpha > 0 && result.ink > 0)
  assert.ok(result.hiddenDifferent && result.restoreExact && result.oldWhite && result.sourceUnchanged)
  console.log('PASS нативний Chromium: PNG прозорий, чорнило є, приховування змінює пікселі, restore точний, старий SVG білий, DOM/layout незмінні.')
  console.log(JSON.stringify(result))
} finally {
  await browser?.close()
  await server.close()
}
