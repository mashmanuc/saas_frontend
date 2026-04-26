// F8: Onboarding API Client
// PR-FE-1 (2026-04-26): added /v1/ prefix to all 10 endpoints (was 404 у проді).
// PR-FE-2: removed silent fallback у getProgress (масковало 404 як is_completed=true).
// See saas_docs/plans/API_CONTRACT_FIX_PLAN_2026-04-26.md §1.
import apiClient from '@/utils/apiClient'

export interface OnboardingStep {
  id: number
  slug: string
  order: number
  title: string
  description: string
  icon: string
  illustration: string
  action_type: 'navigate' | 'modal' | 'form' | 'video' | 'verify'
  action_target: string
  is_required: boolean
  is_skippable: boolean
}

export interface OnboardingProgress {
  onboarding_type: 'student' | 'tutor'
  current_step: OnboardingStep | null
  completed_steps: OnboardingStep[]
  skipped_steps: OnboardingStep[]
  is_completed: boolean
  is_dismissed: boolean
  progress_percentage: number
}

export interface ChecklistItem {
  id: number
  slug: string
  category: string
  title: string
  description: string
  is_completed: boolean
  completed_at: string | null
  points: number
}

export interface ChecklistSummary {
  completed: number
  total: number
  percentage: number
  next_item: ChecklistItem | null
}

export const onboardingApi = {
  // Onboarding
  getProgress: async (): Promise<OnboardingProgress> => {
    // ⚠️ EMERGENCY ROLLBACK 2026-04-26: повернений silent fallback з
    // `is_completed: true, is_dismissed: true`. PR-FE-2 видалив його
    // що заблокувало юзера на /onboarding/tutor (currentStep == null →
    // пустий екран). До правильного fix у view layer + auto-redirect
    // тригерів (TODO Phase 2) — повертаємо безпечну поведінку.
    try {
      const response = await apiClient.get<OnboardingProgress>('/v1/onboarding/progress/')
      return response
    } catch {
      return {
        onboarding_type: 'student',
        current_step: null,
        completed_steps: [],
        skipped_steps: [],
        is_completed: true,
        is_dismissed: true,
        progress_percentage: 100,
      }
    }
  },

  getSteps: async (): Promise<OnboardingStep[]> => {
    const response = await apiClient.get<OnboardingStep[]>('/v1/onboarding/steps/')
    return response
  },

  completeStep: async (slug: string): Promise<OnboardingProgress> => {
    const response = await apiClient.post<OnboardingProgress>(
      `/v1/onboarding/steps/${slug}/complete/`
    )
    return response
  },

  skipStep: async (slug: string): Promise<OnboardingProgress> => {
    const response = await apiClient.post<OnboardingProgress>(
      `/v1/onboarding/steps/${slug}/skip/`
    )
    return response
  },

  dismissOnboarding: async (): Promise<OnboardingProgress> => {
    const response = await apiClient.post<OnboardingProgress>('/v1/onboarding/dismiss/')
    return response
  },

  resetOnboarding: async (): Promise<OnboardingProgress> => {
    const response = await apiClient.post<OnboardingProgress>('/v1/onboarding/reset/')
    return response
  },

  // Checklist
  getChecklist: async (): Promise<ChecklistItem[]> => {
    const response = await apiClient.get<ChecklistItem[]>('/v1/checklist/')
    return response
  },

  getChecklistByCategory: async (category: string): Promise<ChecklistItem[]> => {
    const response = await apiClient.get<ChecklistItem[]>(`/v1/checklist/${category}/`)
    return response
  },

  syncChecklist: async (): Promise<ChecklistSummary> => {
    const response = await apiClient.post<ChecklistSummary>('/v1/checklist/sync/')
    return response
  },

  getCompletionPercentage: async (): Promise<{ percentage: number }> => {
    const response = await apiClient.get<{ percentage: number }>('/v1/checklist/percentage/')
    return response
  },
}
