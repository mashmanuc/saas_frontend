<template>
  <div class="csc" data-testid="conduct-student-choice">
    <input
      v-model="query"
      type="text"
      class="csc__input"
      maxlength="120"
      autocomplete="off"
      :placeholder="t('winterboard.lesson.conductStudent.search')"
      :disabled="locked"
      data-testid="conduct-student-input"
      @keydown.enter.prevent="onEnter"
    />

    <p v-if="loading" class="csc__muted">{{ t('loader.loading') }}</p>
    <p v-else-if="loadFailed" class="csc__error" role="alert">{{ t('winterboard.lesson.conductStudent.loadFailed') }}</p>

    <ul v-if="shown.length" class="csc__list">
      <li v-for="s in shown" :key="s.id">
        <button
          type="button"
          class="csc__item"
          :class="{ 'csc__item--current': s.id === currentId }"
          :disabled="locked"
          data-testid="conduct-student-item"
          @click="emit('choose', s.id)"
        >
          <b class="csc__avatar" aria-hidden="true">{{ s.name.charAt(0) }}</b>
          <span class="csc__name">{{ s.name }}</span>
          <span v-if="s.id === currentId" class="csc__mark">✓</span>
        </button>
      </li>
    </ul>
    <p v-else-if="!loading && !loadFailed && !newName" class="csc__muted">
      {{ t('winterboard.lesson.conductStudent.empty') }}
    </p>

    <!-- Нове ім'я — учень без акаунта (той самий, що в розкладі), одразу обраний -->
    <button
      v-if="newName"
      type="button"
      class="csc__add"
      :disabled="locked"
      data-testid="conduct-student-add"
      @click="addNew"
    >
      {{ t('winterboard.lesson.conductStudent.add', { name: newName }) }}
    </button>
    <p v-if="addFailed" class="csc__error" role="alert">{{ t('winterboard.lesson.conductStudent.addFailed') }}</p>

    <button
      type="button"
      class="csc__none"
      :class="{ 'csc__item--current': currentId === null }"
      :disabled="locked"
      data-testid="conduct-student-none"
      @click="emit('choose', null)"
    >
      {{ t('winterboard.lesson.conductStudent.none') }}
      <span v-if="currentId === null" class="csc__mark">✓</span>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * «З ким урок?» (LAW §9 v1.68, власник 2026-10-27: «Так, роби») — вибір учня проведеного уроку. Один і той самий
 * на сайті («Провести», «Змінити учня») і на пульті: свої учні (і без акаунта), спершу недавні; нове ім'я — учень
 * без акаунта, як у розкладі; «Без учня». Сам нічого не пише в урок — лише повертає вибір (`choose`).
 *
 * `currentId`: undefined — нічого не позначено; null — позначено «Без учня»; число — цей учень.
 * Кольори — змінними `--csc-*` (пульт темний, сайт світлий).
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import relationsApi from '@/api/relations'
import { lessonViewApi, type ConductStudent } from '../api/lessonViewApi'

const props = defineProps<{ currentId?: number | null; busy?: boolean }>()
const emit = defineEmits<{ (e: 'choose', studentId: number | null): void }>()
const { t } = useI18n({ useScope: 'global' })

const students = ref<ConductStudent[]>([])
const loading = ref(true)
const loadFailed = ref(false)
const adding = ref(false)
const addFailed = ref(false)
const query = ref('')
const locked = computed(() => !!props.busy || adding.value)

const typed = computed(() => query.value.split(/\s+/).filter(Boolean).join(' '))
const shown = computed(() => {
  const q = typed.value.toLocaleLowerCase()
  return q ? students.value.filter((s) => s.name.toLocaleLowerCase().includes(q)) : students.value
})
/** Вписане ім'я, якого немає серед учнів (точний збіг без регістру) — можна додати. */
const newName = computed(() => {
  const q = typed.value.toLocaleLowerCase()
  if (!q || loading.value) return ''
  return students.value.some((s) => s.name.toLocaleLowerCase() === q) ? '' : typed.value
})

onMounted(async () => {
  try {
    students.value = (await lessonViewApi.listConductStudents()).students ?? []
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
})

async function addNew(): Promise<void> {
  const name = newName.value
  if (!name || locked.value) return
  adding.value = true
  addFailed.value = false
  try {
    const relation = await relationsApi.createPlaceholderStudent({ name })
    const id = (relation as { student?: { id?: unknown } } | null)?.student?.id
    if (typeof id !== 'number') throw new Error('no student id')
    emit('choose', id)
  } catch {
    addFailed.value = true
  } finally {
    adding.value = false
  }
}

function onEnter(): void {
  if (locked.value) return
  if (shown.value.length === 1) emit('choose', shown.value[0].id)
  else if (newName.value) void addNew()
}
</script>

<style scoped>
/* Кольори: батько може задати --csc-bg/fg/muted/border/accent (пульт темний); інакше — теми сайту. */
.csc { display: flex; flex-direction: column; gap: 8px; }
.csc__input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--csc-border, var(--border-color, #e5e7eb)); border-radius: 10px;
  background: var(--csc-bg, var(--card-bg, #fff)); color: var(--csc-fg, var(--text-primary, #111827)); font-size: 0.9375rem;
}
.csc__input:focus { outline: 2px solid var(--csc-accent, var(--accent, #2563eb)); outline-offset: 1px; }
.csc__muted { margin: 0; font-size: 0.875rem; color: var(--csc-muted, var(--text-secondary, #6b7280)); }
.csc__error { margin: 0; font-size: 0.875rem; color: var(--danger, #dc2626); }
.csc__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.csc__item, .csc__none, .csc__add {
  width: 100%; min-height: 44px; display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border: 1px solid var(--csc-border, var(--border-color, #e5e7eb)); border-radius: 10px;
  background: var(--csc-bg, var(--card-bg, #fff)); color: var(--csc-fg, var(--text-primary, #111827)); font-size: 0.9375rem; text-align: left; cursor: pointer;
}
.csc__item:hover:not(:disabled), .csc__none:hover:not(:disabled), .csc__add:hover:not(:disabled) { border-color: var(--csc-accent, var(--accent, #2563eb)); }
.csc__item:disabled, .csc__none:disabled, .csc__add:disabled { cursor: default; opacity: 0.6; }
.csc__item--current { border-color: var(--csc-accent, var(--accent, #2563eb)); }
.csc__avatar {
  flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  background: var(--csc-accent, var(--accent, #2563eb)); color: var(--color-on-accent, #ffffff); font-size: 0.8125rem;
}
.csc__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.csc__mark { margin-left: auto; color: var(--csc-accent, var(--accent, #2563eb)); font-weight: 700; }
.csc__add { border-style: dashed; color: var(--csc-accent, var(--accent, #2563eb)); font-weight: 600; }
.csc__none { color: var(--csc-muted, var(--text-secondary, #6b7280)); }
</style>
