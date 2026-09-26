/**
 * Гейт «Навчальних обʼєктів» (шкала часу, карта подій) у панелі інструментів.
 *
 * Домовленість власника: ці інструменти бачить лише його акаунт, доки шар не
 * прийнято. На бекенді такий гейт уже є — rollout коридорів Інтегралика
 * (`apps/intent/corridors/gate.py`, `INTEGRALYK_CORRIDORS_USER_IDS`, на проді
 * `{40}`): `GET /v1/intents/corridors/` віддає 404 тим, хто поза списком.
 * Тому другого списку id на фронті НЕ заводимо — питаємо той самий сервер.
 *
 * 2026-09-24: до цього гейта не було зовсім — плитку «Навчальні обʼєкти»
 * бачили всі вчителі на проді.
 *
 * Запит один на вкладку: результат кешується на рівні модуля (інструменти
 * відкривають часто, а відповідь не змінюється в межах сеансу).
 */
import { ref, type Ref } from 'vue'
import { fetchCorridorRegistry } from '@/modules/intent/corridors/corridorApi'
import { useAuthStore } from '@/modules/auth/store/authStore'

const enabled = ref(false)
let asked: Promise<void> | null = null

/** Лише для тестів: забути відповідь сервера. */
export function _resetEvidenceToolsGate(): void {
  enabled.value = false
  asked = null
}

export function useEvidenceToolsGate(): { evidenceEnabled: Ref<boolean> } {
  // 2026-09-27: сервер питаємо лише тоді, коли відповідь щось вирішує і не обернеться
  // тостом чи викиданням людини зі сторінки:
  //   • гість — 401, а apiClient на 401 показує «Сесію завершено. Увійдіть знову.» людині,
  //     яка не входила (публічний реплей із лендингу, демо /workspace);
  //   • сесію ще не перевірено — публічні маршрути bootstrap свідомо не роблять
  //     (router/index.js, P0), тож протухла сесія з localStorage давала 401 → refresh 401 →
  //     forceLogout і переліт на /start просто з реплею. Кімнати, де гейт і працює, —
  //     захищені маршрути: там bootstrap проходить до рендеру;
  //   • учень — 403 і тост «Доступ заборонено» посеред уроку (Інтегралик — інструмент
  //     тьютора, BE `IsIntegralykUser`); учневі картки й так не ховаються (`hideEvidenceCards`).
  // Для всіх трьох гейт і так закритий (fail-closed). `asked` лишається порожнім: стан
  // змінився (увійшов, bootstrap пройшов) — наступний виклик спитає сервер.
  const auth = useAuthStore()
  if (!auth.isBootstrapped || !auth.isAuthenticated || auth.user?.role === 'student') {
    return { evidenceEnabled: enabled }
  }
  asked ??= fetchCorridorRegistry('uk')
    .then((reg: unknown) => {
      enabled.value = !!(reg as { enabled?: boolean } | null)?.enabled
    })
    .catch(() => {
      // 404 = акаунт поза rollout-гейтом; будь-яка інша помилка — теж без
      // інструментів (fail-closed: краще не показати, ніж показати зайве).
      enabled.value = false
    })
  return { evidenceEnabled: enabled }
}
