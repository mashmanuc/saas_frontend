<template>
  <Card class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold mb-2">Кабінет тьютора</h1>
      <p class="text-gray-500 text-sm dark:text-gray-400">
        Тут буде список учнів, майбутні уроки, classroom-и.
      </p>
    </div>

    <p v-if="nextLessonAt" class="text-sm text-gray-700 dark:text-gray-200">
      {{ $t('dashboard.nextLessonAt') }}:
      <span class="font-medium">{{ formatDateTime(nextLessonAt, auth.user?.timezone) }}</span>
    </p>
  </Card>
</template>

<script setup>
import { ref } from 'vue'
import Card from '../../../ui/Card.vue'
import { formatDateTime } from '../../../utils/datetime'
import { useAuthStore } from '../../auth/store/authStore'

const auth = useAuthStore()

// TODO: замінити на реальні дані з бекенду
const nextLessonAt = ref(new Date().toISOString())
</script>
