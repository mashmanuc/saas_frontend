/**
 * Tutor Activity Status types (v0.88.2)
 * Backend contract: GET /api/v1/marketplace/tutors/me/activity-status
 */

export interface TutorActivityStatus {
  plan: string
  is_trial: boolean
  trial_ends_at: string | null
  current_month: string
  activity_required: boolean
  required_count: number
  activity_count: number
  meets_requirement: boolean
  last_activity_at: string | null
  warning_message: string | null
  has_exemption?: boolean
  is_exempt?: boolean
}
