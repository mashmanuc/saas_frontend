<template>
  <div class="space-y-4">
    <!-- Хедер класу -->
    <Card>
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <button
            class="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors mb-2"
            @click="router.push('/dashboard/classrooms')"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {{ $t('classroom.detail.backToList') }}
          </button>
          <h1 class="text-2xl font-semibold">
            {{ classroom?.name || classroom?.title || $t('classroom.detail.title') }}
          </h1>
          <p v-if="classroom?.classroom_type" class="text-gray-500 text-sm dark:text-gray-400">
            {{ typeLabel }}
          </p>
        </div>

        <Button
          v-if="classroom && !classroom.is_default"
          variant="ghost"
          size="sm"
          class="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
          :disabled="deleting"
          :loading="deleting"
          @click="confirmDeleteClassroom"
        >
          {{ $t('classroom.detail.deleteClassroom') }}
        </Button>
      </div>
    </Card>

    <!-- Список учнів -->
    <Card>
      <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('loader.loading') }}
      </div>

      <p v-else-if="error" class="text-sm text-red-600">
        {{ error }}
      </p>

      <div v-else class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">{{ $t('classroom.detail.studentsTitle') }}</h2>

          <Button variant="primary" size="sm" @click="addStudentOpen = true">
            {{ $t('classroom.addStudent.button') }}
          </Button>
        </div>

        <ul
          v-if="students.length"
          class="space-y-2"
        >
          <li
            v-for="student in students"
            :key="student.id || student.email"
            class="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-muted/40 px-4 py-3"
          >
            <div class="flex items-center gap-3">
              <Avatar :text="student.display_name || student.name || student.email" size="sm" />
              <div class="flex flex-col">
                <span class="text-sm font-medium text-foreground">{{ student.display_name || student.name }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ student.email }}</span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              class="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              :disabled="removingId === student.id"
              :loading="removingId === student.id"
              @click="confirmRemoveStudent(student)"
            >
              {{ $t('classroom.detail.remove') }}
            </Button>
          </li>
        </ul>

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('classroom.detail.empty') }}
        </p>
      </div>
    </Card>

    <!-- Модалка додавання учня -->
    <AddStudentModal
      v-model="addStudentOpen"
      :classroom-id="classroomId ?? ''"
      @added="handleStudentAdded"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Avatar from '../../../ui/Avatar.vue'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import { notifyError, notifySuccess } from '../../../utils/notify'
import { useClassroomStore } from '../store/classroomStore'
import AddStudentModal from '../components/AddStudentModal.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const classroomStore = useClassroomStore()

const addStudentOpen = ref(false)
const removingId = ref(null)
const deleting = ref(false)

const classroomId = computed(() => route.params.id)
const classroom = computed(() => classroomStore.currentClassroom)
const students = computed(() => classroomStore.currentClassroom?.students || [])
const loading = computed(() => classroomStore.currentLoading)

const typeLabel = computed(() => {
  const typeMap = {
    group: t('classroom.create.types.group'),
    microgroup: t('classroom.create.types.microgroup'),
    individual: t('classroom.create.types.individual'),
  }
  return typeMap[classroom.value?.classroom_type] || ''
})

const rawError = computed(() => classroomStore.currentError)
const errorCode = computed(() => classroomStore.currentErrorCode)

const error = computed(() => {
  if (!rawError.value && !errorCode.value) return null

  if (errorCode.value === 404) {
    return t('classroom.detail.notFound')
  }

  if (errorCode.value === 403) {
    return t('classroom.detail.forbidden')
  }

  return rawError.value || t('classroom.detail.loadError')
})

function confirmRemoveStudent(student) {
  const name = student.display_name || student.name || student.email
  if (!window.confirm(t('classroom.detail.confirmRemoveStudent', { name }))) return
  handleRemoveStudent(student.id)
}

async function handleRemoveStudent(studentId) {
  removingId.value = studentId
  try {
    await classroomStore.removeStudent(classroomId.value, studentId)
    notifySuccess(t('classroom.detail.removeSuccess'))
  } catch (e) {
    notifyError(e?.response?.data?.detail || t('classroom.detail.removeError'))
  } finally {
    removingId.value = null
  }
}

function confirmDeleteClassroom() {
  const name = classroom.value?.name || classroom.value?.title || ''
  if (!window.confirm(t('classroom.detail.confirmDelete', { name }))) return
  handleDeleteClassroom()
}

async function handleDeleteClassroom() {
  deleting.value = true
  try {
    await classroomStore.deleteClassroom(classroomId.value)
    notifySuccess(t('classroom.detail.deleteSuccess'))
    router.push('/dashboard/classrooms')
  } catch (e) {
    const code = e?.response?.data?.code
    if (code === 'cannot_delete_default') {
      notifyError(t('classroom.detail.cannotDeleteDefault'))
    } else {
      notifyError(e?.response?.data?.detail || t('classroom.detail.deleteError'))
    }
  } finally {
    deleting.value = false
  }
}

function handleStudentAdded() {
  classroomStore.loadClassroomById(classroomId.value)
}

onMounted(() => {
  const id = classroomId.value
  if (!id) return

  classroomStore
    .loadClassroomById(id)
    .catch(() => {
      notifyError(t('classroom.detail.loadError'))
    })
})
</script>
