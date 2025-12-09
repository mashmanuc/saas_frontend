<template>
  <article class="tutor-card" @click="$emit('click')">
    <header class="tutor-card__header">
      <div class="tutor-card__avatar">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          :alt="tutor?.full_name || 'Tutor avatar'"
          loading="lazy"
        />
        <span v-else>{{ initials }}</span>
      </div>
      <div>
        <h3 class="tutor-card__name">{{ tutor?.full_name || 'Tutor Name' }}</h3>
        <p class="tutor-card__headline">{{ tutor?.headline || 'Short description' }}</p>
      </div>
    </header>

    <section class="tutor-card__subjects" v-if="(tutor?.subjects || []).length">
      <span v-for="subject in tutor.subjects" :key="subject">{{ subject }}</span>
    </section>

    <section class="tutor-card__meta">
      <div>
        <p class="label">Досвід</p>
        <p class="value">{{ tutor?.experience_years ? tutor.experience_years + ' років' : 'N/A' }}</p>
      </div>
      <div>
        <p class="label">Ставка</p>
        <p class="value">
          {{ tutor?.hourly_rate ? `$${tutor.hourly_rate}/год` : 'Договірна' }}
        </p>
      </div>
      <div>
        <p class="label">Мова</p>
        <p class="value">{{ tutor?.language || 'uk' }}</p>
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

const props = defineProps({
  tutor: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['click'])

const avatarUrl = computed(() => {
  const value = props.tutor?.avatar_url || props.tutor?.avatar
  return value ? resolveMediaUrl(value) : null
})

const initials = computed(() => {
  const name = props.tutor?.full_name || ''
  if (!name) return 'T'
  return name
    .split(' ')
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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
  border: 1px solid rgba(15, 23, 42, 0.06);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  cursor: pointer;
}

.tutor-card:hover {
  box-shadow: 0 8px 24px rgba(12, 15, 25, 0.12);
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
  background: rgba(15, 23, 42, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #0f172a;
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
  color: rgba(15, 23, 42, 0.7);
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
  background: rgba(15, 23, 42, 0.05);
  font-size: 0.85rem;
  color: rgba(15, 23, 42, 0.7);
}

.tutor-card__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-sm);
}

.label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.6);
  margin-bottom: 0.2rem;
}

.value {
  font-weight: 600;
  color: rgba(15, 23, 42, 0.9);
}

.tutor-card__footer {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}
</style>
