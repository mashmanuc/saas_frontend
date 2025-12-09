<template>
  <div class="space-y-6">
    <Card class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold">
            {{ $t('classroom.dashboard.title') || 'Мої класи' }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('classroom.dashboard.subtitle') || '' }}
          </p>
        </div>

        <Button variant="primary" :disabled="creating" :loading="creating" @click="handleCreate">
          {{ creating ? $t('loader.loading') : $t('classroom.dashboard.create') }}
        </Button>
      </div>

      <p v-if="error" class="text-sm text-red-600">
        {{ error }}
      </p>
    </Card>

    <div>
      <div
        v-if="loading"
        class="grid gap-4"
        :class="gridClasses"
      >
        <div
          v-for="n in 4"
          :key="n"
          class="h-24 rounded-lg bg-surface-muted/60 border border-border-subtle animate-pulse"
        />
      </div>

      <div
        v-else
        class="grid gap-4"
        :class="gridClasses"
      >
        <ClassroomCard
          v-for="classroom in classrooms"
          :key="classroom.id"
          :id="classroom.id"
          :title="classroom.name || classroom.title"
          :students-count="classroom.students_count ?? classroom.studentsCount ?? 0"
        />

        <p
          v-if="!classrooms.length && !error"
          class="text-sm text-gray-500 dark:text-gray-400 col-span-full"
        >
          {{ $t('classroom.dashboard.empty') || 'Немає класів' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import ClassroomCard from '../components/ClassroomCard.vue'
import { useClassroomStore } from '../store/classroomStore'
import apiClient from '../../../utils/apiClient'
import { notifySuccess, notifyError } from '../../../utils/notify'

const store = useClassroomStore()

const creating = ref(false)
const { t } = useI18n()

const classrooms = computed(() => store.items)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const gridClasses = computed(
  () => 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
)

async function handleCreate() {
  if (creating.value) return
  creating.value = true

  try {
    const name = t('classroom.dashboard.title')
    await apiClient.post('/tutor/classrooms/', { name })
    await store.refreshClassrooms()
    notifySuccess(t('classroom.dashboard.createSuccess'))
  } catch (e) {
    notifyError(t('classroom.dashboard.createError'))
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  store.loadClassrooms()
})
</script>
