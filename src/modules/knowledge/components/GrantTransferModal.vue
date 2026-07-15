<!--
  GrantTransferModal — передача копій уроків іншому тьютору (Варіант A, 2026-07).
  UX v2 (фідбек власника: «незрозуміло пересічному»): пояснення «як працює» у 3 кроки;
  список показує ВСІ уроки (чернетки disabled з підказкою «опублікуйте»);
  налаштування сховані за «Додатково»; без жаргону «пак/активація» у видимих текстах.
  BE: knowledge/grants/* · ТЗ: LESSON_GRANT_TZ_2026-07-14.md
-->
<template>
  <div class="grant-modal__backdrop" @click.self="$emit('close')">
    <div class="grant-modal">
      <header class="grant-modal__head">
        <h2 class="grant-modal__title">{{ $t('knowledge.grants.title') }}</h2>
        <button type="button" class="grant-modal__close" @click="$emit('close')">✕</button>
      </header>

      <div class="grant-modal__tabs">
        <button
          type="button"
          :class="['grant-modal__tab', { 'is-active': tab === 'create' }]"
          @click="tab = 'create'"
        >{{ $t('knowledge.grants.tabCreate') }}</button>
        <button
          type="button"
          :class="['grant-modal__tab', { 'is-active': tab === 'list' }]"
          @click="switchToList"
        >{{ $t('knowledge.grants.tabMyCodes') }}</button>
      </div>

      <!-- ── Таб: Передати уроки ─────────────────────────────────── -->
      <div v-if="tab === 'create'" class="grant-modal__body">
        <template v-if="!createdGrant">
          <!-- Як це працює: 3 кроки -->
          <ol class="grant-modal__steps">
            <li class="grant-modal__step">
              <span class="grant-modal__step-num">1</span>
              {{ $t('knowledge.grants.step1') }}
            </li>
            <li class="grant-modal__step">
              <span class="grant-modal__step-num">2</span>
              {{ $t('knowledge.grants.step2') }}
            </li>
            <li class="grant-modal__step">
              <span class="grant-modal__step-num">3</span>
              {{ $t('knowledge.grants.step3') }}
            </li>
          </ol>

          <div v-if="loadingLessons" class="grant-modal__muted">{{ $t('common.loading') }}</div>

          <!-- Уроків взагалі нема -->
          <div v-else-if="allLessons.length === 0" class="grant-modal__muted">
            {{ $t('knowledge.grants.noLessonsAtAll') }}
          </div>

          <template v-else>
            <!-- ВСІ збережені уроки вибираються (публікація НЕ потрібна —
                 рішення власника 2026-07-15: public і так видно всім у каталозі) -->
            <ul class="grant-modal__lessons">
              <li v-for="l in sortedLessons" :key="l.id">
                <label class="grant-modal__lesson">
                  <input v-model="selectedIds" type="checkbox" :value="l.id" />
                  <span class="grant-modal__lesson-title">{{ l.title }}</span>
                  <span v-if="l.status === 'public'" class="grant-modal__badge grant-modal__badge--ok">
                    {{ $t('knowledge.grants.badgePublished') }}
                  </span>
                  <span v-else class="grant-modal__badge">
                    {{ $t('knowledge.grants.badgeDraft') }}
                  </span>
                </label>
              </li>
            </ul>

            <!-- Додатково (згорнуто; розумні дефолти) -->
            <button type="button" class="grant-modal__adv-toggle" @click="showAdvanced = !showAdvanced">
              {{ showAdvanced ? '▾' : '▸' }} {{ $t('knowledge.grants.advanced') }}
            </button>
            <div v-if="showAdvanced" class="grant-modal__opts">
              <label class="grant-modal__opt">
                <span>{{ $t('knowledge.grants.maxUses') }}</span>
                <select v-model.number="maxUses">
                  <option :value="1">1</option>
                  <option :value="5">5</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                </select>
                <small class="grant-modal__opt-hint">{{ $t('knowledge.grants.maxUsesHint') }}</small>
              </label>
              <label class="grant-modal__opt">
                <span>{{ $t('knowledge.grants.expires') }}</span>
                <select v-model="expiresDays">
                  <option :value="null">{{ $t('knowledge.grants.noExpiry') }}</option>
                  <option :value="7">7 {{ $t('knowledge.grants.days') }}</option>
                  <option :value="30">30 {{ $t('knowledge.grants.days') }}</option>
                  <option :value="90">90 {{ $t('knowledge.grants.days') }}</option>
                </select>
              </label>
            </div>

            <p v-if="error" class="grant-modal__error">{{ error }}</p>
            <button
              type="button"
              class="grant-modal__primary"
              :disabled="selectedIds.length === 0 || creating"
              @click="onCreate"
            >
              {{ creating
                ? $t('common.loading')
                : selectedIds.length === 0
                  ? $t('knowledge.grants.createBtnEmpty')
                  : $t('knowledge.grants.createBtn', { n: selectedIds.length }) }}
            </button>
          </template>
        </template>

        <!-- Результат: посилання готове -->
        <template v-else>
          <div class="grant-modal__result">
            <div class="grant-modal__result-icon">🎉</div>
            <p class="grant-modal__result-label">{{ $t('knowledge.grants.codeReady') }}</p>
            <div class="grant-modal__code">{{ createdGrant.code }}</div>
            <button type="button" class="grant-modal__copy" @click="copy(activationUrl(createdGrant))">
              {{ copied ? $t('knowledge.grants.copied') : $t('knowledge.grants.copyLink') }}
            </button>
            <div class="grant-modal__how">
              <p class="grant-modal__how-title">{{ $t('knowledge.grants.buyerHowTitle') }}</p>
              <p class="grant-modal__how-text">{{ $t('knowledge.grants.buyerHowText') }}</p>
            </div>
            <button type="button" class="grant-modal__secondary" @click="resetCreate">
              {{ $t('knowledge.grants.createAnother') }}
            </button>
          </div>
        </template>
      </div>

      <!-- ── Таб: Мої коди ─────────────────────────────────────── -->
      <div v-else class="grant-modal__body">
        <div v-if="loadingGrants" class="grant-modal__muted">{{ $t('common.loading') }}</div>
        <div v-else-if="grants.length === 0" class="grant-modal__muted">
          {{ $t('knowledge.grants.noCodes') }}
        </div>
        <ul v-else class="grant-modal__grants">
          <li v-for="g in grants" :key="g.id" class="grant-modal__grant" :class="{ 'is-revoked': g.revoked }">
            <div class="grant-modal__grant-row">
              <code class="grant-modal__grant-code">{{ g.code }}</code>
              <span class="grant-modal__grant-uses" :title="$t('knowledge.grants.usesTitle')">
                {{ $t('knowledge.grants.usedOf', { used: g.used_count, max: g.max_uses }) }}
              </span>
            </div>
            <div class="grant-modal__grant-lessons">
              {{ g.lessons.map(l => l.title).join(' · ') }}
            </div>
            <div class="grant-modal__grant-actions">
              <span v-if="g.revoked" class="grant-modal__grant-revoked">{{ $t('knowledge.grants.revoked') }}</span>
              <template v-else>
                <button type="button" class="grant-modal__mini" @click="copy(activationUrl(g))">
                  {{ copied ? $t('knowledge.grants.copied') : $t('knowledge.grants.copyLink') }}
                </button>
                <button type="button" class="grant-modal__mini grant-modal__mini--danger" @click="onRevoke(g)">
                  {{ $t('knowledge.grants.revoke') }}
                </button>
              </template>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { grantsApi, type LessonGrant } from '../api/grantsApi'
import { lessonSaveApi, type MyLesson } from '../api/lessonSaveApi'

const props = withDefaults(
  defineProps<{
    /** Швидкий флоу з картки уроку: код уже створено → одразу екран результату. */
    initialGrant?: LessonGrant | null
  }>(),
  { initialGrant: null },
)
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const tab = ref<'create' | 'list'>('create')

/* створення */
const allLessons = ref<MyLesson[]>([])
const loadingLessons = ref(true)
const selectedIds = ref<string[]>([])
const showAdvanced = ref(false)
const maxUses = ref(20)
const expiresDays = ref<number | null>(null)
const creating = ref(false)
const createdGrant = ref<LessonGrant | null>(props.initialGrant ?? null)
const error = ref('')
const copied = ref(false)

/* список */
const grants = ref<LessonGrant[]>([])
const loadingGrants = ref(false)

const sortedLessons = computed(() =>
  [...allLessons.value].sort((a, b) =>
    (a.status === 'public' ? 0 : 1) - (b.status === 'public' ? 0 : 1)),
)

onMounted(async () => {
  try {
    allLessons.value = await lessonSaveApi.getMyLessons()
  } catch {
    allLessons.value = []
  } finally {
    loadingLessons.value = false
  }
})

function activationUrl(g: LessonGrant): string {
  return `${window.location.origin}/grant/${g.code}`
}

async function onCreate() {
  if (selectedIds.value.length === 0 || creating.value) return
  creating.value = true
  error.value = ''
  try {
    createdGrant.value = await grantsApi.create({
      lesson_ids: selectedIds.value,
      max_uses: maxUses.value,
      expires_days: expiresDays.value,
    })
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; detail?: string }
    error.value = err?.response?.data?.detail || err?.detail || t('knowledge.grants.createError')
  } finally {
    creating.value = false
  }
}

function resetCreate() {
  createdGrant.value = null
  selectedIds.value = []
  copied.value = false
}

async function switchToList() {
  tab.value = 'list'
  loadingGrants.value = true
  try {
    grants.value = await grantsApi.list()
  } catch {
    grants.value = []
  } finally {
    loadingGrants.value = false
  }
}

async function onRevoke(g: LessonGrant) {
  try {
    const updated = await grantsApi.revoke(g.id)
    const idx = grants.value.findIndex(x => x.id === g.id)
    if (idx >= 0) grants.value[idx] = updated
  } catch { /* список перезавантажиться при наступному відкритті */ }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } catch { /* clipboard заблоковано — юзер скопіює вручну з поля коду */ }
}

void emit
</script>

<style scoped>
.grant-modal__backdrop {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.grant-modal {
  background: #fff; border-radius: 14px; width: 580px; max-width: 100%;
  max-height: 88vh; overflow-y: auto; padding: 20px 22px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
.grant-modal__head { display: flex; align-items: center; justify-content: space-between; }
.grant-modal__title { font-size: 18px; font-weight: 700; color: #0f172a; }
.grant-modal__close { border: none; background: none; font-size: 16px; color: #94a3b8; cursor: pointer; }
.grant-modal__tabs { display: flex; gap: 4px; border-bottom: 1px solid #e2e8f0; margin: 10px 0 14px; }
.grant-modal__tab {
  padding: 7px 14px; font-size: 13px; font-weight: 600; color: #64748b;
  border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.grant-modal__tab.is-active { color: #047857; border-bottom-color: #047857; }

/* 3 кроки */
.grant-modal__steps {
  list-style: none; margin: 0 0 14px; padding: 12px 14px;
  background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;
  display: flex; flex-direction: column; gap: 8px;
}
.grant-modal__step { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #166534; }
.grant-modal__step-num {
  flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
  background: #047857; color: #fff; font-size: 11px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center;
}

.grant-modal__muted { font-size: 13px; color: #94a3b8; padding: 12px 0; }
.grant-modal__lessons { list-style: none; margin: 0 0 8px; padding: 0; max-height: 230px; overflow-y: auto; }
.grant-modal__lesson {
  display: flex; align-items: center; gap: 8px; padding: 8px 8px;
  border-radius: 8px; cursor: pointer; font-size: 13px;
}
.grant-modal__lesson:hover { background: #f0fdf4; }
.grant-modal__lesson.is-disabled { cursor: default; opacity: 0.55; }
.grant-modal__lesson.is-disabled:hover { background: none; }
.grant-modal__lesson-title { flex: 1; font-weight: 500; color: #0f172a; }
.grant-modal__badge {
  font-size: 11px; padding: 1px 8px; border-radius: 9px;
  background: #f1f5f9; color: #64748b; flex-shrink: 0;
}
.grant-modal__badge--ok { background: #dcfce7; color: #166534; }
.grant-modal__drafts-hint { font-size: 12px; color: #92400e; background: #fffbeb; border-radius: 8px; padding: 8px 10px; margin: 0 0 10px; }
.grant-modal__adv-toggle {
  border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 600;
  color: #64748b; padding: 4px 0; margin-bottom: 4px;
}
.grant-modal__opts { display: flex; flex-direction: column; gap: 10px; margin: 6px 0 10px; }
.grant-modal__opt { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; flex-wrap: wrap; }
.grant-modal__opt select { border: 1px solid #cbd5e1; border-radius: 7px; padding: 4px 8px; font-size: 13px; }
.grant-modal__opt-hint { width: 100%; color: #94a3b8; font-size: 11px; }
.grant-modal__error { color: #dc2626; font-size: 12px; margin: 6px 0; }
.grant-modal__primary {
  width: 100%; padding: 11px; border: none; border-radius: 9px; cursor: pointer;
  background: #047857; color: #fff; font-weight: 600; font-size: 14px;
}
.grant-modal__primary:disabled { background: #94a3b8; cursor: not-allowed; }
.grant-modal__secondary {
  margin-top: 12px; padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px;
  background: #fff; color: #334155; font-size: 13px; cursor: pointer;
}
.grant-modal__result { text-align: center; padding: 8px 0; }
.grant-modal__result-icon { font-size: 34px; }
.grant-modal__result-label { font-size: 14px; font-weight: 600; color: #0f172a; margin: 6px 0 2px; }
.grant-modal__code {
  font-family: ui-monospace, monospace; font-size: 22px; font-weight: 700;
  color: #047857; letter-spacing: 1px; margin: 10px 0;
}
.grant-modal__copy {
  padding: 10px 20px; border: none; border-radius: 9px; cursor: pointer;
  background: #047857; color: #fff; font-weight: 600; font-size: 14px;
}
.grant-modal__how {
  margin-top: 14px; padding: 10px 12px; text-align: left;
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
}
.grant-modal__how-title { font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px; }
.grant-modal__how-text { font-size: 12px; color: #64748b; }
.grant-modal__grants { list-style: none; margin: 0; padding: 0; }
.grant-modal__grant { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
.grant-modal__grant.is-revoked { opacity: 0.55; }
.grant-modal__grant-row { display: flex; align-items: center; justify-content: space-between; }
.grant-modal__grant-code { font-size: 14px; font-weight: 700; color: #047857; }
.grant-modal__grant-uses { font-size: 12px; font-weight: 600; color: #334155; }
.grant-modal__grant-lessons {
  font-size: 12px; color: #64748b; margin: 4px 0 6px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.grant-modal__grant-actions { display: flex; gap: 8px; }
.grant-modal__mini {
  font-size: 12px; padding: 4px 10px; border: 1px solid #cbd5e1; border-radius: 7px;
  background: #fff; color: #334155; cursor: pointer;
}
.grant-modal__mini--danger { color: #dc2626; border-color: #fca5a5; }
.grant-modal__grant-revoked { font-size: 12px; color: #dc2626; font-weight: 600; }
</style>
