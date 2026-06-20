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
  action_url: '/winterboard/boards',
  urgency: 'low',
  metadata: {},
}

// Marketplace Extraction 2026-06-18: find_tutor/'/marketplace' прибрано (BYO — учень не
// шукає тьютора в каталозі, тьютор запрошує його). Fallback → власний розклад (live-роут,
// без bounce). Показується лише коли backend не надіслав primary_cta (edge-case).
export const STUDENT_FALLBACK_CTA: PrimaryCta = {
  type: 'view_schedule',
  title_key: 'dashboard.cta.my_schedule.title',
  title_params: {},
  subtitle: null,
  label_key: 'dashboard.cta.my_schedule.label',
  action_url: '/student/schedule',
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
  // BYO (marketplace disabled): never surface a find-tutor / catalog CTA — the student
  // is invited by a tutor, not via a public catalog. Backend may still emit it; suppress
  // → fallback. (Defense; root is compute_primary_cta_student returning find_tutor.)
  if (raw.type === 'find_tutor' || (raw.action_url || '').startsWith('/marketplace')) {
    return role === 'tutor' ? TUTOR_FALLBACK_CTA : STUDENT_FALLBACK_CTA
  }
  return raw
}
