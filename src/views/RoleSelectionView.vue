<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

const router = useRouter()
const { t, locale } = useI18n()

const studentCardRef = ref<HTMLElement | null>(null)
const tutorCardRef = ref<HTMLElement | null>(null)
const howItWorksRef = ref<HTMLElement | null>(null)
const benefitsRef = ref<HTMLElement | null>(null)
const showLanguageMenu = ref(false)

const currentLanguage = computed(() => {
  return locale.value === 'uk' ? 'УКР' : 'ENG'
})

const languages = [
  { code: 'uk', label: 'Українська', short: 'УКР' },
  { code: 'en', label: 'English', short: 'ENG' }
]

onMounted(() => {
  // Trigger animations on mount
  setTimeout(() => {
    studentCardRef.value?.classList.add('animate-in')
    tutorCardRef.value?.classList.add('animate-in')
  }, 100)
})

function selectStudent() {
  router.push('/auth/register/student')
}

function selectTutor() {
  router.push('/auth/register/tutor')
}

function scrollToHowItWorks() {
  howItWorksRef.value?.scrollIntoView({ behavior: 'smooth' })
}

function scrollToBenefits() {
  benefitsRef.value?.scrollIntoView({ behavior: 'smooth' })
}

function goToLogin() {
  router.push('/auth/login')
}

function toggleLanguageMenu() {
  showLanguageMenu.value = !showLanguageMenu.value
}

async function changeLanguage(langCode: string) {
  await setLocale(langCode)
  showLanguageMenu.value = false
}
</script>

<template>
  <div class="role-selection-container">
    <!-- Animated background shapes -->
    <div class="bg-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
      <div class="shape shape-4"></div>
      <div class="shape shape-5"></div>
    </div>

    <!-- Navigation Header -->
    <nav class="nav-header">
      <div class="nav-logo">M4SH</div>
      <div class="nav-links">
        <button @click="scrollToHowItWorks" class="nav-link">{{ t('roleSelection.nav.howItWorks') }}</button>
        <button @click="scrollToBenefits" class="nav-link">{{ t('roleSelection.nav.benefits') }}</button>
        
        <!-- Language Switcher -->
        <div class="language-switcher">
          <button @click="toggleLanguageMenu" class="nav-link language-btn" :aria-label="t('common.changeLanguage')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>{{ currentLanguage }}</span>
          </button>
          <div v-if="showLanguageMenu" class="language-dropdown">
            <button 
              v-for="lang in languages" 
              :key="lang.code"
              @click="changeLanguage(lang.code)"
              class="language-option"
              :class="{ active: locale === lang.code }"
            >
              <span class="lang-label">{{ lang.label }}</span>
              <span v-if="locale === lang.code" class="check-icon">✓</span>
            </button>
          </div>
        </div>
        
        <button @click="goToLogin" class="nav-link nav-link-login">{{ t('roleSelection.nav.login') }}</button>
      </div>
    </nav>

    <div class="content-wrapper">
      <header class="header">
        <h1 class="title">{{ t('roleSelection.title') }}</h1>
        <p class="subtitle">{{ t('roleSelection.subtitle') }}</p>
      </header>

      <div class="cards-container">
        <!-- Student Card -->
        <div 
          ref="studentCardRef"
          class="role-card student-card"
          @click="selectStudent"
          data-test="role-select-student"
        >
          <div class="card-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </div>
          <h2 class="card-title">{{ t('roleSelection.student.title') }}</h2>
          <p class="card-description">{{ t('roleSelection.student.description') }}</p>
          <div class="card-features">
            <div class="feature">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ t('roleSelection.student.feature1') }}</span>
            </div>
            <div class="feature">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ t('roleSelection.student.feature2') }}</span>
            </div>
            <div class="feature">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ t('roleSelection.student.feature3') }}</span>
            </div>
          </div>
          <button class="card-button">
            {{ t('roleSelection.student.cta') }}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>

        <!-- Tutor Card -->
        <div 
          ref="tutorCardRef"
          class="role-card tutor-card"
          @click="selectTutor"
          data-test="role-select-tutor"
        >
          <div class="card-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h2 class="card-title">{{ t('roleSelection.tutor.title') }}</h2>
          <p class="card-description">{{ t('roleSelection.tutor.description') }}</p>
          <div class="card-features">
            <div class="feature">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ t('roleSelection.tutor.feature1') }}</span>
            </div>
            <div class="feature">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ t('roleSelection.tutor.feature2') }}</span>
            </div>
            <div class="feature">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ t('roleSelection.tutor.feature3') }}</span>
            </div>
          </div>
          <button class="card-button">
            {{ t('roleSelection.tutor.cta') }}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <!-- How It Works Section -->
      <section ref="howItWorksRef" class="info-section how-it-works">
        <h2 class="section-title">{{ t('roleSelection.howItWorks.title') }}</h2>
        <p class="section-subtitle">{{ t('roleSelection.howItWorks.subtitle') }}</p>
        
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">1</div>
            <h3 class="step-title">{{ t('roleSelection.howItWorks.step1.title') }}</h3>
            <p class="step-description">{{ t('roleSelection.howItWorks.step1.description') }}</p>
          </div>
          
          <div class="step-card">
            <div class="step-number">2</div>
            <h3 class="step-title">{{ t('roleSelection.howItWorks.step2.title') }}</h3>
            <p class="step-description">{{ t('roleSelection.howItWorks.step2.description') }}</p>
          </div>
          
          <div class="step-card">
            <div class="step-number">3</div>
            <h3 class="step-title">{{ t('roleSelection.howItWorks.step3.title') }}</h3>
            <p class="step-description">{{ t('roleSelection.howItWorks.step3.description') }}</p>
          </div>
        </div>
      </section>

      <!-- Benefits Section -->
      <section ref="benefitsRef" class="info-section benefits">
        <h2 class="section-title">{{ t('roleSelection.benefits.title') }}</h2>
        <p class="section-subtitle">{{ t('roleSelection.benefits.subtitle') }}</p>
        
        <div class="benefits-grid">
          <div class="benefit-card">
            <div class="benefit-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 class="benefit-title">{{ t('roleSelection.benefits.noMiddlemen.title') }}</h3>
            <p class="benefit-description">{{ t('roleSelection.benefits.noMiddlemen.description') }}</p>
          </div>
          
          <div class="benefit-card">
            <div class="benefit-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <h3 class="benefit-title">{{ t('roleSelection.benefits.affordablePrices.title') }}</h3>
            <p class="benefit-description">{{ t('roleSelection.benefits.affordablePrices.description') }}</p>
          </div>
          
          <div class="benefit-card">
            <div class="benefit-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <h3 class="benefit-title">{{ t('roleSelection.benefits.directConnection.title') }}</h3>
            <p class="benefit-description">{{ t('roleSelection.benefits.directConnection.description') }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.role-selection-container {
  min-height: 100vh;
  background: var(--bg-gradient);
  position: relative;
  overflow-x: hidden;
}

/* Navigation Header */
.nav-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.nav-logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.5px;
}

.nav-links {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.nav-link {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.3s ease;
  padding: 0.5rem 0;
}

.nav-link:hover {
  color: var(--accent);
}

.nav-link-login {
  background: var(--accent);
  color: var(--accent-contrast);
  padding: 0.5rem 1.5rem;
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.nav-link-login:hover {
  background: var(--accent-hover);
  color: var(--accent-contrast);
  transform: translateY(-2px);
}

/* Language Switcher */
.language-switcher {
  position: relative;
}

.language-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem !important;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

.language-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent);
}

.language-btn svg {
  width: 18px;
  height: 18px;
}

.language-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px var(--shadow);
  min-width: 160px;
  overflow: hidden;
  z-index: 1000;
}

.language-option {
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.language-option:hover {
  background: var(--bg-secondary);
}

.language-option.active {
  background: var(--bg-secondary);
  color: var(--accent);
  font-weight: 600;
}

.lang-label {
  flex: 1;
}

.check-icon {
  color: var(--accent);
  font-weight: 700;
  margin-left: 0.5rem;
}

/* Animated background shapes */
.bg-shapes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.shape {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
  animation: float 20s infinite ease-in-out;
}

.shape-1 {
  width: 300px;
  height: 300px;
  background: var(--accent);
  top: -150px;
  left: -150px;
  animation-delay: 0s;
}

.shape-2 {
  width: 200px;
  height: 200px;
  background: var(--info-bg);
  top: 20%;
  right: -100px;
  animation-delay: 2s;
  animation-duration: 25s;
}

.shape-3 {
  width: 150px;
  height: 150px;
  background: var(--success-bg);
  bottom: 10%;
  left: 10%;
  animation-delay: 4s;
  animation-duration: 30s;
}

.shape-4 {
  width: 250px;
  height: 250px;
  background: var(--accent);
  bottom: -125px;
  right: 15%;
  animation-delay: 1s;
  animation-duration: 22s;
}

.shape-5 {
  width: 180px;
  height: 180px;
  background: var(--info-bg);
  top: 50%;
  left: -90px;
  animation-delay: 3s;
  animation-duration: 28s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(30px, -30px) rotate(90deg);
  }
  50% {
    transform: translate(-20px, 20px) rotate(180deg);
  }
  75% {
    transform: translate(40px, 10px) rotate(270deg);
  }
}

.content-wrapper {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 6rem 2rem 4rem;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
  padding-top: 2rem;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
  line-height: 1.2;
}

.subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin: 0;
  font-weight: 400;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.role-card {
  background: var(--card-bg);
  border-radius: 1.5rem;
  padding: 2.5rem;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 6px var(--shadow);
  border: 2px solid transparent;
  opacity: 0;
  transform: translateY(30px);
  position: relative;
  overflow: hidden;
}

.role-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--accent), var(--info-bg));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.role-card.animate-in {
  opacity: 1;
  transform: translateY(0);
}

.student-card.animate-in {
  animation: slideInLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.tutor-card.animate-in {
  animation: slideInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-50px) translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0) translateY(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(50px) translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0) translateY(0);
  }
}

.role-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px var(--shadow-strong);
  border-color: var(--accent);
}

.role-card:hover::before {
  transform: scaleX(1);
}

.card-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--accent), var(--info-bg));
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  color: white;
  transition: transform 0.3s ease;
}

.role-card:hover .card-icon {
  transform: scale(1.1) rotate(5deg);
}

.card-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.75rem 0;
}

.card-description {
  font-size: 1rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
}

.card-features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.feature svg {
  color: var(--accent);
  flex-shrink: 0;
}

.card-button {
  width: 100%;
  padding: 1rem 1.5rem;
  background: var(--accent);
  color: var(--accent-contrast);
  border: none;
  border-radius: 0.75rem;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.card-button:hover {
  background: var(--accent-hover);
  transform: translateX(4px);
}

.card-button svg {
  transition: transform 0.3s ease;
}

.card-button:hover svg {
  transform: translateX(4px);
}

/* Responsive */
@media (max-width: 768px) {
  .title {
    font-size: 2rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .cards-container {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .role-card {
    padding: 2rem;
  }

  .card-icon {
    width: 64px;
    height: 64px;
  }

  .card-icon svg {
    width: 48px;
    height: 48px;
  }
}

/* Info Sections */
.info-section {
  margin-top: 6rem;
  text-align: center;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.section-subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin: 0 0 3rem 0;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

/* How It Works */
.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.step-card {
  background: var(--card-bg);
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px var(--shadow);
  transition: transform 0.3s ease;
}

.step-card:hover {
  transform: translateY(-4px);
}

.step-number {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--accent), var(--info-bg));
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 auto 1.5rem;
}

.step-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem 0;
}

.step-description {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* Benefits */
.benefits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.benefit-card {
  background: var(--card-bg);
  border-radius: 1rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 4px 6px var(--shadow);
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.benefit-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: 0 8px 16px var(--shadow-strong);
}

.benefit-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--accent), var(--info-bg));
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  color: white;
}

.benefit-title {
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.benefit-description {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .nav-header {
    padding: 1rem;
  }

  .nav-links {
    gap: 1rem;
  }

  .nav-link {
    font-size: 0.875rem;
  }

  .language-btn {
    padding: 0.5rem 0.75rem !important;
  }

  .language-btn span {
    display: none;
  }

  .language-dropdown {
    right: auto;
    left: 0;
  }

  .content-wrapper {
    padding: 5rem 1rem 2rem;
  }

  .section-title {
    font-size: 1.75rem;
  }

  .section-subtitle {
    font-size: 1rem;
  }

  .steps-grid,
  .benefits-grid {
    grid-template-columns: 1fr;
  }
}

/* Dark theme adjustments */
[data-theme="dark"] .nav-header {
  background: rgba(10, 25, 41, 0.95);
}

[data-theme="dark"] .role-card,
[data-theme="dark"] .step-card,
[data-theme="dark"] .benefit-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

[data-theme="dark"] .role-card:hover,
[data-theme="dark"] .step-card:hover,
[data-theme="dark"] .benefit-card:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
