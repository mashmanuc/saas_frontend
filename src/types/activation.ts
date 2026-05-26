/**
 * Activation Engine — TypeScript types.
 *
 * Відповідають BE ActivationState model + ActivationService return types.
 * SSOT: saas_docs/domains/users/activation/ACTIVATION_SSOT.md §9, §10
 */

// ── PrimaryIntent ─────────────────────────────────────────────────────────────

export type PrimaryIntent =
  | 'find_tutor'
  | 'prepare_nmt'
  | 'teach'
  | 'school_partner'
  | 'exploring'

// ── Raw activation facts (read-only, SSOT §1) ─────────────────────────────────

/**
 * Raw ActivationState facts від BE.
 * INV-ACT-1: всі поля read-only — мутації тільки через API endpoints.
 * INV-ACT-13: timestamp-поля monotonic — встановлюються один раз.
 */
export interface ActivationStateDTO {
  user_id: number

  // Intent
  primary_intent: PrimaryIntent | null
  intent_set_at: string | null

  // Email
  email_verified_at: string | null

  // Profile
  profile_name_set_at: string | null
  profile_avatar_set_at: string | null
  profile_bio_set_at: string | null
  profile_bio_length: number

  // Tutor
  marketplace_draft_started_at: string | null
  marketplace_submitted_at: string | null
  marketplace_published_at: string | null
  payment_setup_at: string | null

  // Student
  first_inquiry_sent_at: string | null
  first_lesson_booked_at: string | null
  first_lesson_completed_at: string | null
  first_review_written_at: string | null

  // School
  school_contract_signed_at: string | null
  school_first_staff_added_at: string | null
  school_first_student_added_at: string | null

  // Journey
  journey_dismissed_at: string | null
}

// ── Milestones (derived, SSOT §4) ─────────────────────────────────────────────

/**
 * Derived milestone status — computed від ActivationState.
 * INV-ACT-4: ніколи не stored.
 */
export interface MilestoneStatusDTO {
  slug: string
  completed: boolean
  completed_at: string | null
}

// ── Gate check (SSOT §3) ──────────────────────────────────────────────────────

/**
 * Gate check result.
 * INV-ACT-11: тільки для FE pre-check. BE enforcement окремо.
 */
export interface GateCheckResultDTO {
  passed: boolean
  gate_slug: string
  missing: string[]   // ['email_verified', 'name_set', ...]
  help_url: string
}

// ── Gate slugs (SSOT §3) ──────────────────────────────────────────────────────

export type GateSlug =
  | 'gate.email_required'
  | 'gate.name_required'
  | 'gate.inquiry_prerequisites'
  | 'gate.marketplace_publish'
  | 'gate.payment_accept'
  | 'gate.recording_consent'
  | 'gate.school_contract'

// ── Hint trigger types (SSOT §5) ─────────────────────────────────────────────

export type HintTrigger =
  | 'repeated_failed_action'
  | 'repeated_open_close_pattern'
  | 'action_fail_gate'
  | 'first_visit_feature'
  | 'profile_quality_signal'
  | ''
