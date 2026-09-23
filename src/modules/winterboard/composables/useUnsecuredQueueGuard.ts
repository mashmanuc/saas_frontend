/**
 * SAVE_BLOCKED + сховище відмовило (SYSTEM_LAW §4, `storage_failed`): черга живе лише
 * в пам'яті вкладки. Будь-який вихід її знищує — зміна дошки (bootstrap іншої сесії
 * очищає чергу, INV-CROSS-SESSION), вихід із кімнати, reload чи закриття вкладки.
 * Закон дозволяє вийти з цього стану лише дією вчителя: завантажити копію або
 * відкинути. Тому вихід без цього — лише після явного підтвердження (рев'ю P0, 2026-09-24).
 *
 * ⚠️ Викликати в setup кімнати ДО власних onBeforeRouteLeave: guard'и одного
 * компонента виконуються в порядку реєстрації, а скасування має статися до того,
 * як кімната прибере рекордер.
 */
import { onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, type RouteLocationNormalized } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOpsSyncStore } from '../stores/opsSyncStore'

export function useUnsecuredQueueGuard(): void {
  const opsSync = useOpsSyncStore()
  const { t } = useI18n()

  function allowLeave(): boolean {
    if (!opsSync.hasUnsecuredQueue) return true
    return window.confirm(t('winterboard.errors.saveBlocked.confirmLeave', {
      count: opsSync.pendingCount + opsSync.inFlightCount,
    }))
  }

  onBeforeRouteLeave(() => allowLeave())
  // /winterboard/:id → /winterboard/:id2 — той самий маршрут, leave не спрацьовує.
  onBeforeRouteUpdate((to: RouteLocationNormalized, from: RouteLocationNormalized) =>
    to.params.id === from.params.id ? true : allowLeave())

  function onBeforeUnload(e: BeforeUnloadEvent): void {
    if (!opsSync.hasUnsecuredQueue) return
    e.preventDefault()
    e.returnValue = ''
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
}
