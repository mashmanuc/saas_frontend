// F8: Onboarding API Client
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
    const response = await apiClient.get<OnboardingProgress>('/onboarding/progress/')
    return response
  },

  getSteps: async (): Promise<OnboardingStep[]> => {
    const response = await apiClient.get<OnboardingStep[]>('/onboarding/steps/')
    return response
  },

  completeStep: async (slug: string): Promise<OnboardingProgress> => {
    const response = await apiClient.post<OnboardingProgress>(
      `/onboarding/steps/${slug}/complete/`
    )
    return response
  },

  skipStep: async (slug: string): Promise<OnboardingProgress> => {
    const response = await apiClient.post<OnboardingProgress>(
      `/onboarding/steps/${slug}/skip/`
    )
    return response
  },

  dismissOnboarding: async (): Promise<OnboardingProgress> => {
    const response = await apiClient.post<OnboardingProgress>('/onboarding/dismiss/')
    return response
  },

  resetOnboarding: async (): Promise<OnboardingProgress> => {
    const response = await apiClient.post<OnboardingProgress>('/onboarding/reset/')
    return response
  },

  // Checklist
  getChecklist: async (): Promise<ChecklistItem[]> => {
    const response = await apiClient.get<ChecklistItem[]>('/checklist/')
    return response
  },

  getChecklistByCategory: async (category: string): Promise<ChecklistItem[]> => {
    const response = await apiClient.get<ChecklistItem[]>(`/checklist/${category}/`)
    return response
  },

  syncChecklist: async (): Promise<ChecklistSummary> => {
    const response = await apiClient.post<ChecklistSummary>('/checklist/sync/')
    return response
  },

  getCompletionPercentage: async (): Promise<{ percentage: number }> => {
    const response = await apiClient.get<{ percentage: number }>('/checklist/percentage/')
    return response
  },
}
