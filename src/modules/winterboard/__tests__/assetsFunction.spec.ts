/**
 * `/assets/*` ніколи не віддає SPA-підміну (Pages Function).
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 * 2026-09-24 прод ліг посеред дня: під час перемикання деплою запит на новий
 * чанк отримав `index.html` із кодом 200, а `public/_headers` проштампував на
 * нього «кешувати рік, immutable». Браузер відмовився виконувати модуль із
 * типом text/html — білий екран, який не лікується перезавантаженням.
 *
 * ІНВАРІАНТИ
 *   INV-ASSET-404-1  HTML замість файла → чесний 404
 *   INV-ASSET-404-2  помилка не кешується (інакше знову «замерзло на рік»)
 *   INV-ASSET-404-3  справжній файл проходить наскрізь, заголовки не чіпаємо
 */
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error — Pages Function поза src, типів проєкту не має
import { onRequest, isSpaFallback } from '../../../../functions/assets/[[path]].js'

const ctx = (response: Response) => ({
  request: new Request('https://m4sh.org/assets/chunk-x.js'),
  env: { ASSETS: { fetch: vi.fn(async () => response) } },
})

describe('Pages Function для /assets/*', () => {
  it('INV-ASSET-404-1 + 2: підміна index.html → 404 без кешування', async () => {
    const fallback = new Response('<!doctype html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' },
    })
    const res = await onRequest(ctx(fallback))
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).not.toContain('text/html')
  })

  it('INV-ASSET-404-3: справжній чанк іде наскрізь, з типом і тілом', async () => {
    const real = new Response('export const a=1', {
      status: 200,
      headers: { 'content-type': 'application/javascript' },
    })
    const res = await onRequest(ctx(real))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/javascript')
    expect(await res.text()).toBe('export const a=1')
  })

  // Імена файлів із хешем вмісту → кеш на рік правильний, але ставимо його САМІ:
  // Cloudflare не обіцяє, що `public/_headers` доживе до відповіді з ASSETS.fetch.
  it('кеш на рік для справжніх файлів ставить сама функція', async () => {
    const real = new Response('body', { status: 200, headers: { 'content-type': 'text/css' } })
    const res = await onRequest(ctx(real))
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })

  it('розпізнавання підміни не залежить від регістру й параметрів заголовка', () => {
    expect(isSpaFallback(new Response('', { headers: { 'content-type': 'TEXT/HTML; charset=UTF-8' } }))).toBe(true)
    expect(isSpaFallback(new Response('', { headers: { 'content-type': 'application/javascript' } }))).toBe(false)
    expect(isSpaFallback(new Response(''))).toBe(false)
  })
})
