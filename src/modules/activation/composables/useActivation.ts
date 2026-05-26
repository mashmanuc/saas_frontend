/**
 * useActivation — головний composable для Activation Engine.
 *
 * Публічне API (SSOT §10.1):
 *   state          — raw ActivationState facts (reactive)
 *   milestones     — derived MilestoneStatus[] (reactive)
 *   isLoading      — true під час першого завантаження
 *   checkGate()    — FE pre-check для gate (INV-ACT-11: НЕ заміна BE enforcement)
 *   recordIntent() — записати primary intent
 *   recordHintShown()  — зафіксувати що hint показано
 *   dismissHint()  — dismiss hint (for_now або forever)
 *   invalidate()   — ручне скидання кешу (після domain mutations)
 *
 * Архітектура:
 *   - state/milestones через Tanstack Vue Query (кеш + stale detection)
 *   - mutations через apiClient напряму + queryClient.invalidateQueries
 *   - НЕ Pinia store (activation — read-mostly, похідний від сервера)
 *
 * INV-ACT-4:  milestones computed server-side, не stored
 * INV-ACT-11: checkGate — FE pre-check only
 * INV-ACT-10: mutation errors не блокують UI (тільки log + console.warn)
 *
 * SSOT: saas_docs/domains/users/activation/ACTIVATION_SSOT.md §10
 */

import { computed } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'

import { queryKeys } from '@/api/queryKeys'
import {
  fetchActivationMilestones,
  fetchActivationState,
  fetchGateCheck,
  postActivationIntent,
  postHintDismiss,
  postHintShown,
} from '@/api/activation'
import type {
  ActivationStateDTO,
  GateCheckResultDTO,
  GateSlug,
  HintTrigger,
  MilestoneStatusDTO,
  PrimaryIntent,
} from '@/types/activation'

// ── Cache TTL constants ───────────────────────────────────────────────────────

/** Activation state: 5 хв stale (події рідкісні, але важливо вчасно оновити). */
const STATE_STALE_MS = 5 * 60 * 1000

/** Milestones: теж 5 хв — derived від state, скидаємо разом. */
const MILESTONES_STALE_MS = 5 * 60 * 1000

/** Gate checks: 2 хв — може змінитись після дій user. */
const GATE_STALE_MS = 2 * 60 * 1000

// ── Composable ────────────────────────────────────────────────────────────────

export function useActivation() {
  const queryClient = useQueryClient()

  // ── State query ─────────────────────────────────────────────────────────

  const stateQuery = useQuery<ActivationStateDTO>({
    queryKey: queryKeys.activationState(),
    queryFn: fetchActivationState,
    staleTime: STATE_STALE_MS,
  })

  // ── Milestones query ─────────────────────────────────────────────────────

  const milestonesQuery = useQuery<MilestoneStatusDTO[]>({
    queryKey: queryKeys.activationMilestones(),
    queryFn: fetchActivationMilestones,
    staleTime: MILESTONES_STALE_MS,
  })

  // ── Derived ──────────────────────────────────────────────────────────────

  const state = computed<ActivationStateDTO | undefined>(() => stateQuery.data.value)
  const milestones = computed<MilestoneStatusDTO[]>(() => milestonesQuery.data.value ?? [])
  const isLoading = computed<boolean>(
    () => stateQuery.isLoading.value || milestonesQuery.isLoading.value,
  )

  // ── Intent (INV-ACT-8) ───────────────────────────────────────────────────

  /**
   * Записати primary intent (перша відповідь на Intent Question).
   * Idempotent — повторний виклик ігнорується сервером (INV-ACT-2).
   * Після запису скидаємо state кеш, щоб intent_set_at оновився.
   */
  async function recordIntent(intent: PrimaryIntent): Promise<void> {
    await postActivationIntent(intent)
    await _invalidateState()
  }

  // ── Gate check (INV-ACT-11) ──────────────────────────────────────────────

  /**
   * FE pre-check для gate.
   * INV-ACT-11: НЕ є BE enforcement — тільки для UX (показати блокер заздалегідь).
   * BE validation відбувається окремо у відповідному domain-endpoint.
   */
  async function checkGate(slug: GateSlug): Promise<GateCheckResultDTO> {
    // Спочатку перевіряємо Tanstack cache
    const cached = queryClient.getQueryData<GateCheckResultDTO>(
      queryKeys.activationGate(slug),
    )
    if (cached) return cached

    // Не в кеші — fetche + cache
    return queryClient.fetchQuery<GateCheckResultDTO>({
      queryKey: queryKeys.activationGate(slug),
      queryFn: () => fetchGateCheck(slug),
      staleTime: GATE_STALE_MS,
    })
  }

  // ── Hints (INV-ACT-5, INV-ACT-6) ────────────────────────────────────────

  /**
   * Зафіксувати що hint був показаний (append-only).
   * Викликати після того як hint компонент відрендерився.
   * INV-ACT-10: помилка не блокує UI — тільки console.warn.
   */
  async function recordHintShown(
    hint_slug: string,
    page: string,
    trigger: HintTrigger = '',
  ): Promise<void> {
    try {
      await postHintShown(hint_slug, page, trigger)
    } catch (err) {
      // INV-ACT-10: non-blocking
      console.warn('[activation] recordHintShown failed (non-blocking):', err)
    }
  }

  /**
   * Dismiss hint.
   * forever=true  → ніколи більше не показувати (записується в БД назавжди).
   * forever=false → cooldown 24h (INV-ACT-6).
   */
  async function dismissHint(hint_slug: string, forever: boolean): Promise<void> {
    try {
      await postHintDismiss(hint_slug, forever)
    } catch (err) {
      console.warn('[activation] dismissHint failed (non-blocking):', err)
    }
  }

  // ── Cache management ─────────────────────────────────────────────────────

  /**
   * Скинути кеш activation state + milestones.
   * Викликати після domain mutations що впливають на activation facts
   * (наприклад, після відправки inquiry, після верифікації email).
   */
  async function invalidate(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['activation'] })
  }

  /**
   * Invalidate конкретного gate (наприклад після того як user виправив missing).
   */
  async function invalidateGate(slug: GateSlug): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.activationGate(slug),
    })
  }

  // ── Private ──────────────────────────────────────────────────────────────

  async function _invalidateState(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.activationState() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activationMilestones() }),
    ])
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    // Reactive data
    state,
    milestones,
    isLoading,

    // Mutations
    recordIntent,
    recordHintShown,
    dismissHint,

    // Gate check (async, cached)
    checkGate,

    // Cache control
    invalidate,
    invalidateGate,

    // Raw query refs (для компонентів яким потрібна деталізація стану)
    stateQuery,
    milestonesQuery,
  }
}
