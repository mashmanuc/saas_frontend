<template>
  <article class="tutor-card" @click="$emit('click')">
    <header class="tutor-card__header">
      <div class="tutor-card__avatar">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          :alt="tutorName"
          loading="lazy"
        />
        <span v-else>{{ initials }}</span>
      </div>
      <div>
        <h3 class="tutor-card__name">{{ tutorName }}</h3>
        <p class="tutor-card__headline">{{ tutorHeadline }}</p>
      </div>
    </header>

    <section class="tutor-card__subjects" v-if="subjects.length">
      <span v-for="subject in subjects" :key="subject">{{ subject }}</span>
    </section>

    <section class="tutor-card__meta">
      <div>
        <p class="label">{{ t('marketplace.tutorCard.experience') }}</p>
        <p class="value">{{ experienceText }}</p>
      </div>
      <div>
        <p class="label">{{ t('marketplace.tutorCard.rate') }}</p>
        <p class="value">{{ rateText }}</p>
      </div>
      <div>
        <p class="label">{{ t('marketplace.tutorCard.language') }}</p>
        <p class="value">{{ languageText }}</p>
      </div>
    </section>

    <footer class="tutor-card__footer">
      <slot name="actions" />
    </footer>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { resolveMediaUrl } from '../../../utils/media'
import { useI18n } from 'vue-i18n'
import { toDisplayText, toStringArray } from '../utils/formatters'

const props = defineProps({
  tutor: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['click'])

const { t } = useI18n()

const tutorName = computed(() => {
  const v = props.tutor?.full_name
  return typeof v === 'string' && v.trim().length ? v : t('common.notSpecified')
})

const tutorHeadline = computed(() => {
  const v = props.tutor?.headline
  return typeof v === 'string' && v.trim().length ? v : t('common.notSpecified')
})

const avatarUrl = computed(() => {
  const value = props.tutor?.avatar_url || props.tutor?.avatar
  return value ? resolveMediaUrl(value) : null
})

const initials = computed(() => {
  const name = typeof props.tutor?.full_name === 'string' ? props.tutor.full_name : ''
  if (!name) return 'T'
  return name
    .split(' ')
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

const subjects = computed(() => {
  const raw = props.tutor?.subjects
  const arr = Array.isArray(raw) ? raw : []
  // Avoid rendering [object Object]
  return toStringArray(arr)
})

const experienceText = computed(() => {
  const years = props.tutor?.experience_years
  if (typeof years === 'number' && Number.isFinite(years) && years >= 0) {
    return t('marketplace.tutorCard.experienceYears', { years })
  }
  return t('common.notSpecified')
})

const rateText = computed(() => {
  const amount = props.tutor?.hourly_rate
  const currency = props.tutor?.currency
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    const unit = t('marketplace.common.perHour')
    if (typeof currency === 'string' && currency.trim().length > 0) {
      return `${currency}${amount}${unit}`
    }
    return `${amount}${unit}`
  }
  return t('common.notSpecified')
})

const languageText = computed(() => {
  return toDisplayText(props.tutor?.language, t('common.notSpecified'))
})
</script>

<style scoped>
.tutor-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-color);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  cursor: pointer;
}

.tutor-card:hover {
  box-shadow: var(--shadow-card);
  transform: translateY(-2px);
}

.tutor-card__header {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.tutor-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--border-color) 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  overflow: hidden;
}

.tutor-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tutor-card__name {
  font: var(--font-headline);
  margin: 0;
}

.tutor-card__headline {
  font: var(--font-body);
  color: var(--text-muted);
  margin: 0.1rem 0 0;
}

.tutor-card__subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tutor-card__subjects span {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--border-color) 30%, transparent);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.tutor-card__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-sm);
}

.label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.2rem;
}

.value {
  font-weight: 600;
  color: var(--text-primary);
}

.tutor-card__footer {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}
</style>
