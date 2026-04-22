/**
 * Auth Refresh Mutex
 * P0 FIX: Гарантує тільки 1 concurrent refresh запит
 * 
 * Інваріант: Поки refreshPromise існує — всі інші запити чекають,
 * а не ініціюють новий refresh
 */

import { ref } from 'vue'

let globalRefreshPromise: Promise<string> | null = null

export function useAuthMutex() {
  /**
   * Виконує refresh з mutex
   * @param refreshFn — функція що повертає Promise<token>
   * @returns Promise<string> — новий токен
   */
  async function executeRefresh(refreshFn: () => Promise<string>): Promise<string> {
    // Якщо вже є активний refresh — чекаємо його
    if (globalRefreshPromise) {
      console.log('[AuthMutex] Waiting for existing refresh...')
      return globalRefreshPromise
    }

    // Створюємо новий refresh promise
    globalRefreshPromise = refreshFn().finally(() => {
      globalRefreshPromise = null
    })

    return globalRefreshPromise
  }

  /**
   * Скасує активний refresh (наприклад, при logout)
   */
  function abortRefresh(): void {
    globalRefreshPromise = null
  }

  /**
   * Перевіряє чи є активний refresh
   */
  function isRefreshing(): boolean {
    return globalRefreshPromise !== null
  }

  return {
    executeRefresh,
    abortRefresh,
    isRefreshing
  }
}
