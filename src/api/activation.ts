/**
 * Activation Engine — API client.
 *
 * Всі функції відповідають SSOT §9 endpoints:
 *   GET  /api/v1/activation/state/
 *   GET  /api/v1/activation/milestones/
 *   POST /api/v1/activation/intent/
 *   POST /api/v1/activation/hint/shown/
 *   POST /api/v1/activation/hint/dismiss/
 *   GET  /api/v1/activation/gates/{slug}/
 *
 * SSOT: saas_docs/domains/users/activation/ACTIVATION_SSOT.md §9
 */

import apiClient from '@/api/client'
import type {
  ActivationStateDTO,
  GateCheckResultDTO,
  GateSlug,
  HintTrigger,
  MilestoneStatusDTO,
  PrimaryIntent,
} from '@/types/activation'

const BASE = '/v1/activation'

// ── State ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/activation/state/
 * Отримати raw activation facts для поточного user.
 */
export async function fetchActivationState(): Promise<ActivationStateDTO> {
  const res = await apiClient.get<{ activation_state: ActivationStateDTO }>(
    `${BASE}/state/`,
  )
  return res.activation_state
}

// ── Milestones ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/activation/milestones/
 * Derived milestones — computed від фактів, залежить від user.role.
 * INV-ACT-4: ніколи не stored.
 */
export async function fetchActivationMilestones(): Promise<MilestoneStatusDTO[]> {
  const res = await apiClient.get<{ milestones: MilestoneStatusDTO[] }>(
    `${BASE}/milestones/`,
  )
  return res.milestones
}

// ── Intent ────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/activation/intent/
 * Записати primary intent (Intent Question відповідь).
 * Idempotent — повторний виклик ігнорується (INV-ACT-2).
 */
export async function postActivationIntent(intent: PrimaryIntent): Promise<void> {
  await apiClient.post(`${BASE}/intent/`, { intent })
}

// ── Hints ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/activation/hint/shown/
 * Записати факт показу hint (append-only).
 * FE викликає після того як hint компонент відрендерився.
 */
export async function postHintShown(
  hint_slug: string,
  page: string,
  trigger: HintTrigger = '',
): Promise<void> {
  await apiClient.post(`${BASE}/hint/shown/`, { hint_slug, page, trigger })
}

/**
 * POST /api/v1/activation/hint/dismiss/
 * Dismiss hint for_now (cooldown 24h) або forever.
 */
export async function postHintDismiss(
  hint_slug: string,
  forever: boolean,
): Promise<void> {
  await apiClient.post(`${BASE}/hint/dismiss/`, { hint_slug, forever })
}

// ── Gates ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/activation/gates/{slug}/
 * FE pre-check для gate status.
 * INV-ACT-11: НЕ заміна BE enforcement — тільки для UX pre-check.
 */
export async function fetchGateCheck(slug: GateSlug): Promise<GateCheckResultDTO> {
  const res = await apiClient.get<{ gate: GateCheckResultDTO }>(
    `${BASE}/gates/${slug}/`,
  )
  return res.gate
}
