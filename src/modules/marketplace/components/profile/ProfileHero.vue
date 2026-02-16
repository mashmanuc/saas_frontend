<script setup lang="ts">
import { MapPin, Clock, User, GraduationCap, ArrowLeft, Play, Calendar as CalendarIcon, MessageCircle, Send, Shield, Phone } from 'lucide-vue-next'
import type { TutorProfileFull } from '../../api/marketplace'
import { resolveMediaUrl } from '@/utils/media'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'

interface Props {
  profile: TutorProfileFull
}

const props = defineProps<Props>()
const { t } = useI18n()
const auth = useAuthStore()

const isAuthenticated = computed(() => auth.isAuthenticated)
const isStudent = computed(() => auth.isAuthenticated && auth.userRole === 'student')

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'inquiry'): void
  (e: 'login-required'): void
  (e: 'scroll-calendar'): void
  (e: 'ask-question'): void
}>()

const avatarUrl = computed(() => {
  const value = props.profile?.media?.photo_url || ''
  return value ? resolveMediaUrl(value) : ''
})

const fullName = computed(() => {
  return props.profile?.user_name || props.profile?.display_name || props.profile?.slug || t('common.notSpecified')
})

const avatarInitials = computed(() => {
  const name = props.profile?.user_name || props.profile?.slug || ''
  if (!name) return 'T'
  const parts = name.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.charAt(0).toUpperCase()
})

const headlineText = computed(() => {
  const raw = props.profile?.headline
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : ''
})

const locationText = computed(() => {
  const cityName = props.profile?.city_name_uk
  if (cityName) return cityName
  const country = props.profile?.country
  return typeof country === 'string' && country.trim().length > 0 ? country : null
})

const experienceYears = computed(() => {
  const n = Number(props.profile?.experience_years)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const genderAgeText = computed(() => {
  const parts: string[] = []
  const g = props.profile?.gender
  if (g) {
    const map: Record<string, string> = {
      'male': t('marketplace.profile.gender.male'),
      'female': t('marketplace.profile.gender.female'),
      'other': t('marketplace.profile.gender.other'),
    }
    parts.push(map[g.toLowerCase()] || g)
  }
  const year = props.profile?.birth_year
  if (year) {
    const age = new Date().getFullYear() - year
    if (age > 0 && age < 120) parts.push(t('marketplace.profile.age', { age }))
  }
  return parts.length > 0 ? parts.join(' · ') : null
})

const responseTimeText = computed(() => {
  const hours = props.profile?.stats?.response_time_hours
  if (typeof hours === 'number' && hours > 0) {
    return t('marketplace.profileV3.hero.respondsIn', { hours })
  }
  return null
})

const valueProp = computed(() => {
  const parts: string[] = []
  if (experienceYears.value > 0) {
    parts.push(t('marketplace.profileV3.hero.expYears', { n: experienceYears.value }))
  }
  if (headlineText.value) {
    parts.push(headlineText.value)
  }
  return parts.join(' · ') || headlineText.value || null
})

const hourlyRate = computed(() => {
  return props.profile?.pricing?.hourly_rate || 0
})

const currency = computed(() => {
  return props.profile?.pricing?.currency || 'UAH'
})

const hasCertifications = computed(() => !!props.profile?.has_certifications)

const isNewTutor = computed(() => {
  const reviews = props.profile?.stats?.total_reviews || 0
  const lessons = props.profile?.stats?.total_lessons || 0
  return reviews === 0 && lessons < 5
})

function handlePrimaryCta() {
  if (!isAuthenticated.value) {
    emit('login-required')
  } else {
    emit('inquiry')
  }
}

function handleSecondaryCta() {
  if (!isAuthenticated.value) {
    emit('login-required')
  } else {
    emit('inquiry')
  }
}
</script>

<template>
  <div class="hero-section">
    <button class="back-btn" @click="emit('back')">
      <ArrowLeft :size="16" />
      {{ t('marketplace.profile.backToCatalog') }}
    </button>

    <div class="hero">
      <!-- Avatar -->
      <div class="avatar-wrap">
        <div v-if="avatarUrl" class="avatar-main avatar-img">
          <img :src="avatarUrl" :alt="fullName" />
        </div>
        <div v-else class="avatar-main">{{ avatarInitials }}</div>
        <div class="online-dot" />
      </div>

      <!-- Info -->
      <div class="hero-info">
        <h1 class="hero-name">{{ fullName }}</h1>
        <p v-if="headlineText" class="hero-sub">{{ headlineText }}</p>

        <!-- Value Proposition -->
        <div v-if="valueProp" class="value-prop">
          {{ valueProp }}
        </div>

        <div class="hero-meta">
          <span v-if="locationText" class="meta-chip">
            <MapPin :size="14" />
            {{ locationText }}
          </span>
          <span v-if="experienceYears > 0" class="meta-chip">
            <GraduationCap :size="14" />
            {{ t('marketplace.profileV3.hero.experience', { n: experienceYears }) }}
          </span>
          <span v-if="genderAgeText" class="meta-chip">
            <User :size="14" />
            {{ genderAgeText }}
          </span>
          <span v-if="responseTimeText" class="meta-chip">
            <Clock :size="14" />
            {{ responseTimeText }}
          </span>
        </div>

        <!-- Trust chips -->
        <div class="trust-row">
          <span v-if="hasCertifications" class="trust-chip platform">
            <Shield :size="12" />
            {{ t('marketplace.profileV3.hero.verified') }}
          </span>
          <span class="trust-chip">
            <Phone :size="12" />
            {{ t('marketplace.profileV3.hero.contactsChecked') }}
          </span>
        </div>
      </div>

      <!-- CTA Block -->
      <div class="cta-block">
        <div class="price-row">
          <span class="price-big">{{ hourlyRate }} {{ currency === 'UAH' ? t('marketplace.profileV3.cta.uah') : currency }}</span>
          <span class="price-per">/{{ t('marketplace.profileV3.cta.hour') }}</span>
        </div>

        <div class="process">
          <div class="proc-row">
            <span class="proc-n">1</span>
            {{ t('marketplace.profileV3.cta.step1') }}
          </div>
          <div class="proc-row">
            <span class="proc-n">2</span>
            {{ t('marketplace.profileV3.cta.step2') }}
          </div>
          <div class="proc-row">
            <span class="proc-n">3</span>
            {{ t('marketplace.profileV3.cta.step3') }}
          </div>
        </div>

        <button class="btn-primary-cta" @click="handlePrimaryCta">
          <CalendarIcon :size="16" />
          {{ t('marketplace.profileV3.cta.bookLesson') }}
        </button>

        <button class="btn-ghost-cta" @click="handleSecondaryCta">
          <MessageCircle :size="16" />
          {{ t('marketplace.profileV3.cta.askFirst') }}
        </button>

        <p class="free-note">
          {{ t('marketplace.profileV3.cta.freeNote') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-section {
  max-width: 1060px;
  margin: 0 auto;
  padding: 0 1rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 1rem;
  transition: all 0.15s;
}
.back-btn:hover {
  background: var(--surface-card);
  color: var(--accent);
}

/* ─── HERO ─── */
.hero {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm, 0 1px 8px rgba(0,0,0,0.06));
  padding: 2rem 2.25rem;
  margin-bottom: 1.25rem;
  display: grid;
  grid-template-columns: auto 1fr 260px;
  gap: 1.5rem;
  align-items: start;
  animation: fadeUp 0.35s ease 0.05s both;
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .avatar-wrap { margin: 0 auto; }
  .hero-meta { justify-content: center; }
  .trust-row { justify-content: center; }
}

/* Avatar */
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.avatar-main {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.625rem;
  font-weight: 800;
  color: var(--accent);
  border: 2.5px solid color-mix(in srgb, var(--accent) 30%, transparent);
}
.avatar-img {
  padding: 0;
  overflow: hidden;
}
.avatar-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.online-dot {
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--surface-card);
  animation: pulse 2.5s infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 40%, transparent); }
  50% { box-shadow: 0 0 0 5px transparent; }
}

/* Info */
.hero-name {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.2rem;
  line-height: 1.2;
}
.hero-sub {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin: 0 0 0.875rem;
}

/* Value Proposition */
.value-prop {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 0.875rem;
  padding-left: 0.875rem;
  border-left: 3px solid var(--accent);
}

/* Meta */
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.875rem;
}
.meta-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Trust */
.trust-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.trust-chip {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 0.25rem 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.trust-chip.platform {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
}

/* ─── CTA BLOCK ─── */
.cta-block {
  background: var(--surface-card);
  border: 1.5px solid var(--border-color);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  margin-bottom: 0.125rem;
}
.price-big {
  font-size: 1.75rem;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: -1px;
}
.price-per {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 600;
}

/* Process steps */
.process {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}
.proc-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.proc-n {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-size: 0.5625rem;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Primary CTA */
.btn-primary-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: var(--accent);
  color: var(--accent-contrast, #fff);
  border: none;
  border-radius: 11px;
  padding: 0.8125rem 1.125rem;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  width: 100%;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  font-family: inherit;
  box-shadow: 0 3px 12px color-mix(in srgb, var(--accent) 30%, transparent);
}
.btn-primary-cta:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 5px 20px color-mix(in srgb, var(--accent) 40%, transparent);
}

/* Ghost CTA */
.btn-ghost-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 11px;
  padding: 0.625rem 1.125rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: all 0.15s;
  font-family: inherit;
}
.btn-ghost-cta:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.free-note {
  text-align: center;
  font-size: 0.6875rem;
  color: var(--text-secondary);
  font-weight: 600;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
