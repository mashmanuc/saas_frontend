<script setup lang="ts">
// TASK MF9: ProfileBadges component
import { Award } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { Badge } from '../../api/marketplace'
import BadgeIcon from '../shared/Badge.vue'

interface Props {
  badges: Badge[]
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <section class="profile-badges">
    <h3>
      <Award :size="18" />
      {{ t('marketplace.profile.badgesTitle') }}
    </h3>

    <div class="badges-grid">
      <BadgeIcon
        v-for="badge in badges"
        :key="badge.type"
        :badge="badge"
        size="lg"
        show-tooltip
      />
    </div>
  </section>
</template>

<style scoped>
.profile-badges {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font: var(--font-subtitle);
  margin: 0 0 1rem;
  color: var(--text-primary);
}

.badges-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
