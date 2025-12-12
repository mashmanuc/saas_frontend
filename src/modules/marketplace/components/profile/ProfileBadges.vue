<script setup lang="ts">
// TASK MF9: ProfileBadges component
import { Award } from 'lucide-vue-next'
import type { Badge } from '../../api/marketplace'
import BadgeIcon from '../shared/Badge.vue'

interface Props {
  badges: Badge[]
}

defineProps<Props>()
</script>

<template>
  <section class="profile-badges">
    <h3>
      <Award :size="18" />
      Badges & Achievements
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
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: #111827;
}

.badges-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
