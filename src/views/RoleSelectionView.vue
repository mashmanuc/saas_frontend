<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'
import LandingTrigCircle from './LandingTrigCircle.vue'
import LandingNmt3d from './LandingNmt3d.vue'

const router = useRouter()
const { t, locale } = useI18n()

const studentCardRef = ref<HTMLElement | null>(null)
const tutorCardRef = ref<HTMLElement | null>(null)
const howItWorksRef = ref<HTMLElement | null>(null)
const benefitsRef = ref<HTMLElement | null>(null)
const showLanguageMenu = ref(false)

// Demo-відео для секції Replay. Поклади файл у frontend/public/demo/replay.mp4.
// Якщо файлу немає — показується placeholder з іконкою play.
const replayVideoUrl = '/demo/replay.mp4'
const showReplayVideo = ref(true)

const currentLanguage = computed(() => {
  const lang = languages.find(l => l.code === locale.value)
  return lang?.short ?? 'УКР'
})

const languages = [
  { code: 'uk', label: 'Українська', short: 'УКР' },
  { code: 'en', label: 'English', short: 'ENG' },
  { code: 'ru', label: 'Русский', short: 'РУС' }
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
      <div class="nav-logo">M4SH <span class="beta-badge">{{ t('roleSelection.betaBadge') }}</span></div>
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
      <!-- Hero — split layout -->
      <header class="header hero-split">
        <div class="hero-text">
          <p class="hero-eyebrow">{{ t('roleSelection.hero.eyebrow') }}</p>
          <h1 class="title">{{ t('roleSelection.hero.title') }}</h1>
          <p class="subtitle">{{ t('roleSelection.hero.subtitle') }}</p>
          <div class="hero-actions">
            <button class="hero-cta-primary" @click="selectTutor">
              {{ t('roleSelection.hero.ctaTutor') }}
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
            <button class="hero-cta-ghost" @click="scrollToHowItWorks">{{ t('roleSelection.hero.ctaMore') }}</button>
          </div>
          <p class="beta-notice">{{ t('roleSelection.betaNotice') }}</p>
        </div>
        <div class="hero-demo">
          <LandingTrigCircle />
          <p class="hero-demo-caption">{{ t('roleSelection.hero.trigCaption') }}</p>
        </div>
      </header>

      <!-- Live Tools Demo — NMT3D Pyramid -->
      <section class="info-section live-tools-section">
        <div class="live-tools-grid">
          <div class="live-tools-demo">
            <LandingNmt3d />
            <p class="live-tools-caption">{{ t('roleSelection.liveTools.pyramidCaption') }}</p>
          </div>
          <div class="live-tools-text">
            <p class="hero-eyebrow">{{ t('roleSelection.liveTools.eyebrow') }}</p>
            <h2 class="live-tools-title">{{ t('roleSelection.liveTools.title') }}</h2>
            <p class="live-tools-body">{{ t('roleSelection.liveTools.body') }}</p>
          </div>
        </div>
      </section>

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
              <!-- Play circle зі стрілкою-перемоткою (replay) -->
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9"></path>
                <polyline points="3 5 3 12 10 12"></polyline>
                <polygon points="10 9 16 12 10 15 10 9" fill="currentColor" stroke="none"></polygon>
              </svg>
            </div>
            <h3 class="benefit-title">{{ t('roleSelection.benefits.noMiddlemen.title') }}</h3>
            <p class="benefit-description">{{ t('roleSelection.benefits.noMiddlemen.description') }}</p>
          </div>

          <div class="benefit-card">
            <div class="benefit-icon">
              <!-- Дошка + перо (whiteboard) -->
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="14" rx="2"></rect>
                <path d="M7 21h10"></path>
                <path d="M12 17v4"></path>
                <path d="M7 11l3 3 7-7"></path>
              </svg>
            </div>
            <h3 class="benefit-title">{{ t('roleSelection.benefits.affordablePrices.title') }}</h3>
            <p class="benefit-description">{{ t('roleSelection.benefits.affordablePrices.description') }}</p>
          </div>

          <div class="benefit-card">
            <div class="benefit-icon">
              <!-- Школа + персона (dual-audience) -->
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21V10l6-4 6 4v11"></path>
                <path d="M9 21v-6h3v6"></path>
                <circle cx="18" cy="10" r="3"></circle>
                <path d="M15 21v-2a3 3 0 0 1 6 0v2"></path>
              </svg>
            </div>
            <h3 class="benefit-title">{{ t('roleSelection.benefits.directConnection.title') }}</h3>
            <p class="benefit-description">{{ t('roleSelection.benefits.directConnection.description') }}</p>
          </div>
        </div>
      </section>

      <!-- Replay Demo Section -->
      <section class="info-section replay-demo-section">
        <div class="demo-grid">
          <div class="demo-text">
            <h2 class="section-title demo-title">{{ t('roleSelection.replayDemo.title') }}</h2>
            <p class="demo-description">{{ t('roleSelection.replayDemo.description') }}</p>
          </div>
          <div class="demo-visual">
            <div class="demo-frame" :aria-label="t('roleSelection.replayDemo.videoLabel')">
              <video
                v-show="showReplayVideo"
                class="demo-video"
                :src="replayVideoUrl"
                autoplay
                muted
                loop
                playsinline
                preload="metadata"
                @error="showReplayVideo = false"
              ></video>
              <div v-if="!showReplayVideo" class="demo-placeholder" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span class="demo-placeholder-label">{{ t('roleSelection.replayDemo.videoLabel') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Winterboard Features Section — 6 реальних фішок з маніфесту -->
      <section class="info-section board-features-section">
        <h2 class="section-title">{{ t('roleSelection.boardDemo.title') }}</h2>
        <p class="section-subtitle">{{ t('roleSelection.boardDemo.description') }}</p>

        <div class="board-features-grid">
          <!-- PDF / PPTX / DOCX -->
          <div class="feature-tile">
            <div class="feature-tile-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <path d="M10 13l3 3 3-3"></path>
                <line x1="13" y1="12" x2="13" y2="18"></line>
              </svg>
            </div>
            <h3 class="feature-tile-title">{{ t('roleSelection.boardDemo.features.pdfPptx.title') }}</h3>
            <p class="feature-tile-text">{{ t('roleSelection.boardDemo.features.pdfPptx.text') }}</p>
          </div>

          <!-- YouTube -->
          <div class="feature-tile">
            <div class="feature-tile-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="3"></rect>
                <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"></polygon>
              </svg>
            </div>
            <h3 class="feature-tile-title">{{ t('roleSelection.boardDemo.features.youtube.title') }}</h3>
            <p class="feature-tile-text">{{ t('roleSelection.boardDemo.features.youtube.text') }}</p>
          </div>

          <!-- Audio/Video plеєри -->
          <div class="feature-tile">
            <div class="feature-tile-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
              </svg>
            </div>
            <h3 class="feature-tile-title">{{ t('roleSelection.boardDemo.features.media.title') }}</h3>
            <p class="feature-tile-text">{{ t('roleSelection.boardDemo.features.media.text') }}</p>
          </div>

          <!-- Voice annotation -->
          <div class="feature-tile">
            <div class="feature-tile-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </div>
            <h3 class="feature-tile-title">{{ t('roleSelection.boardDemo.features.voiceAnnotation.title') }}</h3>
            <p class="feature-tile-text">{{ t('roleSelection.boardDemo.features.voiceAnnotation.text') }}</p>
          </div>

          <!-- Version pinning -->
          <div class="feature-tile">
            <div class="feature-tile-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <h3 class="feature-tile-title">{{ t('roleSelection.boardDemo.features.versionPinning.title') }}</h3>
            <p class="feature-tile-text">{{ t('roleSelection.boardDemo.features.versionPinning.text') }}</p>
          </div>

          <!-- Lifetime access -->
          <div class="feature-tile">
            <div class="feature-tile-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <path d="M3 10h18"></path>
                <path d="M8 2v4"></path>
                <path d="M16 2v4"></path>
                <path d="M9 15l2 2 4-4"></path>
              </svg>
            </div>
            <h3 class="feature-tile-title">{{ t('roleSelection.boardDemo.features.lifetimeAccess.title') }}</h3>
            <p class="feature-tile-text">{{ t('roleSelection.boardDemo.features.lifetimeAccess.text') }}</p>
          </div>
        </div>
      </section>
    </div>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="landing-footer-inner">
        <span class="landing-footer-copy">© {{ new Date().getFullYear() }} M4SH</span>
        <div class="landing-footer-links">
          <router-link to="/legal/terms">{{ t('footer.legal.terms') }}</router-link>
          <router-link to="/legal/privacy">{{ t('footer.legal.privacy') }}</router-link>
          <router-link to="/legal/refund">{{ t('footer.legal.refund') }}</router-link>
          <a href="mailto:support@m4sh.org">support@m4sh.org</a>
        </div>
      </div>
    </footer>
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.beta-badge {
  font-size: 0.65rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border-radius: 4px;
  padding: 2px 7px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  vertical-align: middle;
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
  margin-bottom: 3rem;
  padding-top: 2rem;
}

/* ── Hero split layout ── */
.hero-split {
  display: grid;
  grid-template-columns: 2fr 3fr;  /* demo >= 600px при container >= 1100px */
  gap: 3rem;
  align-items: center;
  min-height: calc(100vh - 9rem);
  padding-bottom: 3rem;
}

.hero-text {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.hero-eyebrow {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0;
}

.title {
  font-family: 'Space Grotesk', var(--font-sans);
  font-size: clamp(2.5rem, 4.5vw, 3.75rem);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.1;
  letter-spacing: -0.02em;
  white-space: pre-line;
}

.subtitle {
  font-size: 1.1rem;
  color: var(--text-secondary);
  margin: 0;
  font-weight: 400;
  line-height: 1.65;
  max-width: 420px;
}

.beta-notice {
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 500;
  opacity: 0.75;
  margin: 0;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.hero-cta-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--accent);
  color: var(--accent-contrast);
  border: none;
  border-radius: 0.75rem;
  padding: 0.875rem 1.75rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 16px rgba(5,150,105,0.35);
}

.hero-cta-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(5,150,105,0.45);
}

.hero-cta-primary svg {
  transition: transform 0.2s ease;
}

.hero-cta-primary:hover svg {
  transform: translateX(3px);
}

.hero-cta-ghost {
  background: none;
  border: 1.5px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.hero-cta-ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.hero-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.hero-demo-caption {
  font-size: 0.82rem;
  color: var(--text-secondary);
  opacity: 0.65;
  text-align: center;
  margin: 0;
}

/* Responsive: stack on tablet/mobile (< 1100px щоб demo завжди >= 600px) */
@media (max-width: 1100px) {
  .hero-split {
    grid-template-columns: 1fr;
    min-height: auto;
    gap: 2.5rem;
    padding-bottom: 2rem;
  }

  .hero-demo {
    order: -1;  /* demo зверху, текст знизу — відвідувач бачить інтерактив першим */
  }

  .title {
    font-size: clamp(2rem, 7vw, 2.75rem);
  }

  .subtitle {
    max-width: 100%;
  }
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

/* Live Tools Section */
.live-tools-section {
  text-align: left;
  margin-top: 5rem;
}

.live-tools-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
}

.live-tools-demo {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.live-tools-caption {
  font-size: 0.82rem;
  color: var(--text-secondary);
  opacity: 0.65;
  text-align: center;
  margin: 0;
}

.live-tools-text {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.live-tools-title {
  font-family: 'Space Grotesk', var(--font-sans);
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.live-tools-body {
  font-size: 1.1rem;
  color: var(--text-secondary);
  line-height: 1.65;
  margin: 0;
}

@media (max-width: 900px) {
  .live-tools-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .live-tools-section {
    text-align: center;
  }

  .live-tools-text {
    align-items: center;
  }

  .live-tools-body {
    max-width: 520px;
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

/* Replay Demo Section */
.replay-demo-section {
  margin-top: 6rem;
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
}

.demo-text {
  text-align: left;
}

.demo-title {
  font-size: 2.25rem;
  margin: 0 0 1rem 0;
  text-align: left;
}

.demo-description {
  font-size: 1.125rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  text-align: left;
}

.demo-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 1rem;
  overflow: hidden;
  background: var(--card-bg);
  box-shadow: 0 12px 24px var(--shadow-strong);
  border: 1px solid var(--border-color);
}

.demo-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.demo-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, var(--bg-secondary), var(--card-bg));
  color: var(--text-secondary);
}

.demo-placeholder-label {
  font-size: 0.95rem;
  font-weight: 500;
  opacity: 0.75;
}

/* Board features grid (6 реальних фішок) */
.board-features-section {
  margin-top: 6rem;
}

.board-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-top: 3rem;
  max-width: 1100px;
  margin-left: auto;
  margin-right: auto;
}

.feature-tile {
  background: var(--card-bg);
  border-radius: 1rem;
  padding: 1.75rem 1.5rem;
  box-shadow: 0 4px 6px var(--shadow);
  text-align: left;
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.feature-tile:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: 0 8px 16px var(--shadow-strong);
}

.feature-tile-icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, var(--accent), var(--info-bg));
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-bottom: 1rem;
}

.feature-tile-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
}

.feature-tile-text {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.5;
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

  .demo-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .demo-title {
    font-size: 1.75rem;
    text-align: center;
  }

  .demo-description {
    text-align: center;
  }

  .board-features-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .board-features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Dark theme adjustments */
[data-theme="dark"] .nav-header {
  background: rgba(10, 25, 41, 0.95);
}

[data-theme="dark"] .role-card,
[data-theme="dark"] .step-card,
[data-theme="dark"] .benefit-card,
[data-theme="dark"] .feature-tile {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

[data-theme="dark"] .role-card:hover,
[data-theme="dark"] .step-card:hover,
[data-theme="dark"] .benefit-card:hover,
[data-theme="dark"] .feature-tile:hover {
  background: rgba(255, 255, 255, 0.08);
}

.landing-footer {
  border-top: 1px solid var(--border-color, rgba(0,0,0,0.1));
  padding: 1.5rem 2rem;
  margin-top: 2rem;
}

.landing-footer-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.landing-footer-copy {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.landing-footer-links {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.landing-footer-links a {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.landing-footer-links a:hover {
  color: var(--accent);
}
</style>
