<template>
  <section class="presence-now" :class="`presence-now--${state}`">
    <header class="presence-now__head">
      <!-- aria-live лише на вердикті: «Перевірено о …» кожні 30 с не зачитується -->
      <div class="presence-now__verdict" aria-live="polite">
        <span class="presence-now__dot" aria-hidden="true" />
        <strong v-if="state === 'empty'">{{ t('staff.presence.now.nobody') }}</strong>
        <strong v-else-if="state === 'confirming'">{{ t('staff.presence.now.confirming') }}</strong>
        <strong v-else-if="state === 'busy'">
          {{ t('staff.presence.now.busy', { people: data!.people_count, recordings: data!.recordings.length, guests: data!.guests }) }}
        </strong>
        <strong v-else-if="state === 'stale'">{{ t('staff.presence.now.stale') }}</strong>
        <strong v-else-if="state === 'failed'">{{ t('staff.presence.now.loadFailed') }}</strong>
        <strong v-else>{{ t('staff.presence.now.loading') }}</strong>
      </div>
      <div class="presence-now__meta">
        <span v-if="data">{{ t('staff.presence.now.checkedAt', { time: fmtTime(data.checked_at) }) }}</span>
        <button type="button" class="presence-now__refresh" :disabled="loading" @click="load">
          {{ t('staff.presence.now.refresh') }}
        </button>
      </div>
    </header>

    <div v-if="data && (state === 'busy' || state === 'stale')" class="presence-now__lists">
      <div v-if="data.boards.length" class="presence-now__group">
        <h4>{{ t('staff.presence.now.onBoards') }}</h4>
        <ul>
          <li v-for="b in data.boards" :key="b.board_id">
            <span class="presence-now__board">{{ b.name || t('staff.presence.now.untitledBoard') }}</span>
            <span v-for="m in b.members" :key="m.user_id" class="presence-now__person">
              <router-link :to="`/staff/users/${m.user_id}`">{{ m.name || m.email || `#${m.user_id}` }}</router-link>
              <small v-if="m.board_role">{{ m.board_role }}</small>
              <small v-if="m.is_staff" class="presence-now__staff-tag">staff</small>
            </span>
          </li>
        </ul>
      </div>
      <div v-if="data.in_app.length" class="presence-now__group">
        <h4>{{ t('staff.presence.now.inApp') }}</h4>
        <ul class="presence-now__inline">
          <li v-for="p in data.in_app" :key="p.user_id">
            <router-link :to="`/staff/users/${p.user_id}`">{{ p.name || p.email || `#${p.user_id}` }}</router-link>
          </li>
        </ul>
      </div>
      <div v-if="data.recordings.length" class="presence-now__group">
        <h4>{{ t('staff.presence.now.recordings') }}</h4>
        <ul class="presence-now__inline">
          <li v-for="r in data.recordings" :key="r.board_id">{{ r.name || t('staff.presence.now.untitledBoard') }}</li>
        </ul>
      </div>
      <p v-if="data.guests" class="presence-now__guests">{{ t('staff.presence.now.guests', { n: data.guests }) }}</p>
    </div>
    <p v-if="data?.staff_online?.length" class="presence-now__staff">
      {{ t('staff.presence.now.staffOnline', { names: data.staff_online.map(p => p.name || p.email).join(', ') }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
/**
 * «Зараз онлайн» на сторінці користувачів staff. Власник 2026-09-26: «щоб я міг
 * дивитися: якщо немає нікого — то пушити».
 *
 * Зелене «можна пушити» — лише після ДВОХ порожніх перевірок поспіль: закриття будь-
 * якої вкладки на ≤25 с знімає людину з реєстру застосунку, і одна перевірка могла
 * влучити в цю дірку. Збій і застаріла відповідь ніколи не показуються як «нікого»:
 * хибне «можна пушити» гірше за відсутню відповідь.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPresenceNow, type PresenceNow } from '@/modules/staff/api/staffPresenceApi'
import { activeLocale } from '@/utils/i18nDate'

const REFRESH_MS = 30_000
const CONFIRM_MS = 10_000        // друга перевірка після першої порожньої
const FAILURE_BACKOFF_MS = 120_000
const STALE_MS = 75_000

const { t } = useI18n()
const data = ref<PresenceNow | null>(null)
const loading = ref(false)
const failed = ref(false)
const emptyStreak = ref(0)
const lastOkAt = ref(0)
const clock = ref(Date.now())
let pollTimer: ReturnType<typeof setTimeout> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
let alive = true

const state = computed<'loading' | 'failed' | 'stale' | 'confirming' | 'empty' | 'busy'>(() => {
  if (failed.value) return 'failed'
  if (!data.value) return 'loading'
  if (clock.value - lastOkAt.value > STALE_MS) return 'stale'
  if (!data.value.nobody) return 'busy'
  return emptyStreak.value >= 2 ? 'empty' : 'confirming'
})

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(activeLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function schedule(ms: number): void {
  if (pollTimer) clearTimeout(pollTimer)
  if (alive) pollTimer = setTimeout(load, ms)
}

async function load(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const res = await getPresenceNow()
    if (!alive) return
    data.value = res
    failed.value = false
    lastOkAt.value = Date.now()
    clock.value = lastOkAt.value
    emptyStreak.value = res.nobody ? emptyStreak.value + 1 : 0
    schedule(res.nobody && emptyStreak.value < 2 ? CONFIRM_MS : REFRESH_MS)
  } catch (e) {
    if (!alive) return
    console.error('[staff] presence now load failed', e)
    failed.value = true
    emptyStreak.value = 0
    // Без спаму: наступна автоматична спроба за 2 хв (або кнопка «Оновити»).
    schedule(FAILURE_BACKOFF_MS)
  } finally {
    loading.value = false
  }
}

function onVisibility(): void {
  // Фонова вкладка гальмує таймери — повернувшись, власник не має бачити старе «нікого».
  if (document.visibilityState === 'visible') load()
}

onMounted(() => {
  load()
  clockTimer = setInterval(() => { clock.value = Date.now() }, 5_000)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  alive = false
  if (pollTimer) clearTimeout(pollTimer)
  if (clockTimer) clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.presence-now {
  border: 1px solid var(--border-color, #e2e8f0);
  border-left-width: 4px;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: var(--surface-card, #fff);
}
.presence-now--empty { border-left-color: #16a34a; }
.presence-now--busy { border-left-color: #d97706; }
.presence-now--confirming, .presence-now--stale, .presence-now--loading { border-left-color: #94a3b8; }
.presence-now--failed { border-left-color: #dc2626; }
.presence-now__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.presence-now__verdict { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.presence-now__dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.presence-now--empty .presence-now__verdict { color: #15803d; }
.presence-now--busy .presence-now__verdict { color: #b45309; }
.presence-now--failed .presence-now__verdict { color: #b91c1c; }
.presence-now__meta { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-secondary, #64748b); }
.presence-now__refresh {
  border: 1px solid var(--border-color, #e2e8f0); background: transparent; color: inherit; border-radius: 8px;
  padding: 4px 10px; font-size: 12px; cursor: pointer;
}
.presence-now__refresh:disabled { opacity: 0.5; cursor: default; }
.presence-now__lists { display: grid; gap: 10px; margin-top: 10px; }
.presence-now__group h4 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-secondary, #64748b); }
.presence-now__group ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 14px; }
.presence-now__inline { display: flex !important; flex-wrap: wrap; gap: 4px 14px !important; }
.presence-now__board { font-weight: 600; margin-right: 8px; }
.presence-now__person { margin-right: 10px; }
.presence-now__person small { margin-left: 4px; color: var(--text-secondary, #64748b); }
.presence-now__staff-tag { color: #b45309 !important; }
.presence-now__guests { margin: 0; font-size: 14px; }
.presence-now__staff { margin: 8px 0 0; font-size: 12px; color: var(--text-secondary, #64748b); }
</style>
