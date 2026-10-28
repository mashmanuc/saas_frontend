<template>
  <div class="lpw" data-testid="lp-workspace">
    <RouterLink :to="{ name: 'learning-programs' }" class="lpw__back">← {{ t('learningPrograms.list.title') }}</RouterLink>

    <p v-if="loading && !p" class="lpw__muted">{{ t('loader.loading') }}</p>
    <p v-else-if="notFound" class="lpw__muted">{{ t('learningPrograms.errors.notFound') }}</p>
    <p v-else-if="failed && !p" class="lpw__error" role="alert">{{ t('learningPrograms.errors.load') }}</p>

    <template v-if="p">
      <header class="lpw__head">
        <div class="lpw__who">
          <h1 class="lpw__learner" data-testid="lp-learner">{{ learnerName }}</h1>
          <p class="lpw__title">{{ p.title }}</p>
        </div>
        <div class="lpw__head-actions">
          <Button variant="secondary" data-testid="lp-show-learner" @click="showLearner">{{ t('learningPrograms.workspace.showLearner') }}</Button>
        </div>
      </header>
      <p v-if="notice" class="lpw__notice" role="status">{{ notice }}</p>

      <section class="lpw__settings">
        <div class="lpw__setting">
          <span class="lpw__k">{{ t('learningPrograms.workspace.level') }}</span>
          <div class="lpw__levels">
            <button v-for="n in 5" :key="n" type="button" class="lpw__level" :class="{ 'lpw__level--on': p.level?.ordinal === n }"
                    :disabled="saving" :aria-pressed="p.level?.ordinal === n" @click="changeLevel(n)">{{ n }}</button>
          </div>
        </div>
        <div class="lpw__setting">
          <span class="lpw__k">{{ t('learningPrograms.workspace.pace') }}</span>
          <select class="lpw__select" :value="p.pace" :disabled="saving" data-testid="lp-pace" @change="changePace(($event.target as HTMLSelectElement).value)">
            <option v-for="v in PACES" :key="v" :value="v">{{ t(`learningPrograms.pace.${v.replace('.', '_')}`) }}</option>
          </select>
        </div>
      </section>

      <section class="lpw__three">
        <article class="lpw__card">
          <h2 class="lpw__h">{{ t('learningPrograms.workspace.last') }}</h2>
          <template v-if="p.summary.last">
            <p class="lpw__lesson">{{ p.summary.last.title }}</p>
            <p class="lpw__muted">{{ formatWhen(p.summary.last.occurred_at) }} · {{ lastResult }}</p>
          </template>
          <p v-else class="lpw__muted">{{ t('learningPrograms.workspace.noLast') }}</p>
        </article>

        <article class="lpw__card lpw__card--today">
          <h2 class="lpw__h">{{ t('learningPrograms.workspace.today') }}</h2>
          <template v-if="today">
            <p class="lpw__lesson" data-testid="lp-today">{{ today.title }}</p>
            <p v-if="today.credit_state === 'repeat_needed'" class="lpw__tag">{{ t('learningPrograms.lesson.repeatNeeded') }}</p>
            <div class="lpw__actions">
              <Button v-if="materialRoute(today.material?.open)" size="sm" data-testid="lp-today-open" @click="openMaterial(today)">
                {{ t('learningPrograms.lesson.open') }}
              </Button>
              <Button v-if="today.unit_refs?.length" size="sm" :variant="today.material ? 'ghost' : 'primary'" data-testid="lp-today-prepare" @click="prepare(today)">
                {{ today.material ? t('learningPrograms.lesson.prepareAgain') : t('learningPrograms.lesson.prepare') }}
              </Button>
            </div>
            <LessonOutcomeActions :key="today.lesson_id" :program="p" :lesson="today" @changed="reload" />
          </template>
          <p v-else class="lpw__muted">{{ t('learningPrograms.workspace.allDone') }}</p>
        </article>

        <article class="lpw__card">
          <h2 class="lpw__h">{{ t('learningPrograms.workspace.next') }}</h2>
          <ol v-if="p.summary.next.length" class="lpw__nextlist">
            <li v-for="n in p.summary.next" :key="n.lesson_id">{{ n.title }}</li>
          </ol>
          <p v-else class="lpw__muted">{{ t('learningPrograms.workspace.noNext') }}</p>
        </article>
      </section>

      <section class="lpw__plan">
        <h2 class="lpw__h">{{ t('learningPrograms.workspace.plan') }}</h2>
        <div v-for="item in p.items" :key="item.item_id" class="lpw__item" :class="`lpw__item--${item.state}`">
          <div class="lpw__item-head">
            <span class="lpw__item-title">{{ item.title }}</span>
            <Badge :variant="itemBadge(item.state)">{{ t(`learningPrograms.itemState.${item.state}`) }}</Badge>
          </div>
          <ul v-if="lessonsOf(item.item_id).length" class="lpw__lessons">
            <li v-for="l in lessonsOf(item.item_id)" :key="l.lesson_id" class="lpw__row" data-testid="lp-lesson-row">
              <span class="lpw__pos">{{ l.position }}</span>
              <span class="lpw__ltitle">{{ l.title }}</span>
              <span class="lpw__state" :class="`lpw__state--${l.credit_state}`">{{ t(`learningPrograms.credit.${l.credit_state}`) }}</span>
              <span class="lpw__row-actions">
                <button v-if="materialRoute(l.material?.open)" type="button" class="lpw__link" @click="openMaterial(l)">{{ t('learningPrograms.lesson.open') }}</button>
                <button v-if="l.credit_state !== 'credited' && l.unit_refs?.length" type="button" class="lpw__link" @click="prepare(l)">
                  {{ l.material ? t('learningPrograms.lesson.prepareAgain') : t('learningPrograms.lesson.prepare') }}
                </button>
              </span>
            </li>
          </ul>
          <p v-else-if="item.state === 'skipped' || item.deferred_reason_key" class="lpw__muted lpw__small">
            {{ item.state === 'skipped' ? t('learningPrograms.itemState.skippedHint') : t('learningPrograms.itemState.deferredHint') }}
          </p>
        </div>
      </section>
    </template>

    <PrepareLessonDialog :open="!!preparing" :program="p" :lesson="preparing" @close="preparing = null" @prepared="reload" />
  </div>
</template>

<script setup lang="ts">
/**
 * Робочий екран програми учня (ТЗ §5.2): «що було → що сьогодні → що далі», повна структура тем (пропущені й
 * відкладені не зникають), підготовка заняття генератором, відкриття готового уроку, підсумок за дві дії,
 * «Ще раз» як явна пропозиція повторення, рівень і темп через пропозиції з `expected_revision`.
 * Стара вкладка (409) — тихе оновлення з повідомленням, без перезапису чужих змін.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import LessonOutcomeActions from '../components/LessonOutcomeActions.vue'
import PrepareLessonDialog from '../components/PrepareLessonDialog.vue'
import {
  bodies, learningProgramsApi, errorCode, errorStatus, materialRoute, type ProgramDetail, type ProgramLesson,
} from '../api/learningProgramsApi'
import { answered, createIntent, latestOnly } from '../intent'

const PACES = ['0.50', '0.75', '1.00', '1.25', '1.50', '2.00']
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n({ useScope: 'global' })

const p = ref<ProgramDetail | null>(null)
const loading = ref(true)
const failed = ref(false)
const notFound = ref(false)
const saving = ref(false)
const notice = ref('')
const preparing = ref<ProgramLesson | null>(null)

const id = computed(() => String(route.params.id))
const learnerName = computed(() => {
  const parts = p.value?.target.participants.filter((x) => !x.left_at) ?? []
  return parts.map((x) => x.learner.display_name).join(', ') || t('learningPrograms.list.group')
})
const today = computed(() => {
  const tid = p.value?.summary.today?.lesson_id
  return tid ? p.value?.lessons.find((l) => l.lesson_id === tid) ?? null : null
})
const lastResult = computed(() => {
  const last = p.value?.summary.last
  if (!last) return ''
  if (last.attendance !== 'held') return t('learningPrograms.outcome.savedNotHeld')
  return last.pedagogical_action === 'repeat' ? t('learningPrograms.outcome.savedRepeat') : t('learningPrograms.outcome.savedNext')
})

function lessonsOf(itemId: string) {
  return p.value?.lessons.filter((l) => l.item_id === itemId) ?? []
}

function itemBadge(state: string) {
  return ({ done: 'success', in_progress: 'warning', skipped: 'muted', deferred: 'muted' } as Record<string, string>)[state] ?? 'default'
}

// Лише відповідь для поточної адреси оновлює екран: запізніла відповідь іншої програми відкидається (review F4).
const loads = latestOnly()
async function reload() {
  const token = loads.start()
  const target = id.value
  loading.value = true
  failed.value = false
  notFound.value = false
  if (p.value && p.value.id !== target) p.value = null
  try {
    const fresh = await learningProgramsApi.detail(target)
    if (loads.isCurrent(token)) p.value = fresh
  } catch (e) {
    if (!loads.isCurrent(token)) return
    if (errorStatus(e) === 404) notFound.value = true
    else failed.value = true
  } finally {
    if (loads.isCurrent(token)) loading.value = false
  }
}

// Одна зміна плану — один ключ, поки сервер не відповів (review F3).
const planIntent = createIntent<object>()
async function propose(sig: string, build: () => object) {
  if (!p.value || saving.value) return
  saving.value = true
  notice.value = ''
  const intent = planIntent.take(sig, build)
  try {
    await learningProgramsApi.sendProposal(p.value.id, intent.body, intent.key)
    planIntent.settle(intent)
  } catch (e) {
    planIntent.settle(intent, e)
    notice.value = !answered(e) ? t('learningPrograms.errors.noAnswer')
      : errorCode(e) === 'revision_conflict' ? t('learningPrograms.errors.revisionConflict') : t('learningPrograms.errors.generic')
  } finally {
    saving.value = false
    await reload()
  }
}

function changeLevel(n: number) {
  if (!p.value || p.value.level?.ordinal === n) return
  const cur = p.value
  propose(`${cur.id}:level:${n}`, () => bodies.setLevel(cur, n))
}

function changePace(v: string) {
  if (!p.value || p.value.pace === v) return
  const cur = p.value
  propose(`${cur.id}:pace:${v}`, () => bodies.setPace(cur, v))
}

function prepare(l: ProgramLesson) {
  preparing.value = l
}

function openMaterial(l: ProgramLesson) {
  const target = materialRoute(l.material?.open)
  if (target) router.push(target)
}

function showLearner() {
  const href = router.resolve({ name: 'learning-program-learner', params: { id: id.value } }).href
  window.open(href, '_blank', 'noopener')
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(locale.value === 'uk' ? 'uk-UA' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

watch(id, reload)
onMounted(reload)
</script>

<style scoped>
.lpw { display: flex; flex-direction: column; gap: 18px; }
.lpw__back { color: var(--text-secondary); text-decoration: none; font-size: var(--text-sm); }
.lpw__head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
.lpw__learner { margin: 0; font-size: var(--text-2xl); color: var(--text-primary); }
.lpw__title { margin: 4px 0 0; color: var(--text-secondary); }
.lpw__notice { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--info-bg); color: var(--text-primary); }
.lpw__settings { display: flex; gap: 28px; flex-wrap: wrap; align-items: center; }
.lpw__setting { display: flex; gap: 10px; align-items: center; }
.lpw__k { font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.lpw__levels { display: flex; gap: 6px; }
.lpw__level {
  width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);
  background: var(--card-bg); font-weight: 600; cursor: pointer; color: var(--text-primary);
}
.lpw__level--on { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
.lpw__select { padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); }
.lpw__three { display: grid; gap: 14px; grid-template-columns: 1fr 1.4fr 1fr; }
@media (max-width: 900px) { .lpw__three { grid-template-columns: 1fr; } }
.lpw__card {
  padding: 16px; border-radius: var(--radius-lg); border: 1px solid var(--border-color);
  background: var(--surface-card, var(--card-bg)); display: flex; flex-direction: column; gap: 10px;
}
.lpw__card--today { border-color: var(--accent); }
.lpw__h { margin: 0; font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.lpw__lesson { margin: 0; font-weight: 700; color: var(--text-primary); font-size: var(--text-lg); }
.lpw__tag { margin: 0; color: var(--ui-color-danger); font-size: var(--text-sm); }
.lpw__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.lpw__muted { margin: 0; color: var(--text-secondary); }
.lpw__small { font-size: var(--text-sm); }
.lpw__error { color: var(--ui-color-danger); }
.lpw__nextlist { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; color: var(--text-primary); }
.lpw__plan { display: flex; flex-direction: column; gap: 10px; }
.lpw__item { border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 12px; background: var(--card-bg); }
.lpw__item--skipped { opacity: 0.6; }
.lpw__item-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
.lpw__item-title { font-weight: 600; color: var(--text-primary); }
.lpw__lessons { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.lpw__row { display: grid; grid-template-columns: 28px 1fr auto auto; gap: 10px; align-items: center; font-size: var(--text-sm); padding: 4px 0; }
@media (max-width: 640px) { .lpw__row { grid-template-columns: 24px 1fr; } .lpw__state, .lpw__row-actions { grid-column: 2; } }
.lpw__pos { color: var(--text-muted); text-align: right; }
.lpw__ltitle { color: var(--text-primary); }
.lpw__state { color: var(--text-secondary); }
.lpw__state--credited { color: var(--ui-color-success); }
.lpw__state--repeat_needed { color: var(--ui-color-danger); }
.lpw__row-actions { display: flex; gap: 10px; }
.lpw__link { background: none; border: 0; padding: 0; color: var(--accent); cursor: pointer; font: inherit; }
</style>
