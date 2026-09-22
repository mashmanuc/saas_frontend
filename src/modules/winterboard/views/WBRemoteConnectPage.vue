<template>
  <div class="wb-remote-connect">
    <!-- 1. Для чого -->
    <button type="button" class="wb-remote-connect__back" @click="goBack">
      {{ t('winterboard.remote.connectPage.back') }}
    </button>
    <header class="wb-remote-connect__head">
      <h1 class="wb-remote-connect__title">{{ t('winterboard.remote.connectPage.title') }}</h1>
      <p class="wb-remote-connect__lead">{{ t('winterboard.remote.connectPage.lead') }}</p>
    </header>

    <div class="wb-remote-connect__body">
      <!-- 2. Як підключити -->
      <section class="wb-remote-connect__card wb-remote-connect__card--qr">
        <RemoteQrBlock :size="220" />
      </section>

      <section class="wb-remote-connect__card">
        <h2 class="wb-remote-connect__subtitle">{{ t('winterboard.remote.connectPage.howTitle') }}</h2>
        <ol class="wb-remote-connect__steps">
          <li>{{ t('winterboard.remote.connectPage.step1') }}</li>
          <li>
            <template v-if="accountEmail">
              {{ t('winterboard.remote.connectPage.step2') }}
              <strong class="wb-remote-connect__email">{{ accountEmail }}</strong>
            </template>
            <template v-else>{{ t('winterboard.remote.connectPage.step2NoEmail') }}</template>
          </li>
          <li>{{ t('winterboard.remote.connectPage.step3') }}</li>
        </ol>

        <!-- 3. Стан дошки — той самий GET /remote/active/, яким пульт шукає дошку -->
        <h2 class="wb-remote-connect__subtitle">{{ t('winterboard.remote.connectPage.boardTitle') }}</h2>
        <p
          class="wb-remote-connect__board"
          :class="`wb-remote-connect__board--${board.kind}`"
          role="status"
        >
          {{ boardText }}
        </p>
        <RouterLink v-if="board.kind === 'none'" to="/knowledge/my-lessons" class="wb-remote-connect__lessons">
          {{ t('sidebar.item.myLessons') }}
        </RouterLink>

        <p class="wb-remote-connect__during">{{ t('winterboard.remote.connectPage.duringLesson') }}</p>
      </section>
    </div>

    <button type="button" class="wb-remote-connect__here" @click="emit('open-here')">
      {{ t('winterboard.remote.connectPage.openHere') }}
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * «Пульт для телефону» на комп'ютері (ТЗ Салюта TZ_REMOTE_DESKTOP_CONNECT_2026-09-22 §2.2).
 * Великий екран пояснює, як підключитись; сам пульт — на телефоні.
 *
 * Живого «Телефон підключено» тут свідомо НЕМАЄ: це знає лише вкладка дошки
 * (`useBoardRemote.lastRemoteSeenAt` з WS `remote.*`), а показати тут означало б
 * новий протокол. Стан дошки — при відкритті і коли вкладка знову видима;
 * без таймерів і повторів у циклі (LAW §12).
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { trackEvent } from '@/utils/telemetryAgent'
import { winterboardApi } from '../api/winterboardApi'
import RemoteQrBlock from '../components/remote/RemoteQrBlock.vue'

const emit = defineEmits<{ (e: 'open-here'): void }>()
const { t } = useI18n()
const router = useRouter()

/** «Назад» — звідки прийшов; з прямого заходу (QR, закладка) — на дошки. */
function goBack(): void {
  if (window.history.length > 1) router.back()
  else void router.push('/winterboard/boards')
}
const authStore = useAuthStore()
const accountEmail = computed(() => authStore.user?.email ?? '')

type BoardState =
  | { kind: 'checking' }
  | { kind: 'active'; name: string }
  | { kind: 'none' }
  | { kind: 'error' }
const board = ref<BoardState>({ kind: 'checking' })

const boardText = computed(() => {
  const b = board.value
  switch (b.kind) {
    case 'active':
      return b.name
        ? t('winterboard.remote.connectPage.boardActive', { name: b.name })
        : t('winterboard.remote.connectPage.boardActiveNoName')
    case 'none': return t('winterboard.remote.connectPage.boardNone')
    case 'error': return t('winterboard.remote.connectPage.boardError')
    default: return t('winterboard.remote.connectPage.boardChecking')
  }
})

let inflight = false
async function checkBoard(): Promise<void> {
  if (inflight) return
  inflight = true
  try {
    const r = await winterboardApi.getActiveRemoteSession()
    board.value = { kind: 'active', name: r.name || '' }
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status
    // 404 no_active_board — звичайний стан «урок ще не відкрито», не помилка.
    board.value = status === 404 ? { kind: 'none' } : { kind: 'error' }
  } finally {
    inflight = false
  }
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') void checkBoard()
}

onMounted(() => {
  try { trackEvent('wb.remote.connect_page', {}) } catch { /* телеметрія не критична */ }
  void checkBoard()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))
</script>

<style scoped>
.wb-remote-connect { max-width: 880px; margin: 0 auto; padding: 32px 16px 48px; color: #0f172a; }
.wb-remote-connect__back {
  background: none; border: 0; padding: 4px 0 12px;
  color: #475569; font-size: 14px; cursor: pointer;
}
.wb-remote-connect__head { margin-bottom: 20px; }
.wb-remote-connect__title { margin: 0 0 8px; font-size: 26px; font-weight: 800; }
.wb-remote-connect__lead { margin: 0; font-size: 16px; color: #475569; max-width: 640px; }
.wb-remote-connect__body { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start; }
.wb-remote-connect__card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 24px; }
.wb-remote-connect__card--qr { padding: 20px; }
.wb-remote-connect__subtitle { margin: 0 0 10px; font-size: 16px; font-weight: 700; }
.wb-remote-connect__subtitle + .wb-remote-connect__steps { margin-top: 0; }
.wb-remote-connect__steps { margin: 0 0 20px; padding-left: 22px; list-style: decimal; font-size: 15px; line-height: 1.55; }
.wb-remote-connect__steps li + li { margin-top: 6px; }
.wb-remote-connect__email { word-break: break-all; }
.wb-remote-connect__board { margin: 0 0 8px; font-size: 15px; font-weight: 600; }
.wb-remote-connect__board--active { color: #047857; }
.wb-remote-connect__board--none { color: #b45309; }
.wb-remote-connect__board--error { color: #b91c1c; }
.wb-remote-connect__board--checking { color: #64748b; font-weight: 400; }
.wb-remote-connect__lessons {
  display: inline-block; margin-bottom: 8px; padding: 8px 16px; border-radius: 10px;
  background: #0f172a; color: #fff; font-size: 14px; font-weight: 600; text-decoration: none;
}
.wb-remote-connect__during { margin: 12px 0 0; font-size: 13px; color: #64748b; }
.wb-remote-connect__here {
  display: block; margin: 20px auto 0; background: none; border: 0; padding: 4px;
  font-size: 13px; color: #64748b; text-decoration: underline; cursor: pointer;
}
@media (max-width: 720px) {
  .wb-remote-connect__body { grid-template-columns: 1fr; }
}
</style>
