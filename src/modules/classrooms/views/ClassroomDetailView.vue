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

      <div v-else class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">{{ $t('classroom.detail.studentsTitle') }}</h2>

          <Button variant="primary" size="sm" @click="inviteOpen = true">
            {{ $t('classroom.invite.button') }}
          </Button>
        </div>

        <ul
          v-if="students.length"
          class="space-y-2"
        >
          <StudentListItem
            v-for="student in students"
            :key="student.id || student.email"
            :student="student"
          />
        </ul>

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('classroom.detail.empty') }}
        </p>
      </div>
    </Card>

    <InviteStudentModal v-model="inviteOpen" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import { notifyError } from '../../../utils/notify'
import { useClassroomStore } from '../store/classroomStore'
import StudentListItem from '../components/StudentListItem.vue'
import InviteStudentModal from '../components/InviteStudentModal.vue'

const route = useRoute()
const { t } = useI18n()
const classroomStore = useClassroomStore()

const inviteOpen = ref(false)

const classroom = computed(() => classroomStore.currentClassroom)
const students = computed(() => classroomStore.currentClassroom?.students || [])
const loading = computed(() => classroomStore.currentLoading)

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

onMounted(() => {
  const id = route.params.id
  if (!id) return

  classroomStore
    .loadClassroomById(id)
    .catch(() => {
      // На випадок неочікуваної помилки все одно покажемо тост
      notifyError(t('classroom.detail.loadError'))
    })
})
</script>
