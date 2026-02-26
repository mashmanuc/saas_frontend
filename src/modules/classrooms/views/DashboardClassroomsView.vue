<template>
  <div class="space-y-6">
    <Card class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold">
            {{ $t('classroom.dashboard.title') }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('classroom.dashboard.subtitle') }}
          </p>
        </div>

        <Button variant="primary" @click="showCreateModal = true">
          {{ $t('classroom.dashboard.create') }}
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
          {{ $t('classroom.dashboard.empty') }}
        </p>
      </div>
    </div>

    <CreateClassroomModal v-model="showCreateModal" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import ClassroomCard from '../components/ClassroomCard.vue'
import CreateClassroomModal from '../components/CreateClassroomModal.vue'
import { useClassroomStore } from '../store/classroomStore'

const store = useClassroomStore()
const showCreateModal = ref(false)

const classrooms = computed(() => store.items)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const gridClasses = computed(
  () => 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
)

onMounted(() => {
  store.loadClassrooms()
})
</script>
