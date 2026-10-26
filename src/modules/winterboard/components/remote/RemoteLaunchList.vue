<template>
  <section class="rl" data-testid="remote-launch" :aria-label="t('winterboard.remote.launch.title')">
    <h2 class="rl__title">{{ t('winterboard.remote.launch.title') }}</h2>
    <!-- П8: перед дотиком видно, ДЕ відкриється урок -->
    <p v-if="info" class="rl__where" :class="{ 'rl__where--none': !info.screen }" data-testid="remote-launch-where">
      {{ where }}
    </p>
    <ul v-if="info && info.boards.length" class="rl__list">
      <li v-for="board in info.boards" :key="board.id">
        <button
          type="button"
          class="rl__item"
          :class="{ 'rl__item--busy': busyId === board.id }"
          :disabled="busyId !== null"
          :data-testid="`remote-launch-${board.id}`"
          @click="start(board)"
        >
          <span class="rl__name">{{ board.name || t('winterboard.remote.launch.untitled') }}</span>
          <span v-if="busyId === board.id" class="rl__date">{{ t('winterboard.remote.launch.opening') }}</span>
          <span v-else-if="board.updated_at" class="rl__date">{{ shortDate(board.updated_at) }}</span>
        </button>
      </li>
    </ul>
    <p v-else-if="info" class="rl__empty">{{ t('winterboard.remote.launch.empty') }}</p>
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
 * `noActiveBoard`). Останні уроки Студії; дотик просить сервер відкрити урок на
 * комп'ютері, якого торкались останнім, і до 10 с чекає, поки дошка там відкриється
 * (`remote/active/`), — тоді батько підключається як звичайно. Пульт нічого не пише.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { winterboardApi } from '../../api/winterboardApi'
import type { RemoteLaunchBoard, RemoteLaunchInfo } from '../../api/winterboardApi'

const LAUNCH_WAIT_TRIES = 10          // до 10 с чекаємо, поки комп'ютер відкриє урок
const LAUNCH_WAIT_STEP_MS = 1000

const emit = defineEmits<{ (e: 'opened'): void }>()
const { t, te, locale } = useI18n()

const info = ref<RemoteLaunchInfo | null>(null)
const busyId = ref<string | null>(null)
const note = ref<{ tone: 'warn' | 'error'; text: string } | null>(null)
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

/** Чи відкрилась дошка на комп'ютері: true — так; false — не за 10 с; null — помилка сервера. */
async function waitForBoard(id: string): Promise<boolean | null> {
  for (let i = 0; i < LAUNCH_WAIT_TRIES; i += 1) {
    await sleep(LAUNCH_WAIT_STEP_MS)
    if (!alive) return false
    try {
      const active = await winterboardApi.getActiveRemoteSession()
      if (active.session_id === id) return true
    } catch (err) {
      // 404 — комп'ютер ще відкриває; без відповіді (мережа) — чекаємо далі; інша — зупинка
      const status = statusOf(err)
      if (status !== null && status !== 404) return null
    }
  }
  return false
}

async function start(board: RemoteLaunchBoard): Promise<void> {
  if (busyId.value) return
  busyId.value = board.id
  note.value = null
  try {
    const sentTo = await winterboardApi.remoteLaunch(board.id)
    // рядок «де» — туди, куди сервер справді надіслав (учитель міг клацнути на іншому комп'ютері)
    if (info.value) info.value = { ...info.value, screen: { page: sentTo?.page ?? null } }
    const opened = await waitForBoard(board.id)
    if (opened) emit('opened')
    else note.value = {
      tone: opened === false ? 'warn' : 'error',
      text: t(opened === false ? 'winterboard.remote.launch.notOpened' : 'winterboard.remote.launch.failed'),
    }
  } catch (err) {
    const code = errorOf(err)
    if (code === 'board_open') {
      emit('opened')                 // десь уже відкрита дошка — батько підключиться до неї
    } else if (code === 'no_screen') {
      if (info.value) info.value = { ...info.value, screen: null }
      note.value = { tone: 'warn', text: t('winterboard.remote.launch.noScreen') }
    } else if (statusOf(err) === 404) {
      note.value = { tone: 'warn', text: t('winterboard.remote.launch.gone') }
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
.rl__item--busy, .rl__item--busy:disabled { opacity: 1; background: #1e3a8a; }
.rl__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.rl__date { flex: none; font-size: 12px; color: var(--muted, #94a3b8); }
.rl__item--busy .rl__date { color: #fff; }
.rl__empty { margin: 0; font-size: 13px; color: var(--muted, #94a3b8); }
.rl__note { margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 14px; background: var(--surface, #1e293b); }
.rl__note--warn { border: 1px solid var(--warn, #f59e0b); }
.rl__note--error { border: 1px solid #ef4444; }
</style>
