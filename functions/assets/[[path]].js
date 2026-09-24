/**
 * `/assets/*` — файли збірки й ТІЛЬКИ вони.
 *
 * ЧОМУ ЦЕ ІСНУЄ (2026-09-24, прод ліг посеред дня)
 *
 * Cloudflare Pages без кореневого `404.html` вважає проєкт SPA і будь-який
 * невідомий шлях підміняє на `index.html` із кодом 200. Правило в
 * `public/_headers` діє за шляхом і не знає, що поїхало тілом, тож на цю
 * підміну лягає `Cache-Control: public, max-age=31536000, immutable`.
 *
 * Далі: під час перемикання деплою браузер просить новий чанк, на кілька
 * секунд отримує HTML замість JavaScript — і кладе його в кеш НА РІК як
 * незмінний. Chrome відмовляється виконувати модуль із типом `text/html`
 * («Expected a JavaScript-or-Wasm module script»), застосунок не стартує, і
 * людина бачить білий екран, який не лікується ні перезавантаженням, ні
 * анонімним вікном. Механізм лежав із 2026-03-01; 2026-09-24 у нього влучили,
 * бо продових деплоїв за день було 17, і всі вдень.
 *
 * Тут ми не «лагодимо симптом», а прибираємо саму підміну: під `/assets/`
 * лежать лише згенеровані файли, і відсутній файл мусить бути чесним 404,
 * якого кеш не зберігає. Справжні файли проходять наскрізь, зі своїми
 * заголовками (зокрема тим самим кешем на рік) — їх ця функція не змінює.
 */

/** Чи віддали нам SPA-підміну замість файла збірки. */
export function isSpaFallback(response) {
  return (response.headers.get('content-type') || '').toLowerCase().includes('text/html')
}

/**
 * Кеш для справжніх файлів ставимо ТУТ, а не покладаємось на `public/_headers`:
 * документація Cloudflare не обіцяє, що правила `_headers` доживають до
 * відповіді, яку функція дістає через `env.ASSETS.fetch`. Імена файлів мають
 * хеш вмісту, тож «рік, незмінний» — правда для всіх них (js, css, шрифти).
 */
const IMMUTABLE = 'public, max-age=31536000, immutable'

export async function onRequest(context) {
  const response = await context.env.ASSETS.fetch(context.request)

  if (isSpaFallback(response)) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        // ⚠️ Головне: помилку НЕ кешуємо. Інакше повертаємось до того самого
        // «замерзло на рік», лише з іншим кодом.
        'cache-control': 'no-store',
      },
    })
  }

  if (!response.ok) return response

  const headers = new Headers(response.headers)
  headers.set('cache-control', IMMUTABLE)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
