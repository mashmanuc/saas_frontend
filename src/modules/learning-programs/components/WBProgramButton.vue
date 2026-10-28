<!--
  «Програма» на дошці уроку (ТЗ §5.3). Учня бере сервер із самого уроку (`WBSession.student`, учень «Провести»
  Феї) — не з назви, папки чи пам'яті браузера. Кнопка є лише коли модуль відкритий цьому вчителю й урок має учня.
  Натиск відкриває вікно ПОВЕРХ дошки з безпечним показом (окрема серверна адреса, без нотаток і службових полів):
  дошка не покидається, сторінка, масштаб і незбережене лишаються, нова сесія не створюється, нічого не
  зараховується. Керування програмою — окремий явний перехід у новій вкладці. Учня перевіряємо при кожному
  відкритті: якщо на уроці змінили учня, показуємо програми нового, старі дані не переносяться.
-->
<template>
  <button
    v-if="visible"
    type="button"
    class="wb-header-btn wb-program-btn"
    data-testid="wb-program-button"
    :title="t('learningPrograms.board.title')"
    @click="openModal"
  >🧭 {{ t('learningPrograms.board.button') }}</button>
  <Modal :open="open" :title="t('learningPrograms.board.title')" size="lg" stacked @close="open = false">
      <div class="wb-program" data-testid="wb-program-modal">
        <p v-if="loading" class="wb-program__muted">{{ t('loader.loading') }}</p>
        <p v-else-if="failed" class="wb-program__muted" role="alert">{{ t('learningPrograms.errors.load') }}</p>
        <template v-else-if="ctx">
          <p class="wb-program__learner">{{ ctx.board_learner?.display_name }}</p>
          <div v-if="!ctx.programs.length" class="wb-program__none" data-testid="wb-program-none">
            <p>{{ t('learningPrograms.board.none') }}</p>
            <button type="button" class="wb-program__action" @click="openList">{{ t('learningPrograms.board.create') }}</button>
          </div>
          <div v-else-if="!chosen" class="wb-program__choose">
            <p class="wb-program__muted">{{ t('learningPrograms.board.choose') }}</p>
            <button v-for="pr in ctx.programs" :key="pr.id" type="button" class="wb-program__option" @click="chosen = pr.id">
              {{ pr.title }}
            </button>
          </div>
          <template v-else>
            <LearnerProgramPanel :program-id="chosen" />
            <button type="button" class="wb-program__action" data-testid="wb-program-manage" @click="openManage">
              {{ t('learningPrograms.board.manage') }} ↗
            </button>
          </template>
        </template>
      </div>
  </Modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import LearnerProgramPanel from './LearnerProgramPanel.vue'
import { learningProgramsApi, type Learner } from '../api/learningProgramsApi'
import { useProgramsAvailability } from '../composables/useProgramsAvailability'
import Modal from '@/ui/Modal.vue'

const props = defineProps<{ boardId: string }>()
const emit = defineEmits<{ (e: 'open-change', value: boolean): void }>()
const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const auth = useAuthStore()
const availability = useProgramsAvailability()

type Ctx = { board_learner: Learner | null; programs: { id: string; title: string; status: string }[] }
const visible = ref(false)
const open = ref(false)
const loading = ref(false)
const failed = ref(false)
const ctx = ref<Ctx | null>(null)
const chosen = ref<string | null>(null)
let contextSeq = 0

// Лише локальний бар'єр клавіш: відкриття програми не пише ops і не змінює інструмент дошки.
watch(open, (value) => {
  emit('open-change', value)
  if (!value) contextSeq += 1
}, { flush: 'sync' })
onBeforeUnmount(() => { contextSeq += 1; emit('open-change', false) })

watch(() => props.boardId, async (id, _old, onCleanup) => {
  open.value = false
  ctx.value = null
  chosen.value = null
  visible.value = false
  const seq = ++contextSeq
  let current = true
  onCleanup(() => { current = false })
  if (!(await availability.ensure(auth.user?.id, auth.user?.role))) return
  if (!current) return
  try {
    const c = await learningProgramsApi.forBoard(id)
    if (current && seq === contextSeq) visible.value = !!c?.board_learner
  } catch {
    if (current && seq === contextSeq) visible.value = false // урок без учня / не мій — кнопки немає
  }
}, { immediate: true })

async function openModal() {
  const seq = ++contextSeq
  const board = props.boardId
  open.value = true
  loading.value = true
  failed.value = false
  ctx.value = null
  chosen.value = null
  try {
    const fresh = await learningProgramsApi.forBoard(board) // свіжий контекст учня
    if (seq !== contextSeq || !open.value || board !== props.boardId) return
    ctx.value = fresh
    if (ctx.value?.programs.length === 1) chosen.value = ctx.value.programs[0].id
  } catch {
    if (seq === contextSeq) failed.value = true
  } finally {
    if (seq === contextSeq) loading.value = false
  }
}

function openManage() {
  if (!chosen.value) return
  window.open(router.resolve({ name: 'learning-program', params: { id: chosen.value } }).href, '_blank', 'noopener')
}

function openList() {
  window.open(router.resolve({ name: 'learning-programs' }).href, '_blank', 'noopener')
}
</script>

<style scoped>
.wb-program-btn { width: auto; padding: 0 10px; gap: 4px; font-size: 13px; font-weight: 600; white-space: nowrap; }
.wb-program {
  display: flex; flex-direction: column; gap: 14px;
}
.wb-program__learner { margin: 0; font-size: 13px; color: var(--text-secondary, #475569); text-transform: uppercase; letter-spacing: 0.05em; }
.wb-program__muted { margin: 0; color: var(--text-secondary, #475569); }
.wb-program__none, .wb-program__choose { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.wb-program__option {
  width: 100%; text-align: left; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border-color, #e2e8f0);
  background: var(--surface-card, #f8fafc); cursor: pointer; font-size: 15px; color: inherit;
}
.wb-program__action {
  align-self: flex-start; padding: 8px 14px; border-radius: 10px; border: 1px solid var(--accent, #2563eb);
  background: none; color: var(--accent, #2563eb); cursor: pointer; font-weight: 600;
}
</style>
