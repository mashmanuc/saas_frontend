/**
 * Core: Resource Controller — universal data fetching with invariants.
 *
 * ІНВАРІАНТ: 1 endpoint → 1 resource → 1 контрольна точка.
 *
 * Гарантії:
 * - Promise dedup: якщо запит в польоті, повертає ТОЙ ЖЕ promise
 * - Cache + TTL: не робить запит якщо дані свіжі
 * - Force: для primary flows що потребують свіжих даних
 * - Invalidate: скидає кеш (наступний load зробить запит)
 * - Status machine: idle → loading → ready | error
 *
 * UI ніколи не вирішує коли фетчити — тільки resource layer.
 *
 * Usage:
 *   const progress = createResource({
 *     key: 'onboarding.progress',
 *     fetcher: () => api.getProgress(),
 *     ttl: 5 * 60 * 1000,
 *   })
 *
 *   await progress.load()            // cache-aware
 *   await progress.load({ force: true })  // force refresh
 *   progress.invalidate()            // next load will fetch
 *   progress.data.value              // reactive data (Ref<T | null>)
 *   progress.status.value            // 'idle' | 'loading' | 'ready' | 'error'
 */
import { ref, type Ref, readonly } from 'vue'

export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ResourceOptions<T> {
  /** Унікальний ключ ресурсу (для дебагу та ідентифікації) */
  key: string
  /** Функція завантаження даних */
  fetcher: () => Promise<T>
  /** Time-to-live в мс. 0 = без кешу. Default: 5 хв */
  ttl?: number
}

export interface Resource<T> {
  /** Реактивні дані (null до першого завантаження). Ref readonly, вміст mutable */
  readonly data: Readonly<Ref<T | null>>
  /** Поточний статус: idle → loading → ready | error */
  readonly status: Readonly<Ref<ResourceStatus>>
  /** Повідомлення про помилку (null якщо ok) */
  readonly error: Readonly<Ref<string | null>>
  /** Чи дані були завантажені хоча б раз */
  readonly loaded: Readonly<Ref<boolean>>
  /** Ключ ресурсу */
  readonly key: string

  /**
   * Завантажити ресурс.
   * - Без force: повертає кеш якщо TTL не вийшов
   * - З force: завжди робить запит
   * - Якщо запит вже в польоті: повертає той самий promise (dedup)
   */
  load(opts?: { force?: boolean }): Promise<T | null>

  /**
   * Optimistic update після mutation.
   * Єдиний спосіб змінити data ззовні — через set().
   * Дані заморожуються (Object.freeze) для захисту від прямих мутацій.
   */
  set(value: T): void

  /** Скинути кеш. Наступний load() зробить запит */
  invalidate(): void

  /** Повний reset: дані, статус, помилка, кеш */
  reset(): void
}

const DEFAULT_TTL = 5 * 60 * 1000 // 5 хвилин

export function createResource<T>(options: ResourceOptions<T>): Resource<T> {
  const { key, fetcher, ttl = DEFAULT_TTL } = options

  // Reactive state
  const data = ref<T | null>(null) as Ref<T | null>
  const status = ref<ResourceStatus>('idle')
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // Internal state (NOT reactive — no need for Vue tracking)
  let _promise: Promise<T | null> | null = null
  let _lastLoadedAt = 0

  /** Freeze data для захисту від прямих мутацій ззовні. Mutation тільки через set(). */
  function _freeze(value: T | null): T | null {
    if (value !== null && typeof value === 'object') {
      return Object.freeze(value) as T
    }
    return value
  }

  function _isFresh(): boolean {
    if (ttl <= 0) return false
    return loaded.value && Date.now() - _lastLoadedAt < ttl
  }

  async function load(opts?: { force?: boolean }): Promise<T | null> {
    const force = opts?.force ?? false

    // Cache guard: дані свіжі, не потрібен запит
    if (!force && _isFresh() && data.value !== null) {
      if (import.meta.env.DEV) {
        console.debug(`[resource:${key}] cache hit (TTL ${Math.round((ttl - (Date.now() - _lastLoadedAt)) / 1000)}s left)`)
      }
      return data.value
    }

    // Promise dedup: якщо запит вже летить, повертаємо його
    if (_promise) {
      if (import.meta.env.DEV) {
        console.debug(`[resource:${key}] dedup — reusing in-flight promise`)
      }
      return _promise
    }

    // Виконуємо запит
    _promise = (async () => {
      status.value = 'loading'
      error.value = null
      try {
        const result = await fetcher()
        data.value = _freeze(result)
        loaded.value = true
        _lastLoadedAt = Date.now()
        status.value = 'ready'
        if (import.meta.env.DEV) {
          console.debug(`[resource:${key}] loaded`)
        }
        return result
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load'
        error.value = msg
        status.value = 'error'
        if (import.meta.env.DEV) {
          console.warn(`[resource:${key}] error:`, msg)
        }
        return null
      } finally {
        _promise = null
      }
    })()

    return _promise
  }

  /**
   * Optimistic update: записує дані + синхронізує TTL.
   *
   * ІНВАРІАНТ: будь-яка мутація синхронізує TTL.
   * set() оновлює lastLoadedAt = now → дані вважаються свіжими.
   * Наступний load() без force пропустить запит (cache hit).
   * Якщо потрібен force refresh з сервера — використовуй load({ force: true }).
   */
  function set(value: T): void {
    data.value = _freeze(value)
    loaded.value = true
    status.value = 'ready'
    error.value = null
    _lastLoadedAt = Date.now() // ІНВАРІАНТ: мутація = синхронізація TTL
    if (import.meta.env.DEV) {
      console.debug(`[resource:${key}] set (optimistic, TTL reset)`)
    }
  }

  function invalidate(): void {
    _lastLoadedAt = 0
    // НЕ обнулюємо data — stale дані краще ніж null для UI
    if (import.meta.env.DEV) {
      console.debug(`[resource:${key}] invalidated`)
    }
  }

  function reset(): void {
    data.value = null
    status.value = 'idle'
    error.value = null
    loaded.value = false
    _lastLoadedAt = 0
    _promise = null
  }

  // data: NOT wrapped in readonly() — Vue's readonly() is deep and makes
  // nested properties readonly, breaking store consumers that spread/mutate.
  // Mutations controlled via set() method. Status/error/loaded are primitives → readonly is safe.
  return {
    data: data as Readonly<Ref<T | null>>,
    status: readonly(status) as Readonly<Ref<ResourceStatus>>,
    error: readonly(error) as Readonly<Ref<string | null>>,
    loaded: readonly(loaded) as Readonly<Ref<boolean>>,
    key,
    load,
    set,
    invalidate,
    reset,
  }
}
