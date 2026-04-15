/**
 * Phase 29 (Activation) — fallback CTA.
 *
 * Якщо backend повернув `primary_cta: null`, мережа впала, або snapshot
 * пошкоджений — все одно показуємо осмислену дію замість пустого екрану.
 *
 * Ref: saas_docs/plans/DASHBOARD_ACTIVATION_PLAN.md §3.2 (Fix 1)
 */
import type { PrimaryCta } from '../api/dashboard'

export const TUTOR_FALLBACK_CTA: PrimaryCta = {
  type: 'create_lesson',
  title_key: 'dashboard.cta.create_lesson.title',
  title_params: {},
  subtitle: null,
  label_key: 'dashboard.cta.create_lesson.label',
  action_url: '/my-lessons/new',
  urgency: 'low',
  metadata: {},
}

export const STUDENT_FALLBACK_CTA: PrimaryCta = {
  type: 'find_tutor',
  title_key: 'dashboard.cta.find_tutor.title',
  title_params: {},
  subtitle: null,
  label_key: 'dashboard.cta.find_tutor.label',
  action_url: '/marketplace',
  urgency: 'low',
  metadata: {},
}

/**
 * Повертає валідний `PrimaryCta` — або з backend відповіді, або fallback.
 *
 * Правила безпеки:
 *   - null/undefined → fallback
 *   - невалідний object (без `type` або `action_url`) → fallback
 *   - нормальний CTA → повертаємо як є
 */
export function resolveCta(
  raw: PrimaryCta | null | undefined,
  role: 'tutor' | 'student',
): PrimaryCta {
  if (!raw || typeof raw !== 'object') {
    return role === 'tutor' ? TUTOR_FALLBACK_CTA : STUDENT_FALLBACK_CTA
  }
  if (!raw.type || !raw.action_url) {
    return role === 'tutor' ? TUTOR_FALLBACK_CTA : STUDENT_FALLBACK_CTA
  }
  return raw
}
