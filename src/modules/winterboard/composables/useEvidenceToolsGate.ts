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

const enabled = ref(false)
let asked: Promise<void> | null = null

/** Лише для тестів: забути відповідь сервера. */
export function _resetEvidenceToolsGate(): void {
  enabled.value = false
  asked = null
}

export function useEvidenceToolsGate(): { evidenceEnabled: Ref<boolean> } {
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
