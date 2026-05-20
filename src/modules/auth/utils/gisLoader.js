/**
 * Singleton lazy loader для Google Identity Services SDK.
 *
 * INV-OAUTH-S4 (saas_docs/plans/GOOGLE_OAUTH_PLAN_2026-05-20.md):
 *   GIS бібліотека НЕ завантажується через <script> у index.html.
 *   Завантажується лазі при першому виклику loadGIS().
 *   Classroom/replay/whiteboard chunks не повинні тягнути GIS.
 *
 * Singleton + idempotent retry:
 *   - повторні виклики повертають той самий промис
 *   - якщо script.onerror → resetuємо стан, наступний виклик може повторити
 *
 * Returns: window.google.accounts.id (GIS namespace)
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client'

let _promise = null

export function loadGIS() {
  if (_promise) return _promise

  _promise = new Promise((resolve, reject) => {
    // Якщо script якимось чином уже завантажений (наприклад у dev HMR)
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      return resolve(window.google.accounts.id)
    }

    if (typeof document === 'undefined') {
      // SSR/test environment — нема DOM, відмова без crashes
      _promise = null
      return reject(new Error('gis_no_dom'))
    }

    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id)
      } else {
        _promise = null
        reject(new Error('gis_namespace_missing'))
      }
    }
    script.onerror = () => {
      // Дозволяємо retry: скидаємо singleton щоб наступний виклик зробив новий <script>
      _promise = null
      reject(new Error('gis_load_failed'))
    }
    document.head.appendChild(script)
  })

  return _promise
}

/**
 * Тестовий хелпер — НЕ для production коду.
 * Скидає singleton state.
 */
export function _resetGISLoaderForTesting() {
  _promise = null
}
