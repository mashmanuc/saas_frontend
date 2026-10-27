<template>
  <section class="rl" data-testid="remote-launch" :aria-label="t('winterboard.remote.launch.title')">
    <h2 class="rl__title">{{ t('winterboard.remote.launch.title') }}</h2>
    <!-- П8: перед дотиком видно, ДЕ відкриється урок -->
    <p v-if="info" class="rl__where" :class="{ 'rl__where--none': !info.screen }" data-testid="remote-launch-where">
      {{ where }}
    </p>
    <!-- v1.68 «З ким урок?»: після дотику на уроці — учень; вибір іде разом із проханням провести -->
    <div v-if="picking" class="rl__who" data-testid="remote-launch-who">
      <div class="rl__who-head">
        <button
          type="button"
          class="rl__back"
          :disabled="busyId !== null"
          data-testid="remote-launch-back"
          @click="picking = null"
        >
          ‹ {{ t('winterboard.remote.launch.back') }}
        </button>
        <span class="rl__name">{{ picking.name || t('winterboard.remote.launch.untitled') }}</span>
      </div>
      <p class="rl__where">
        {{ busyId ? t('winterboard.remote.launch.opening') : t('winterboard.lesson.conductStudent.title') }}
      </p>
      <ConductStudentChoice :key="choiceKey" :busy="busyId !== null" @choose="start(picking, $event)" />
    </div>
    <template v-else>
      <ul v-if="lessons.length" class="rl__list">
        <li v-for="lesson in lessons" :key="lesson.id">
          <button
            type="button"
            class="rl__item"
            :disabled="busyId !== null"
            :data-testid="`remote-launch-${lesson.id}`"
            @click="pick(lesson)"
          >
            <span class="rl__name">{{ lesson.name || t('winterboard.remote.launch.untitled') }}</span>
            <span v-if="lesson.updated_at" class="rl__date">{{ shortDate(lesson.updated_at) }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="info" class="rl__empty">{{ t('winterboard.remote.launch.empty') }}</p>
    </template>
    <!-- Натиск не мовчить (П5): що сталося — одним рядком -->
    <p v-if="note" class="rl__note" :class="`rl__note--${note.tone}`" role="status" data-testid="remote-launch-note">
      {{ note.text }}
    </p>
  </section>
</template>

<script setup lang="ts">
/**
 * Запуск уроку з пульта — LAW §9 v1.63, маніфест пульта П8 (2026-10-26).
 *
 * Лише коли на жодному комп'ютері не відкрита дошка (батько показує цей блок при
 * `noActiveBoard`). Останні «Мої уроки» — не шаблони Студії (v1.65); дотик просить
 * комп'ютер, якого торкались останнім, «Провести» урок (свіжа копія, шаблон чистий) і
 * до 20 с чекає, поки там відкриється дошка (`remote/active/`), — тоді батько
 * підключається як звичайно. Пульт нічого не пише.
 *
 * v1.68 «З ким урок?»: дотик на уроці відкриває вибір учня (той самий, що на сайті); учень іде разом із
 * проханням провести, копію з учнем створює комп'ютер.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { winterboardApi } from '../../api/winterboardApi'
import type { RemoteLaunchInfo, RemoteLaunchLesson } from '../../api/winterboardApi'
import ConductStudentChoice from '@/modules/knowledge/components/ConductStudentChoice.vue'

const LAUNCH_WAIT_TRIES = 20          // до 20 с: комп'ютер спершу робить свіжу копію уроку
const LAUNCH_WAIT_STEP_MS = 1000

const emit = defineEmits<{ (e: 'opened'): void }>()
const { t, te, locale } = useI18n()

const info = ref<RemoteLaunchInfo | null>(null)
const busyId = ref<string | null>(null)
const lessons = computed<RemoteLaunchLesson[]>(() => info.value?.lessons ?? [])
const note = ref<{ tone: 'warn' | 'error'; text: string } | null>(null)
const picking = ref<RemoteLaunchLesson | null>(null)
const choiceKey = ref(0)        // +1 — свіжий список учнів (учня вже немає серед своїх)
let alive = true

const where = computed(() => {
  const screen = info.value?.screen
  if (!screen) return t('winterboard.remote.launch.noScreen')
  if (screen.page && te(screen.page)) return t('winterboard.remote.launch.where', { page: t(screen.page) })
  return t('winterboard.remote.launch.whereUnknown')
})

function statusOf(err: any): number | null {
  return err?.response?.status ?? err?.status ?? null
}
function errorOf(err: any): string | null {
  return err?.response?.data?.error ?? err?.data?.error ?? null
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit' })
}

async function load(): Promise<void> {
  try {
    info.value = await winterboardApi.getRemoteLaunch()
  } catch {
    note.value = { tone: 'error', text: t('winterboard.remote.launch.loadFailed') }
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Чи відкрилась дошка на комп'ютері: true — так; false — не за 20 с; null — помилка сервера.
 * Id свіжої копії пульт не знає; будь-яка відкрита дошка — наша: перед запуском сервер
 * перевірив, що відкритої немає.
 */
async function waitForBoard(): Promise<boolean | null> {
  for (let i = 0; i < LAUNCH_WAIT_TRIES; i += 1) {
    await sleep(LAUNCH_WAIT_STEP_MS)
    if (!alive) return false
    try {
      const active = await winterboardApi.getActiveRemoteSession()
      if (active?.session_id) return true
    } catch (err) {
      // 404 — комп'ютер ще відкриває; без відповіді (мережа) — чекаємо далі; інша — зупинка
      const status = statusOf(err)
      if (status !== null && status !== 404) return null
    }
  }
  return false
}

function pick(lesson: RemoteLaunchLesson): void {
  if (busyId.value) return
  note.value = null
  picking.value = lesson
}

async function start(lesson: RemoteLaunchLesson, studentId: number | null = null): Promise<void> {
  if (busyId.value) return
  busyId.value = lesson.id
  note.value = null
  try {
    const sentTo = await winterboardApi.remoteLaunch(lesson.id, studentId)
    // рядок «де» — туди, куди сервер справді надіслав (учитель міг клацнути на іншому комп'ютері)
    if (info.value) info.value = { ...info.value, screen: { page: sentTo?.page ?? null } }
    const opened = await waitForBoard()
    if (opened) emit('opened')
    else note.value = {
      tone: opened === false ? 'warn' : 'error',
      text: t(opened === false ? 'winterboard.remote.launch.notOpened' : 'winterboard.remote.launch.failed'),
    }
  } catch (err) {
    const code = errorOf(err)
    if (code === 'board_open') {
      emit('opened')                 // десь уже відкрита дошка — батько підключиться до неї
    } else if (code === 'student_not_yours') {
      note.value = { tone: 'warn', text: t('winterboard.remote.launch.studentGone') }
      choiceKey.value += 1
    } else if (code === 'no_screen') {
      if (info.value) info.value = { ...info.value, screen: null }
      note.value = { tone: 'warn', text: t('winterboard.remote.launch.noScreen') }
    } else if (statusOf(err) === 404) {
      note.value = { tone: 'warn', text: t('winterboard.remote.launch.gone') }
      picking.value = null
      await load()
    } else {
      note.value = { tone: 'error', text: t('winterboard.remote.launch.failed') }
    }
  } finally {
    busyId.value = null
  }
}

// Телефон розблокували — учитель міг уже клацнути на іншому комп'ютері: оновити «де».
function onVisible(): void {
  if (document.visibilityState === 'visible' && !busyId.value) void load()
}

onMounted(() => {
  void load()
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  alive = false
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<style scoped>
.rl { display: flex; flex-direction: column; gap: 8px; }
.rl__title { margin: 6px 0 0; font-size: 15px; font-weight: 700; color: var(--text, #f8fafc); }
.rl__where { margin: 0; font-size: 13px; line-height: 1.4; color: #cbd5e1; }
.rl__where--none { color: var(--warn, #f59e0b); }
.rl__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rl__item {
  width: 100%; min-height: 52px; padding: 10px 14px; border: 0; border-radius: 12px;
  background: var(--surface, #1e293b); color: var(--text, #f8fafc);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  font-size: 15px; text-align: left; cursor: pointer;
}
.rl__item:disabled { opacity: 0.55; cursor: default; }
.rl__who {
  display: flex; flex-direction: column; gap: 8px;
  --csc-bg: var(--surface, #1e293b); --csc-fg: var(--text, #f8fafc); --csc-muted: var(--muted, #94a3b8);
  --csc-border: #334155; --csc-accent: #3b82f6;
}
.rl__who-head { display: flex; align-items: center; gap: 10px; color: var(--text, #f8fafc); font-size: 15px; }
.rl__back {
  flex: none; min-height: 40px; padding: 6px 12px; border: 0; border-radius: 10px;
  background: var(--surface, #1e293b); color: var(--text, #f8fafc); font-size: 14px; cursor: pointer;
}
.rl__back:disabled { opacity: 0.55; cursor: default; }
.rl__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.rl__date { flex: none; font-size: 12px; color: var(--muted, #94a3b8); }
.rl__empty { margin: 0; font-size: 13px; color: var(--muted, #94a3b8); }
.rl__note { margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 14px; background: var(--surface, #1e293b); }
.rl__note--warn { border: 1px solid var(--warn, #f59e0b); }
.rl__note--error { border: 1px solid #ef4444; }
</style>
