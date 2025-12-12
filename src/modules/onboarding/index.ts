// Onboarding Module Index

// API
export * from './api/onboarding'

// Stores
export { useOnboardingStore } from './stores/onboardingStore'
export { useChecklistStore } from './stores/checklistStore'

// Views
export { default as OnboardingView } from './views/OnboardingView.vue'
export { default as StudentOnboardingView } from './views/StudentOnboardingView.vue'
export { default as TutorOnboardingView } from './views/TutorOnboardingView.vue'
export { default as ChecklistView } from './views/ChecklistView.vue'

// Step Components
export { default as OnboardingStep } from './components/steps/OnboardingStep.vue'
export { default as WelcomeStep } from './components/steps/WelcomeStep.vue'
export { default as ProfileStep } from './components/steps/ProfileStep.vue'
export { default as PreferencesStep } from './components/steps/PreferencesStep.vue'
export { default as FirstActionStep } from './components/steps/FirstActionStep.vue'
export { default as CompletionStep } from './components/steps/CompletionStep.vue'

// Progress Components
export { default as OnboardingProgress } from './components/progress/OnboardingProgress.vue'
export { default as StepIndicator } from './components/progress/StepIndicator.vue'
export { default as ProgressBar } from './components/progress/ProgressBar.vue'

// Checklist Components
export { default as ChecklistPanel } from './components/checklist/ChecklistPanel.vue'
export { default as ChecklistItem } from './components/checklist/ChecklistItem.vue'
export { default as ChecklistCategory } from './components/checklist/ChecklistCategory.vue'
export { default as CompletionBadge } from './components/checklist/CompletionBadge.vue'

// Widget Components
export { default as OnboardingTooltip } from './components/widgets/OnboardingTooltip.vue'
export { default as OnboardingModal } from './components/widgets/OnboardingModal.vue'
export { default as WelcomeBanner } from './components/widgets/WelcomeBanner.vue'

// Composables
export { useOnboarding } from './composables/useOnboarding'
export { useChecklist } from './composables/useChecklist'
