<template>
  <Modal :open="modelValue" :title="$t('classroom.addStudent.title')" @close="handleCancel">
    <div class="space-y-4">
      <!-- Завантаження -->
      <div v-if="store.availableStudentsLoading" class="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
        {{ $t('loader.loading') }}
      </div>

      <!-- У тьютора взагалі немає учнів (порожній список без пошуку) -->
      <div v-else-if="isNoStudentsAtAll" class="py-6 text-center space-y-3">
        <div class="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <svg class="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-foreground">
          {{ $t('classroom.addStudent.noStudentsYet') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
          {{ $t('classroom.addStudent.noStudentsHint') }}
        </p>
      </div>

      <!-- Є учні — показуємо пошук та список -->
      <template v-else>
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

        <!-- Пошук не дав результатів -->
        <div v-if="students.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
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
      </template>

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
import { notifySuccess } from '../../../utils/notify'

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

const searchQuery = ref('')
const adding = ref(false)
const addingId = ref(null)
const errorMessage = ref('')
const initialLoadDone = ref(false)
const initialCount = ref(0)

let searchTimer = null

const students = computed(() => store.availableStudents)

const isNoStudentsAtAll = computed(() => {
  return initialLoadDone.value && initialCount.value === 0 && !searchQuery.value
})

watch(
  () => props.modelValue,
  async (value) => {
    if (value) {
      searchQuery.value = ''
      errorMessage.value = ''
      initialLoadDone.value = false
      initialCount.value = 0
      await store.loadAvailableStudents(props.classroomId)
      initialCount.value = store.availableStudents.length
      initialLoadDone.value = true
    }
  },
)

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
  emit('update:modelValue', false)
}
</script>
