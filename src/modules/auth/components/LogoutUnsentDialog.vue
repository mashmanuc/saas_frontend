<!--
  «Є незбережені дії» перед виходом (ТЗ «Сесія спільного екрана і безпечний вихід», R7).

  Вихід сам нічого не видаляє. Для кожної дошки — чи можна ще надіслати її зміни:
  - дошка є на сервері — лише «Відкрити дошку»: черга відправиться штатно
    (SYSTEM_LAW §5), а відмову сервера дошка покаже своїм банером SAVE_BLOCKED;
  - дошки немає або до неї немає доступу (400/403/404/410) чи сервер недоступний —
    надіслати нікуди: «Завантажити копію» (LAW §4), потім явне відкидання з числом дій
    (§6.4 ТЗ).
  «Вийти все одно» — лише коли надіслати нікуди жодну з перелічених дошок: відкидання
  прибирає копії всіх, тож дошку, яку ще можна зберегти, спершу треба відкрити.
  На спільному комп'ютері це важливо в обидва боки: не загубити роботу і не лишити
  її наступній людині.
-->
<template>
  <div
    v-if="guard.open"
    class="logout-unsent__overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="t('auth.logoutGuard.title')"
    data-testid="logout-unsent-dialog"
  >
    <div class="logout-unsent">
      <h2 class="logout-unsent__title">{{ t('auth.logoutGuard.title') }}</h2>
      <p class="logout-unsent__lead">{{ t('auth.logoutGuard.lead') }}</p>

      <ul class="logout-unsent__list">
        <li v-for="board in guard.work" :key="board.sessionId" class="logout-unsent__item">
          <div class="logout-unsent__board">
            <span class="logout-unsent__name">{{ boardName(board.sessionId) }}</span>
            <span class="logout-unsent__count">
              {{ board.unreadable && board.ops === 0
                ? t('auth.logoutGuard.unknownCount')
                : t('auth.logoutGuard.count', { n: board.ops }) }}
              <template v-if="board.blocked"> · {{ t('auth.logoutGuard.blocked') }}</template>
              <template v-if="linkOf(board.sessionId) === 'gone'"> · {{ t('auth.logoutGuard.boardGone') }}</template>
              <template v-if="board.liveUnsaved"> · {{ t('auth.logoutGuard.notSaved') }}</template>
            </span>
          </div>
          <div class="logout-unsent__board-actions">
            <button
              v-if="unsendable(board.sessionId)"
              type="button"
              class="logout-unsent__download"
              data-testid="logout-unsent-download"
              @click="downloadCopy(board)"
            >{{ t('auth.logoutGuard.download') }}</button>
            <button
              v-if="linkOf(board.sessionId) !== 'gone'"
              type="button"
              class="logout-unsent__open"
              data-testid="logout-unsent-open"
              @click="openBoard(board.sessionId)"
            >{{ t('auth.logoutGuard.openBoard') }}</button>
          </div>
        </li>
      </ul>

      <p class="logout-unsent__status" data-testid="logout-unsent-status">{{ statusText }}</p>

      <p v-if="confirming" class="logout-unsent__warning" data-testid="logout-unsent-warning">
        {{ t('auth.logoutGuard.discardWarning', { n: total }) }}
      </p>

      <div class="logout-unsent__actions">
        <button type="button" class="logout-unsent__cancel" @click="cancel">
          {{ t('auth.logoutGuard.cancel') }}
        </button>
        <button
          v-if="canDiscard && !confirming"
          type="button"
          class="logout-unsent__discard"
          data-testid="logout-unsent-discard"
          @click="confirming = true"
        >{{ t('auth.logoutGuard.logoutAnyway') }}</button>
        <button
          v-else-if="canDiscard"
          type="button"
          class="logout-unsent__discard"
          data-testid="logout-unsent-confirm"
          :disabled="busy"
          @click="discardAndLogout"
        >{{ t('auth.logoutGuard.confirmDiscard', { n: total }) }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/authStore'
import { useLogoutGuardStore } from '../store/logoutGuardStore'
import { exportUnsentBoard, totalUnsentOps, type UnsentBoardWork } from '../logout/unsentWork'
import { winterboardApi } from '@/modules/winterboard/api/winterboardApi'

/**
 * Чи можна ще надіслати зміни дошки:
 * - `ok` — дошка є, сервер відповідає (зокрема 429 — він живий);
 * - `gone` — дошки немає або доступу немає (400/403/404/410): надіслати нікуди;
 * - `offline` — жодної відповіді або 5xx (і відкритий circuit breaker клієнта).
 */
type BoardLink = 'checking' | 'ok' | 'gone' | 'offline'
const GONE_STATUSES = new Set([400, 403, 404, 410])

const { t } = useI18n()
const router = useRouter()
const guard = useLogoutGuardStore()
const auth = useAuthStore()

const confirming = ref(false)
const busy = ref(false)
const names = ref<Record<string, string>>({})
const links = ref<Record<string, BoardLink>>({})
const total = computed(() => totalUnsentOps(guard.work))

function linkOf(sessionId: string): BoardLink {
  return links.value[sessionId] ?? 'checking'
}
const checking = computed(() => guard.work.some(board => linkOf(board.sessionId) === 'checking'))
/** Надіслати цю дошку нікуди — лише копія або відкидання. */
function unsendable(sessionId: string): boolean {
  const link = linkOf(sessionId)
  return link === 'gone' || link === 'offline'
}
/** Відкидання — лише коли надіслати нікуди ЖОДНУ з дошок (воно прибирає копії всіх). */
const canDiscard = computed(() =>
  !checking.value && guard.work.length > 0 && guard.work.every(board => unsendable(board.sessionId)))

const statusText = computed(() => {
  if (checking.value) return t('auth.logoutGuard.checking')
  if (!canDiscard.value) return t('auth.logoutGuard.sendFirst')
  return guard.work.some(board => linkOf(board.sessionId) === 'offline')
    ? t('auth.logoutGuard.offline')
    : t('auth.logoutGuard.gone')
})

function boardName(sessionId: string): string {
  return names.value[sessionId] || t('auth.logoutGuard.board', { id: sessionId.slice(0, 8) })
}

function classify(result: PromiseSettledResult<unknown>): BoardLink {
  if (result.status === 'fulfilled') return 'ok'
  const status = (result.reason as { response?: { status?: number } })?.response?.status
  if (typeof status !== 'number' || status >= 500) return 'offline'
  return GONE_STATUSES.has(status) ? 'gone' : 'ok'
}

// Назви дошок і водночас перевірка, чи їх ще можна надіслати. Усі дошки паралельно;
// результат застарілого циклу (закрили й відкрили знову) відкидається.
// immediate: діалог вантажиться ледаче (App.vue) і може змонтуватися вже відкритим.
let generation = 0
watch(() => guard.open, async (open) => {
  const run = ++generation
  confirming.value = false
  links.value = {}
  if (!open) return
  const boards = [...guard.work]
  const results = await Promise.allSettled(boards.map(board => winterboardApi.getSession(board.sessionId)))
  if (run !== generation || !guard.open) return
  const next: Record<string, BoardLink> = {}
  results.forEach((result, i) => {
    const sessionId = boards[i].sessionId
    next[sessionId] = classify(result)
    if (result.status === 'fulfilled') {
      const name = (result.value as { name?: string } | null)?.name
      if (name) names.value = { ...names.value, [sessionId]: name }
    } else {
      console.warn('[auth:logout] board check failed', sessionId, result.reason)
    }
  })
  links.value = next
}, { immediate: true })

function cancel() {
  guard.close()
}

/** Копія дій дошки у файл — перед відкиданням (LAW §4); нікуди не відправляється. */
function downloadCopy(board: UnsentBoardWork) {
  const data = exportUnsentBoard(board)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  a.href = url
  a.download = `m4sh-unsaved-${board.sessionId}-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function openBoard(sessionId: string) {
  guard.close()
  void router.push(`/winterboard/${sessionId}`)
}

async function discardAndLogout() {
  busy.value = true
  guard.close()
  try {
    await auth.logout({ discardUnsent: true })
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.logout-unsent__overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.55);
}
.logout-unsent {
  width: min(92vw, 460px);
  padding: 22px 24px;
  border-radius: 14px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}
.logout-unsent__title { margin: 0 0 6px; font-size: 18px; font-weight: 700; }
.logout-unsent__lead { margin: 0 0 14px; font-size: 14px; color: #475569; }
.logout-unsent__list { margin: 0 0 14px; padding: 0; list-style: none; }
.logout-unsent__item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 0; border-top: 1px solid #e2e8f0;
}
.logout-unsent__board { display: flex; flex-direction: column; min-width: 0; }
.logout-unsent__name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.logout-unsent__count { font-size: 13px; color: #64748b; }
.logout-unsent__board-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.logout-unsent__open,
.logout-unsent__download,
.logout-unsent__cancel {
  padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer;
}
.logout-unsent__status { margin: 0 0 12px; font-size: 14px; color: #334155; }
.logout-unsent__warning { margin: 0 0 12px; font-size: 14px; color: #b91c1c; }
.logout-unsent__actions { display: flex; justify-content: flex-end; gap: 8px; }
.logout-unsent__discard {
  padding: 6px 12px; border: 1px solid #fecaca; border-radius: 8px; background: #fef2f2;
  color: #b91c1c; cursor: pointer;
}
.logout-unsent__discard:disabled { opacity: 0.6; cursor: default; }
</style>
