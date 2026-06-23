/**
 * Plan characteristics auto-generated from Plan.limits (PLAN V2 — Option A).
 *
 * SSOT: числа беруться з `Plan.limits` (технічна частина). Тут — лише ПОРЯДОК
 * показу + лейбли + форматування одиниць. Чисел квот тут НЕМАЄ (Rule 2).
 *  - Змінити число квоти → Staff (Plan.limits), без коду й деплою.
 *  - Додати характеристику на картку → додати запис у DISPLAY_FEATURES.
 *
 * Деталі: saas_docs/plans/TARIFFS_V2_MARKETING_SSOT_2026-06-23.md
 */
import type { PlanLimits } from '@/modules/billing/api/dto'

/** Мінімальний тип vue-i18n `t` (key + named-інтерполяція). */
export type TranslateFn = (key: string, named?: Record<string, unknown>) => string

const GB = 1024 ** 3
const MB = 1024 ** 2

/** bytes → локалізоване "2 ГБ" / "500 МБ" (одиниця через i18n). */
function formatBytes(v: number, t: TranslateFn): string {
  if (v >= GB) {
    const n = v / GB
    return t('billing.planFeatures.unit.gb', { n: Number.isInteger(n) ? n : Number(n.toFixed(1)) })
  }
  return t('billing.planFeatures.unit.mb', { n: Math.round(v / MB) })
}

interface FeatureSpec {
  /** ключ у Plan.limits */
  key: string
  /** i18n-ключ лейбла; отримує { value } = відформатоване значення */
  label: string
  /** i18n-ключ для unlimited (null) варіанту */
  unlimited: string
  /** формат сирого значення → рядок для {value} */
  format: (v: number, t: TranslateFn) => string
}

/**
 * ТЕХНІЧНІ ключі Plan.limits — НІКОЛИ не показуємо людям (лише enforcement).
 * Список ЯВНИЙ навмисно: щоб через місяць не почали рендерити «все з JSON».
 * Новий ключ у Plan.limits → свідомо віднеси АБО в DISPLAY_FEATURES (показати),
 * АБО сюди (сховати). Kill-test planLimitFeatures.spec.ts ловить пропуск.
 */
export const HIDDEN_TECHNICAL_KEYS = [
  'asset_max_size_bytes', // макс. розмір одного файлу — технічне
  'board_user_storage_bytes', // сховище дошки на юзера — технічне
] as const

/**
 * КУРОВАНИЙ, упорядкований список характеристик для картки тарифу.
 * ПОКАЗУЄМО лише ці ключі (порядок = порядок показу на картці).
 * Решта (HIDDEN_TECHNICAL_KEYS) не рендериться. НЕ виводити «все з limits».
 */
const DISPLAY_FEATURES: FeatureSpec[] = [
  {
    key: 'materials_storage_bytes',
    label: 'billing.planFeatures.materialsStorage',
    unlimited: 'billing.planFeatures.materialsStorageUnlimited',
    format: formatBytes,
  },
  {
    key: 'board_session_storage_bytes',
    label: 'billing.planFeatures.boardStorage',
    unlimited: 'billing.planFeatures.boardStorageUnlimited',
    format: formatBytes,
  },
  {
    key: 'board_session_assets',
    label: 'billing.planFeatures.boardAssets',
    unlimited: 'billing.planFeatures.boardAssetsUnlimited',
    format: (v) => String(v),
  },
  {
    key: 'replay_retention_days',
    label: 'billing.planFeatures.replayRetention',
    unlimited: 'billing.planFeatures.replayRetentionUnlimited',
    format: (v) => String(v),
  },
  {
    key: 'audio_object_max_bytes',
    label: 'billing.planFeatures.audioMax',
    unlimited: 'billing.planFeatures.audioMaxUnlimited',
    format: formatBytes,
  },
]

/** Ключі, які РЕАЛЬНО показуємо на картці (для kill-тесту категоризації). */
export const DISPLAY_FEATURE_KEYS = DISPLAY_FEATURES.map((f) => f.key)

/**
 * Побудувати характеристики картки тарифу з Plan.limits.
 * Виводимо лише ключі, ПРИСУТНІ у limits (відсутній ключ — не показуємо).
 * null = безліміт → unlimited-варіант лейбла.
 */
export function buildPlanFeatures(limits: PlanLimits | undefined | null, t: TranslateFn): string[] {
  if (!limits) return []
  const out: string[] = []
  for (const spec of DISPLAY_FEATURES) {
    if (!(spec.key in limits)) continue
    const v = limits[spec.key]
    if (v === null || v === undefined) {
      out.push(t(spec.unlimited))
    } else {
      out.push(t(spec.label, { value: spec.format(v, t) }))
    }
  }
  return out
}
