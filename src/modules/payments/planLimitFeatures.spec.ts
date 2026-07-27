import { describe, it, expect } from 'vitest'
import { DISPLAY_FEATURE_KEYS, HIDDEN_TECHNICAL_KEYS, buildPlanFeatures } from './planLimitFeatures'

/**
 * Усі відомі ключі Plan.limits (seed: backend payments/0013_seed_resource_limits).
 * Якщо у seed з'явиться новий ключ — додай його сюди, і тест змусить
 * категоризувати його у planLimitFeatures.ts (показати або сховати).
 */
/**
 * УСІ ключі, що реально живуть у Plan.limits на проді (звірено ssh 2026-07-27).
 *
 * ⚠️ Цей список — РУЧНИЙ, і саме тому колись проґавив monthly_* (мігр. 0016
 * додала 3 ключі у Plan.limits, сюди їх не внесли → тест лишався зеленим, а
 * картка не показувала єдину реальну різницю між планами). Додаєш ключ у
 * Plan.limits → ОБОВ'ЯЗКОВО додай сюди, інакше guard знову промовчить.
 */
const KNOWN_LIMIT_KEYS = [
  'materials_storage_bytes',
  'board_session_storage_bytes',
  'board_session_assets',
  'replay_retention_days',
  'audio_object_max_bytes',
  'asset_max_size_bytes',
  'board_user_storage_bytes',
  // 2026-07-27: реально присутні у Plan.limits, раніше не покриті guard'ом
  'monthly_ai_requests',
  'monthly_exports',
  'monthly_imports',
  'monthly_generated_lessons',
  'max_active_students',
]

describe('planLimitFeatures — категоризація ключів', () => {
  it('показувані та сховані набори НЕ перетинаються', () => {
    const shown = new Set<string>(DISPLAY_FEATURE_KEYS)
    for (const k of HIDDEN_TECHNICAL_KEYS) {
      expect(shown.has(k)).toBe(false)
    }
  })

  it('кожен відомий ключ Plan.limits категоризований (показаний АБО схований)', () => {
    const categorized = new Set<string>([...DISPLAY_FEATURE_KEYS, ...HIDDEN_TECHNICAL_KEYS])
    for (const k of KNOWN_LIMIT_KEYS) {
      expect(
        categorized.has(k),
        `limit key "${k}" не категоризований у planLimitFeatures.ts (додай у DISPLAY_FEATURES або HIDDEN_TECHNICAL_KEYS)`,
      ).toBe(true)
    }
  })
})

describe('planLimitFeatures — buildPlanFeatures', () => {
  // мінімальний stub vue-i18n t: повертає key + значення (детермінований)
  const t = (key: string, named?: Record<string, unknown>) =>
    named ? `${key}:${JSON.stringify(named)}` : key

  it('показує лише ключі, ПРИСУТНІ у limits (технічні сховані)', () => {
    const out = buildPlanFeatures(
      {
        materials_storage_bytes: 2147483648,
        asset_max_size_bytes: 10485760, // технічний → НЕ має з'явитись
      },
      t,
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toContain('billing.planFeatures.materialsStorage')
    expect(out.join('|')).not.toContain('asset_max_size')
  })

  it('null → unlimited-варіант лейбла', () => {
    const out = buildPlanFeatures({ replay_retention_days: null }, t)
    expect(out).toEqual(['billing.planFeatures.replayRetentionUnlimited'])
  })

  it('порожні/відсутні limits → []', () => {
    expect(buildPlanFeatures(undefined, t)).toEqual([])
    expect(buildPlanFeatures({}, t)).toEqual([])
  })
})
