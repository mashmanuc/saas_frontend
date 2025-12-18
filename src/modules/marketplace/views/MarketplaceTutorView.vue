<template>
  <div class="tutor-profile-page" v-if="tutor">
    <section class="profile-hero surface-card">
      <button class="ghost back-button" @click="goBack">← Назад до списку</button>
      <div class="hero-grid">
        <div class="avatar-wrapper">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="tutor.full_name" />
          <span v-else>{{ initials }}</span>
        </div>
        <div class="hero-meta">
          <div class="headline">
            <h1 class="headline-xl">{{ tutor.full_name }}</h1>
            <p class="text-muted">{{ tutor.headline || 'Спеціаліст з підготовки' }}</p>
          </div>
          <ul class="headline-stats">
            <li>
              <span class="label">Ставка</span>
              <strong>{{ tutor.hourly_rate ? `$${tutor.hourly_rate}/год` : 'Договірна' }}</strong>
            </li>
            <li>
              <span class="label">Досвід</span>
              <strong>{{ tutor.experience_years ? tutor.experience_years + ' років' : 'N/A' }}</strong>
            </li>
            <li>
              <span class="label">Мова</span>
              <strong>{{ tutor.language || 'uk' }}</strong>
            </li>
          </ul>
          <div class="hero-actions">
            <button class="btn-primary" :disabled="isRequesting" @click="requestTutor">
              Запитати тьютора
            </button>
            <button class="ghost" @click="saveTutor">
              Зберегти профіль
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="profile-sections">
      <article class="surface-card">
        <header class="section-header">
          <h2>Про тьютора</h2>
          <span class="badge-accent">Bio</span>
        </header>
        <p class="text-subtle">
          {{ tutor.about || 'Тьютор ще не заповнив біо. Поверніться пізніше.' }}
        </p>
      </article>

      <article class="surface-card">
        <header class="section-header">
          <h2>Предмети та фокус</h2>
          <span class="badge-accent">Subjects</span>
        </header>
        <div class="chips">
          <span v-for="subject in tutor.subjects" :key="subject">{{ subject }}</span>
          <span v-if="!tutor.subjects?.length" class="text-muted">Немає даних</span>
        </div>
      </article>

      <article class="surface-card two-column">
        <div>
          <header class="section-header">
            <h3>Сертифікати</h3>
          </header>
          <ul class="list">
            <li v-for="cert in tutor.certifications" :key="cert.id || cert">
              <strong>{{ cert.title || cert }}</strong>
              <small class="text-muted">{{ cert.issued_by || cert.year }}</small>
            </li>
            <li v-if="!tutor.certifications?.length" class="text-muted">Ще не додано сертифікатів</li>
          </ul>
        </div>
        <div>
          <header class="section-header">
            <h3>Доступність</h3>
          </header>
          <p>
            Часовий пояс: <strong>{{ tutor.timezone || 'Europe/Kyiv' }}</strong>
          </p>
          <p>
            Доступні мови інтерфейсу:
          </p>
          <div class="chips">
            <span v-for="lang in tutor.ui_languages" :key="lang">{{ lang }}</span>
            <span v-if="!tutor.ui_languages?.length" class="text-muted">Немає даних</span>
          </div>
        </div>
      </article>
    </section>
  </div>

  <div v-else class="tutor-profile-page surface-card loading-state">
    <span>Завантаження профілю...</span>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMarketplaceStore } from '../store/marketplaceStore'
import { telemetry } from '../../../services/telemetry'
import { resolveMediaUrl } from '../../../utils/media'
import apiClient from '../../../utils/apiClient'
import { notifyError, notifySuccess } from '../../../utils/notify'

const store = useMarketplaceStore()
const route = useRoute()
const router = useRouter()

const isRequesting = ref(false)

const tutor = computed(() => store.currentTutor)
const avatarUrl = computed(() => {
  const value = tutor.value?.avatar_url || tutor.value?.avatar
  return value ? resolveMediaUrl(value) : null
})
const initials = computed(() => {
  const name = tutor.value?.full_name || ''
  if (!name) return 'T'
  return name
    .split(' ')
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

async function bootTutorProfile(id) {
  if (!id) return
  try {
    const data = await store.loadTutor(id)
    telemetry.trigger('profile.viewed', { tutor_id: data?.id })
  } catch (error) {
    console.error('Failed to load tutor profile', error)
  }
}

function contactTutor() {
  telemetry.trigger('marketplace.click.cta', { tutor_id: tutor.value?.id, action: 'contact' })
}

async function requestTutor() {
  const tutorId = tutor.value?.id
  if (!tutorId) return

  isRequesting.value = true
  try {
    await apiClient.post('/student/request_tutor/', { tutor_id: tutorId })
    notifySuccess('Запит надіслано')
    telemetry.trigger('marketplace.request_tutor', { tutor_id: tutorId })
  } catch (e) {
    notifyError(e?.response?.data?.detail || 'Не вдалося надіслати запит')
  } finally {
    isRequesting.value = false
  }
}

function saveTutor() {
  telemetry.trigger('marketplace.click.cta', { tutor_id: tutor.value?.id, action: 'save' })
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'marketplace-list' })
  }
}

onMounted(() => {
  bootTutorProfile(route.params.id)
})

watch(
  () => route.params.id,
  (id) => {
    bootTutorProfile(id)
  },
)

onBeforeUnmount(() => {
  store.currentTutor = null
})
</script>

<style scoped>
.tutor-profile-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
}

.profile-hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.hero-grid {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: var(--space-lg);
  align-items: center;
}

.avatar-wrapper {
  width: 160px;
  height: 160px;
  border-radius: 32px;
  background: linear-gradient(145deg, rgba(99, 102, 241, 0.25), rgba(14, 165, 233, 0.25));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
}

.avatar-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.headline-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  list-style: none;
  padding: 0;
  margin: 0;
}

.headline-stats li .label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-subtle);
  letter-spacing: 0.08em;
}

.hero-actions {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.profile-sections {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-lg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.chips span {
  padding: var(--space-2xs) var(--space-sm);
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.9rem;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-lg);
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.ghost {
  background: transparent;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: var(--radius-md);
  padding: var(--space-xs) var(--space-sm);
  font-weight: 500;
  transition: background var(--transition-base);
}

.ghost:hover {
  background: rgba(99, 102, 241, 0.08);
}

.back-button {
  align-self: flex-start;
}

.loading-state {
  justify-content: center;
  align-items: center;
  min-height: 320px;
}

@media (max-width: 768px) {
  .tutor-profile-page {
    padding: var(--space-md);
  }

  .hero-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .avatar-wrapper {
    margin: 0 auto;
  }

  .hero-actions {
    justify-content: center;
  }
}
</style>

