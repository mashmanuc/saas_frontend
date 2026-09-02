/**
 * Singleton lazy loader для Paddle.js v2 (той самий патерн, що gisLoader).
 *
 * Paddle.js НЕ підключається через <script> у index.html — лише сторінка
 * /billing/pay його потребує; решта бандла (дошка, replay) не має тягнути
 * сторонній скрипт.
 *
 * Returns: window.Paddle
 */

const PADDLE_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js'

let _promise: Promise<any> | null = null

export function loadPaddle(): Promise<any> {
  if (_promise) return _promise

  _promise = new Promise((resolve, reject) => {
    const w = window as any
    if (w.Paddle) {
      return resolve(w.Paddle)
    }

    const script = document.createElement('script')
    script.src = PADDLE_SRC
    script.async = true
    script.onload = () => {
      if (w.Paddle) {
        resolve(w.Paddle)
      } else {
        _promise = null
        reject(new Error('paddle_namespace_missing'))
      }
    }
    script.onerror = () => {
      // Скидаємо singleton, щоб наступний виклик міг повторити завантаження
      _promise = null
      reject(new Error('paddle_load_failed'))
    }
    document.head.appendChild(script)
  })

  return _promise
}

/** Тестовий хелпер — НЕ для production коду. */
export function _resetPaddleLoaderForTesting(): void {
  _promise = null
}
