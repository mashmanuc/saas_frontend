<template>
  <Modal :open="open" :title="$t('classroom.addStudent.title')" @close="handleCancel">
    <div class="space-y-4">
      <div class="space-y-1">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400" for="student-search">
          {{ $t('classroom.addStudent.searchLabel') }}
        </label>
        <input
          id="student-search"
          v-model="searchQuery"
          type="text"
          :disabled="adding"
          class="block w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
          :placeholder="$t('classroom.addStudent.searchPlaceholder')"
        />
      </div>

      <div v-if="store.availableStudentsLoading" class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        {{ $t('loader.loading') }}
      </div>

      <div v-else-if="students.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        {{ $t('classroom.addStudent.empty') }}
      </div>

      <ul v-else class="max-h-64 overflow-y-auto divide-y divide-border-subtle">
        <li
          v-for="student in students"
          :key="student.id"
          class="flex items-center justify-between gap-3 py-2.5 px-1"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-foreground truncate">
              {{ student.display_name || student.name }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ student.email }}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            :disabled="adding"
            :loading="addingId === student.id"
            @click="handleAdd(student.id)"
          >
            {{ $t('classroom.addStudent.add') }}
          </Button>
        </li>
      </ul>

      <p v-if="errorMessage" class="text-xs text-red-600 mt-1">
        {{ errorMessage }}
      </p>
    </div>

    <template #footer>
      <Button variant="ghost" size="sm" :disabled="adding" @click="handleCancel">
        {{ $t('common.close') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Modal from '../../../ui/Modal.vue'
import { useClassroomStore } from '../store/classroomStore'
import { notifySuccess, notifyError } from '../../../utils/notify'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  classroomId: {
    type: [Number, String],
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'added'])

const { t } = useI18n()
const store = useClassroomStore()

const open = ref(props.modelValue)
const searchQuery = ref('')
const adding = ref(false)
const addingId = ref(null)
const errorMessage = ref('')

let searchTimer = null

const students = computed(() => store.availableStudents)

watch(
  () => props.modelValue,
  (value) => {
    open.value = value
    if (value) {
      searchQuery.value = ''
      errorMessage.value = ''
      store.loadAvailableStudents(props.classroomId)
    }
  },
)

watch(open, (value) => {
  emit('update:modelValue', value)
})

watch(searchQuery, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    store.loadAvailableStudents(props.classroomId, q)
  }, 300)
})

async function handleAdd(studentId) {
  adding.value = true
  addingId.value = studentId
  errorMessage.value = ''

  try {
    await store.addStudent(props.classroomId, studentId)
    notifySuccess(t('classroom.addStudent.success'))
    emit('added', studentId)
    // Оновлюємо список доступних учнів
    await store.loadAvailableStudents(props.classroomId, searchQuery.value)
  } catch (e) {
    const detail = e?.response?.data?.detail
    const code = e?.response?.data?.code

    if (code === 'already_member') {
      errorMessage.value = t('classroom.addStudent.errors.alreadyMember')
    } else if (code === 'max_students_reached') {
      errorMessage.value = t('classroom.addStudent.errors.maxReached')
    } else if (code === 'no_relation') {
      errorMessage.value = t('classroom.addStudent.errors.noRelation')
    } else {
      errorMessage.value = detail || t('classroom.addStudent.errors.generic')
    }
  } finally {
    adding.value = false
    addingId.value = null
  }
}

function handleCancel() {
  if (adding.value) return
  open.value = false
}
</script>
