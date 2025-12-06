<template>
  <div class="space-y-4">
    <Card class="space-y-2">
      <h1 class="text-2xl font-semibold">
        {{ classroom?.name || classroom?.title || $t('classroom.detail.title') }}
      </h1>
      <p class="text-gray-500 text-sm dark:text-gray-400">
        <!-- Опис класу можна розширити пізніше -->
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
        <h2 class="text-lg font-semibold mb-2">{{ $t('classroom.detail.studentsTitle') }}</h2>

        <table v-if="students.length" class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-border-subtle text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <th class="py-2 pr-4">{{ $t('classroom.detail.studentName') }}</th>
              <th class="py-2 pr-4">{{ $t('classroom.detail.studentEmail') }}</th>
              <th class="py-2 pr-4">{{ $t('classroom.detail.studentStatus') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="student in students"
              :key="student.id || student.email"
              class="border-b border-border-subtle last:border-b-0"
            >
              <td class="py-2 pr-4 font-medium text-foreground">
                {{ getStudentName(student) }}
              </td>
              <td class="py-2 pr-4 text-gray-600 dark:text-gray-300">
                {{ student.email }}
              </td>
              <td class="py-2 pr-4 text-gray-600 dark:text-gray-300">
                {{ student.status || '—' }}
              </td>
            </tr>
          </tbody>
        </table>

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('classroom.detail.empty') }}
        </p>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Card from '../../../ui/Card.vue'
import apiClient from '../../../utils/apiClient'
import { notifyError } from '../../../utils/notify'

const classroom = ref(null)
const students = ref([])
const loading = ref(false)
const error = ref(null)

const route = useRoute()
const { t } = useI18n()

function getStudentName(student) {
  if (!student) return '—'
  const { first_name: firstName, last_name: lastName, email } = student
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  return fullName || email || '—'
}

async function loadClassroom() {
  const id = route.params.id
  if (!id) return

  loading.value = true
  error.value = null

  try {
    const data = await apiClient.get(`/tutor/classrooms/${id}/`)
    classroom.value = data
    students.value = data?.students || []
  } catch (e) {
    const message = e?.response?.data?.detail || t('classroom.detail.loadError')
    error.value = message
    notifyError(message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadClassroom()
})
</script>
