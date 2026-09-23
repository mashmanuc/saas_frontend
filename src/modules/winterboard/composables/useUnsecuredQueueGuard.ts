/**
 * Вихід із дошки не губить чергу (SYSTEM_LAW §4–§5; рев'ю P0, 2026-09-24).
 *
 * Перед будь-яким виходом — зміна дошки (той самий маршрут, інший параметр),
 * перехід в інший розділ, reload чи закриття вкладки — черга має опинитися на
 * сервері або в ПІДТВЕРДЖЕНІЙ копії у сховищі ЗАРАЗ, а не за секундним таймером
 * рекордера. Не вийшло — вихід у застосунку скасовується (без «все одно піти»:
 * закон дозволяє вийти із зупинки лише копією/відправкою або «Відкинути»);
 * reload/закриття — нативне попередження браузера (більшого браузер не дає).
 *
 * ⚠️ Викликати в setup кімнати ДО власних onBeforeRouteLeave/Update: guard'и
 * одного компонента виконуються в порядку реєстрації, скасування має статися
 * до того, як кімната прибере рекордер.
 */
import { onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, type RouteLocationNormalized } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { notifyError } from '@/utils/notify'
import { useOpsSyncStore } from '../stores/opsSyncStore'

export function useUnsecuredQueueGuard(): void {
  const opsSync = useOpsSyncStore()
  const { t } = useI18n()

  const queued = (): number => opsSync.pendingCount + opsSync.inFlightCount

  /** Черга на сервері або в перевіреній копії? */
  async function secureQueue(): Promise<boolean> {
    if (queued() === 0) return true
    if (opsSync.isSync) {
      try {
        await opsSync.flushAll()
      } catch (err) {
        console.warn('[WB:leaveGuard] flush before leave failed:', err)
      }
      if (queued() === 0) return true
    }
    return opsSync.persistQueue()
  }

  async function allowLeave(): Promise<boolean> {
    if (await secureQueue()) return true
    notifyError(t('winterboard.errors.saveBlocked.leaveBlocked', { count: queued() }))
    return false
  }

  const sameParams = (a: RouteLocationNormalized, b: RouteLocationNormalized): boolean =>
    JSON.stringify(a.params) === JSON.stringify(b.params)

  onBeforeRouteLeave(() => allowLeave())
  // /winterboard/:id → /winterboard/:id2 — той самий маршрут, leave не спрацьовує.
  onBeforeRouteUpdate((to, from) => (sameParams(to, from) ? true : allowLeave()))

  function onBeforeUnload(e: BeforeUnloadEvent): void {
    if (queued() === 0) return
    // Синхронно: секундний таймер рекордера може не встигнути.
    if (opsSync.persistQueue()) return
    e.preventDefault()
    e.returnValue = ''
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
}
