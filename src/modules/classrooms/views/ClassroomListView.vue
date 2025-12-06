<template>
  <div class="space-y-4">
    <Card class="space-y-2">
      <h1 class="text-2xl font-semibold">{{ $t('classroom.list.title') }}</h1>
      <p class="text-gray-500 text-sm dark:text-gray-400">
        <!-- Опис можна розширити пізніше -->
      </p>
    </Card>

    <Card>
      <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('loader.loading') }}
      </div>

      <p v-else-if="error" class="text-sm text-red-600">
        {{ error }}
      </p>

      <div v-else>
        <table v-if="classrooms.length" class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-border-subtle text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <th class="py-2 pr-4">{{ $t('classroom.list.name') }}</th>
              <th class="py-2 pr-4">{{ $t('classroom.list.studentsCount') }}</th>
              <th class="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="classroom in classrooms"
              :key="classroom.id"
              class="border-b border-border-subtle last:border-b-0"
            >
              <td class="py-2 pr-4 font-medium text-foreground">
                {{ classroom.name || classroom.title || `#${classroom.id}` }}
              </td>
              <td class="py-2 pr-4 text-gray-600 dark:text-gray-300">
                {{ classroom.students_count ?? classroom.studentsCount ?? 0 }}
              </td>
              <td class="py-2 pr-4 text-right">
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary/90"
                  @click="openClassroom(classroom.id)"
                >
                  {{ $t('classroom.list.open') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('classroom.list.empty') }}
        </p>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Card from '../../../ui/Card.vue'
import apiClient from '../../../utils/apiClient'
import { notifyError } from '../../../utils/notify'

const classrooms = ref([])
const loading = ref(false)
const error = ref(null)

const router = useRouter()
const { t } = useI18n()

async function loadClassrooms() {
  loading.value = true
  error.value = null

  try {
    const data = await apiClient.get('/tutor/classrooms/')
    classrooms.value = Array.isArray(data) ? data : data?.results || []
  } catch (e) {
    const message = e?.response?.data?.detail || t('classroom.list.loadError')
    error.value = message
    notifyError(message)
  } finally {
    loading.value = false
  }
}

function openClassroom(id) {
  if (!id) return
  router.push({ path: `/tutor/classrooms/${id}` })
}

onMounted(() => {
  loadClassrooms()
})
</script>
