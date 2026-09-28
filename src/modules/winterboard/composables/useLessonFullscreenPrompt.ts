/**
 * Підказка «⛶ Повний екран для уроку» на ноутбуці, щойно підключився пульт (власник 2026-09-28, «так»).
 *
 * Чому потрібна: «⛶ На весь екран» з пульта розгортає відео поверх сторінки, але на весь МОНІТОР —
 * лише коли сам браузер у повному екрані. Увімкнути його сигналом з телефона браузер не дозволяє:
 * потрібне справжнє натискання на ноутбуці (правило Chrome, як і для звуку). Тому в мить, коли
 * вчитель біля ноутбука (підключає пульт), пропонуємо один дотик — та сама дія, що ⛶ у шапці
 * (`useProjectorMode.enter`), або F11 — повний екран браузера на весь урок, навіть після F5.
 *
 * Лише вигляд цього ноутбука: без ops, мережі й запису.
 */
import { computed, getCurrentScope, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'

/** Браузер уже на весь екран: ⛶ сайту (Fullscreen API) або F11 (повний екран самого браузера). */
export function isBrowserFullscreen(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (document.fullscreenElement) return true
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true
  const s = window.screen
  // F11 не завжди видно через display-mode: тоді вікно просто дорівнює екрану
  return !!s && s.width > 0 && Math.abs(window.innerWidth - s.width) <= 1 && Math.abs(window.innerHeight - s.height) <= 1
}

export interface LessonFullscreenPromptOptions {
  /** Та сама умова, що й для пульта на цьому ноутбуці: власник уроку, не Студія, не локальна дошка. */
  enabled: Ref<boolean> | ComputedRef<boolean>
  /** Пульт уже привітався з цим ноутбуком (`useBoardRemote.remoteConnected`). */
  remoteConnected: Ref<boolean> | ComputedRef<boolean>
  /** Режим проєктора (⛶ у шапці) увімкнено. */
  projectorOn: Ref<boolean> | ComputedRef<boolean>
}

export function useLessonFullscreenPrompt(opts: LessonFullscreenPromptOptions) {
  /** Учитель закрив підказку «×» — до перезавантаження сторінки більше не показуємо. */
  const dismissed = ref(false)
  const browserFullscreen = ref(isBrowserFullscreen())

  function refresh(): void {
    browserFullscreen.value = isBrowserFullscreen()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', refresh)
    document.addEventListener('fullscreenchange', refresh)
    if (getCurrentScope()) {
      onScopeDispose(() => {
        window.removeEventListener('resize', refresh)
        document.removeEventListener('fullscreenchange', refresh)
      })
    }
  }

  const visible = computed(() =>
    opts.enabled.value
    && opts.remoteConnected.value
    && !opts.projectorOn.value
    && !browserFullscreen.value
    && !dismissed.value,
  )

  function dismiss(): void {
    dismissed.value = true
  }

  return { visible, dismiss, refresh }
}
