<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import MatchList from '../components/MatchList.vue'

const authStore = useAuthStore()
const role = computed(() => authStore.userRole as 'tutor' | 'student')
</script>

<template>
  <div class="match-list-view">
    <MatchList :role="role" />
  </div>
</template>

<style scoped>
.match-list-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
