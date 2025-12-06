<template>
  <button
    type="button"
    class="flex flex-col items-start rounded-lg border border-border-subtle bg-surface-muted/40 p-4 text-left shadow-sm hover:shadow-md hover:border-primary transition"
    @click="goToDetail"
  >
    <h3 class="text-base font-semibold text-foreground truncate w-full">
      {{ title || `#${id}` }}
    </h3>
    <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
      {{ studentsCount }} {{ $t('classroom.card.students') || 'students' }}
    </p>
  </button>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  id: {
    type: [Number, String],
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  studentsCount: {
    type: Number,
    default: 0,
  },
})

const router = useRouter()

function goToDetail() {
  router.push({ path: `/dashboard/classrooms/${props.id}` })
}
</script>

