<template>
  <div class="lpw" data-testid="lp-workspace">
    <RouterLink :to="{ name: 'learning-programs' }" class="lpw__back">← {{ t('learningPrograms.list.title') }}</RouterLink>

    <p v-if="loading && !p" class="lpw__muted">{{ t('loader.loading') }}</p>
    <p v-else-if="notFound" class="lpw__muted">{{ t('learningPrograms.errors.notFound') }}</p>
    <p v-else-if="failed && !p" class="lpw__error" role="alert">{{ t('learningPrograms.errors.load') }}</p>

    <template v-if="p">
      <header class="lpw__head">
        <div>
          <h1 class="lpw__learner" data-testid="lp-learner">{{ learnerName }}</h1>
          <p class="lpw__title">{{ p.title }}</p>
        </div>
        <div class="lpw__head-actions">
          <Button variant="secondary" data-testid="lp-show-learner" @click="showLearner">{{ t('learningPrograms.workspace.showLearner') }}</Button>
          <Button variant="ghost" data-testid="lp-delete" @click="askDelete = true">{{ t('learningPrograms.workspace.deleteShort') }}</Button>
        </div>
      </header>
      <p v-if="notice" class="lpw__notice" role="status">{{ notice }}</p>
      <p v-if="returned" class="lpw__notice lpw__notice--back" role="status" data-testid="lp-reopened">
        <span>{{ t('learningPrograms.workspace.reopened', { title: returned.title }) }}</span>
        <button type="button" class="lpw__undo" :disabled="saving" data-testid="lp-reopen-undo" @click="undoReopen">
          {{ t('learningPrograms.workspace.reopenUndo') }}
        </button>
      </p>

      <!-- Загальний прогрес: смужка з відрізками-розділами, поруч рівень і темп -->
      <section class="lpw__prog">
        <div class="lpw__prog-num" data-testid="lp-progress">
          <b>{{ t('learningPrograms.workspace.count', { done: creditedCount, total: lessonCount }) }}</b>
          <small>{{ t('learningPrograms.workspace.lessonsDone') }}</small>
        </div>
        <div class="lpw__bar" aria-hidden="true">
          <span v-for="g in groups" :key="g.item.item_id" :style="{ flex: Math.max(g.lessons.length, 1) }" :title="g.item.title">
            <i :style="{ width: pct(g.done, g.lessons.length) }" />
          </span>
        </div>
        <div class="lpw__set">
          <span class="lpw__set-one">
            <span class="lpw__k">{{ t('learningPrograms.workspace.level') }}</span>
            <span class="lpw__levels">
              <button v-for="n in 5" :key="n" type="button" class="lpw__level" :class="{ 'lpw__level--on': p.level?.ordinal === n }"
                      :disabled="saving" :aria-pressed="p.level?.ordinal === n" @click="changeLevel(n)">{{ n }}</button>
            </span>
          </span>
          <span class="lpw__set-one">
            <span class="lpw__k">{{ t('learningPrograms.workspace.pace') }}</span>
            <select class="lpw__select" :value="p.pace" :disabled="saving" data-testid="lp-pace" @change="changePace(($event.target as HTMLSelectElement).value)">
              <option v-for="v in PACES" :key="v" :value="v">{{ t(`learningPrograms.pace.${v.replace('.', '_')}`) }}</option>
            </select>
          </span>
        </div>
      </section>

      <!-- Було → Сьогодні → Далі однією смужкою; одна головна дія; підсумок — окремим блоком -->
      <section class="lpw__today">
        <div class="lpw__flow">
          <div>
            <span class="lpw__lab">{{ t('learningPrograms.workspace.was') }}<template v-if="p.summary.last"> · {{ formatDay(p.summary.last.occurred_at) }}</template></span>
            <span class="lpw__t" :title="p.summary.last?.title">{{ p.summary.last ? `${lastMark} ${p.summary.last.title}` : t('learningPrograms.workspace.noLast') }}</span>
          </div>
          <span class="lpw__now">→ {{ t('learningPrograms.workspace.today') }} →</span>
          <div class="lpw__flow-next">
            <span class="lpw__lab">{{ t('learningPrograms.workspace.next') }}</span>
            <span class="lpw__t" :title="p.summary.next[0]?.title">{{ p.summary.next[0]?.title || t('learningPrograms.workspace.noNext') }}</span>
          </div>
        </div>
        <div v-if="today" class="lpw__t-body">
          <div class="lpw__t-main">
            <span class="lpw__grp">{{ t('learningPrograms.workspace.lessonOf', { n: today.position, total: lessonCount }) }}<template v-if="todayItem"> · {{ todayItem.title }}</template></span>
            <h2 class="lpw__t-title" data-testid="lp-today">{{ today.title }}</h2>
            <span v-if="today.credit_state === 'repeat_needed'" class="lpw__st lpw__st--rep lpw__st--inline">{{ t('learningPrograms.lesson.repeatNeeded') }}</span>
            <div class="lpw__acts">
              <template v-if="materialRoute(today.material?.open)">
                <Button data-testid="lp-today-open" @click="openMaterial(today)">{{ t('learningPrograms.workspace.openLesson') }}</Button>
                <Button v-if="today.unit_refs?.length" variant="ghost" data-testid="lp-today-prepare" @click="prepare(today)">
                  {{ t('learningPrograms.lesson.prepareAgain') }}
                </Button>
              </template>
              <Button v-else-if="today.unit_refs?.length" data-testid="lp-today-prepare" @click="prepare(today)">
                {{ t('learningPrograms.workspace.prepareLesson') }}
              </Button>
              <p v-else class="lpw__muted lpw__small" data-testid="lp-today-special">{{ specialReason(today) }}</p>
            </div>
          </div>
          <div class="lpw__t-out">
            <h3 class="lpw__h3">{{ t('learningPrograms.workspace.after') }}</h3>
            <LessonOutcomeActions :key="today.lesson_id" :program="p" :lesson="today" variant="cards" @changed="reload" />
          </div>
        </div>
        <p v-else class="lpw__all-done">{{ t('learningPrograms.workspace.allDone') }}</p>
      </section>

      <!-- Увесь план: розділи згорнуті, крім того, де «Сьогодні»; дії рядка — при наведенні -->
      <section class="lpw__plan">
        <h2 class="lpw__plan-h">
          <span>{{ t('learningPrograms.workspace.plan') }}</span>
          <button type="button" class="lpw__expand" data-testid="lp-expand" @click="toggleAll">
            {{ allOpen ? t('learningPrograms.workspace.collapseAll') : t('learningPrograms.workspace.expandAll') }}
          </button>
        </h2>
        <div v-for="g in groups" :key="g.item.item_id" class="lpw__g" :class="{ 'lpw__g--open': isOpen(g), 'lpw__g--skipped': g.item.state === 'skipped' }">
          <button type="button" class="lpw__g-h" :aria-expanded="isOpen(g)" data-testid="lp-group" @click="toggle(g)">
            <span class="lpw__chev" aria-hidden="true">▶</span>
            <span class="lpw__g-name">{{ g.item.title }}<span v-if="g.complete" class="lpw__g-check"> ✓</span></span>
            <span class="lpw__g-cnt">{{ t('learningPrograms.workspace.count', { done: g.done, total: g.lessons.length }) }}</span>
            <span class="lpw__mini" aria-hidden="true"><i :style="{ width: pct(g.done, g.lessons.length) }" /></span>
          </button>
          <div v-if="isOpen(g)" class="lpw__g-b">
            <div v-for="l in g.lessons" :key="l.lesson_id" class="lpw__r" data-testid="lp-lesson-row"
                 :class="{ 'lpw__r--passed': l.credit_state === 'credited', 'lpw__r--cur': l.lesson_id === today?.lesson_id }">
              <span class="lpw__n">{{ l.position }}</span>
              <span class="lpw__tt">{{ l.title }}</span>
              <span class="lpw__ra">
                <span v-if="pill(l)" class="lpw__st" :class="`lpw__st--${pill(l)}`">{{ t(`learningPrograms.workspace.pill.${pill(l)}`) }}</span>
                <button v-if="canReopen(l)" type="button" class="lpw__reopen" :disabled="saving" data-testid="lp-reopen"
                        :title="t('learningPrograms.workspace.reopenHint')" @click="reopenLesson(l)">
                  {{ t('learningPrograms.workspace.reopen') }}
                </button>
                <template v-if="l.lesson_id !== today?.lesson_id">
                  <button v-if="materialRoute(l.material?.open)" type="button" class="lpw__hv" @click="openMaterial(l)">{{ t('learningPrograms.lesson.open') }}</button>
                  <button v-if="l.credit_state !== 'credited' && l.unit_refs?.length" type="button" class="lpw__hv" @click="prepare(l)">
                    {{ l.material ? t('learningPrograms.lesson.prepareAgain') : t('learningPrograms.lesson.prepare') }}
                  </button>
                </template>
              </span>
            </div>
            <p v-if="!g.lessons.length && (g.item.state === 'skipped' || g.item.deferred_reason_key)" class="lpw__muted lpw__small lpw__g-note">
              {{ g.item.state === 'skipped' ? t('learningPrograms.itemState.skippedHint') : t('learningPrograms.itemState.deferredHint') }}
            </p>
          </div>
        </div>
      </section>
    </template>

    <PrepareLessonDialog :open="!!preparing" :program="p" :lesson="preparing" @close="preparing = null" @prepared="reload" />
    <ConfirmModal :open="askDelete" :title="t('learningPrograms.workspace.deleteTitle')"
                  :message="t('learningPrograms.workspace.deleteText', { learner: learnerName })"
                  :confirm-text="t('learningPrograms.workspace.deleteConfirm')" :cancel-text="t('common.cancel')"
                  variant="danger" :loading="deleting" @confirm="removeProgram" @cancel="askDelete = false" />
  </div>
</template>

<script setup lang="ts">
/**
 * Робочий екран програми учня (ТЗ §5.2), вигляд — за макетом власника 29.10 (`DATA/ПОЛА/програма.zip`): прогрес,
 * смужка «Було → Сьогодні → Далі», одна головна дія, «Після заняття» окремо, план згорнутий до розділу «Сьогодні».
 * Зміст: «що було → що сьогодні → що далі», повна структура тем (пропущені й
 * відкладені не зникають), підготовка заняття генератором, відкриття готового уроку, підсумок за дві дії,
 * «Ще раз» як явна пропозиція повторення, рівень і темп через пропозиції з `expected_revision`.
 * Стара вкладка (409) — тихе оновлення з повідомленням, без перезапису чужих змін.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import ConfirmModal from '@/ui/ConfirmModal.vue'
import LessonOutcomeActions from '../components/LessonOutcomeActions.vue'
import PrepareLessonDialog from '../components/PrepareLessonDialog.vue'
import {
  bodies, learningProgramsApi, errorCode, errorStatus, materialRoute, type ProgramDetail, type ProgramItem,
  type ProgramLesson,
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
function lessonsOf(itemId: string) {
  return p.value?.lessons.filter((l) => l.item_id === itemId) ?? []
}

// Прогрес і план (макет 29.10): пройдено = зараховані заняття; розділ відкритий, якщо в ньому «Сьогодні».
const lessonCount = computed(() => p.value?.lessons.length ?? 0)
const creditedCount = computed(() => p.value?.lessons.filter((l) => l.credit_state === 'credited').length ?? 0)
const todayItem = computed(() => p.value?.items.find((i) => i.item_id === today.value?.item_id) ?? null)
type Group = { item: ProgramItem; lessons: ProgramLesson[]; done: number; current: boolean; complete: boolean }
const groups = computed<Group[]>(() => (p.value?.items ?? []).map((item) => {
  const lessons = lessonsOf(item.item_id)
  const done = lessons.filter((l) => l.credit_state === 'credited').length
  return { item, lessons, done, current: lessons.some((l) => l.lesson_id === today.value?.lesson_id),
           complete: lessons.length > 0 && done === lessons.length }
}))
const pct = (done: number, total: number) => `${total ? Math.round((done / total) * 100) : 0}%`

const opened = ref<Record<string, boolean>>({})
const allOpen = ref(false)
const isOpen = (g: Group) => opened.value[g.item.item_id] ?? g.current
function toggle(g: Group) {
  opened.value = { ...opened.value, [g.item.item_id]: !isOpen(g) }
}
function toggleAll() {
  allOpen.value = !allOpen.value
  opened.value = Object.fromEntries(groups.value.map((g) => [g.item.item_id, allOpen.value || g.current]))
}

function pill(l: ProgramLesson): 'ok' | 'rep' | 'now' | '' {
  if (l.lesson_id === today.value?.lesson_id) return 'now'
  if (l.credit_state === 'credited') return 'ok'
  return l.credit_state === 'repeat_needed' ? 'rep' : ''
}

// Заняття без теми добірки — не кнопка, а пояснення (діагностика, пробний НМТ, повторення за помилками учня).
function specialReason(l: ProgramLesson) {
  if (l.role === 'DIAGNOSTIC' || l.role === 'MOCK_EXAM') return t('learningPrograms.reasons.manualScenario')
  if (l.role === 'REVIEW') return t('learningPrograms.reasons.needsLearnerContext')
  return t('learningPrograms.reasons.topicNotMapped')
}

const lastMark = computed(() => {
  const last = p.value?.summary.last
  if (!last || last.attendance !== 'held') return '✕'
  return last.pedagogical_action === 'repeat' ? '↻' : '✓'
})

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

// «Повернути в план» (власник 29.10: «учень забувся тему, і треба повернутися»). Один натиск — без діалогу: тема
// знову «Сьогодні», вгорі «Тему повернуто… Скасувати» на випадок помилки. Нічого не стирається (запис історії).
// Лише індивідуальна програма: у групі тему забуває учень, а не клас.
const reopenIntent = createIntent<ReturnType<typeof bodies.reopen>>()
const undoIntent = createIntent<ReturnType<typeof bodies.undoReopen>>()
const returned = ref<{ lessonId: string; eventId: string; title: string } | null>(null)
const canReopen = (l: ProgramLesson) => p.value?.target.kind === 'learner' && l.credit_state === 'credited'

function planError(e: unknown) {
  return !answered(e) ? t('learningPrograms.errors.noAnswer')
    : errorCode(e) === 'revision_conflict' ? t('learningPrograms.errors.revisionConflict') : t('learningPrograms.errors.generic')
}

async function reopenLesson(l: ProgramLesson) {
  if (!p.value || saving.value) return
  const cur = p.value
  saving.value = true
  notice.value = ''
  returned.value = null
  const intent = reopenIntent.take(`${cur.id}:${l.lesson_id}:${cur.route_revision}`, (key) => bodies.reopen(cur, key))
  try {
    const r = await learningProgramsApi.sendReopen(cur.id, l.lesson_id, intent.body)
    reopenIntent.settle(intent)
    returned.value = { lessonId: l.lesson_id, eventId: r.event.event_id, title: l.title }
    // Тема тепер «Сьогодні» вгорі — туди й дивитись, разом із «Скасувати».
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    reopenIntent.settle(intent, e)
    notice.value = planError(e)
  } finally {
    saving.value = false
    await reload()
  }
}

async function undoReopen() {
  if (!p.value || !returned.value || saving.value) return
  const cur = p.value
  const back = returned.value
  saving.value = true
  notice.value = ''
  const intent = undoIntent.take(`${cur.id}:${back.eventId}:${cur.route_revision}`,
    (key) => bodies.undoReopen(cur, back.eventId, key))
  try {
    await learningProgramsApi.sendUndoReopen(cur.id, back.lessonId, intent.body)
    undoIntent.settle(intent)
    returned.value = null
    notice.value = t('learningPrograms.workspace.reopenUndone')
  } catch (e) {
    undoIntent.settle(intent, e)
    notice.value = planError(e)
  } finally {
    saving.value = false
    await reload()
  }
}

function prepare(l: ProgramLesson) {
  preparing.value = l
}

function openMaterial(l: ProgramLesson) {
  const target = materialRoute(l.material?.open)
  if (target) router.push(target)
}

// «Видалити програму» = архів на сервері. Якщо відповідь загубилась або вкладка застаріла — перечитуємо програму:
// уже в архіві → до списку, інакше пояснення без повтору наосліп.
const askDelete = ref(false)
const deleting = ref(false)
async function removeProgram() {
  if (!p.value || deleting.value) return
  deleting.value = true
  notice.value = ''
  try {
    await learningProgramsApi.archive(p.value)
    router.push({ name: 'learning-programs' })
  } catch (e) {
    await reload()
    if (p.value?.status === 'archived') {
      router.push({ name: 'learning-programs' })
      return
    }
    notice.value = errorCode(e) === 'revision_conflict' ? t('learningPrograms.errors.revisionConflict') : t('learningPrograms.errors.generic')
  } finally {
    deleting.value = false
    askDelete.value = false
  }
}

function showLearner() {
  const href = router.resolve({ name: 'learning-program-learner', params: { id: id.value } }).href
  window.open(href, '_blank', 'noopener')
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short' })
}

watch(id, reload)
onMounted(reload)
</script>

<style scoped>
/* Макет власника 29.10 («Програма учня — пропозиція»): кольори з теми сайту, світліші відтінки — від акценту. */
.lpw {
  --lp-line: color-mix(in srgb, var(--accent) 18%, transparent);
  --lp-act: color-mix(in srgb, var(--accent) 11%, var(--surface-card, #fff));
  --lp-shd: color-mix(in srgb, var(--text-primary) 40%, transparent);
  display: flex; flex-direction: column; gap: 18px; max-width: 1100px; width: 100%; margin: 0 auto;
}
.lpw__back { color: var(--text-muted); text-decoration: none; font-size: 13px; }
.lpw__head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
.lpw__learner { margin: 0; font-size: 26px; font-weight: 700; line-height: 1.2; color: var(--text-primary); }
.lpw__title { margin: 2px 0 0; color: var(--text-secondary); }
.lpw__head-actions { display: flex; gap: 8px; }
.lpw__notice { margin: 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--lp-act); color: var(--text-primary); }
.lpw__notice--back { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.lpw__undo {
  border: 1.5px solid var(--accent); background: var(--surface-card, #fff); color: var(--accent); border-radius: 8px;
  padding: 4px 12px; font: inherit; font-weight: 600; cursor: pointer;
}
.lpw__undo:disabled { opacity: .5; cursor: default; }
.lpw__reopen {
  border: 0; background: none; color: var(--text-muted); font: inherit; font-size: 13px; font-weight: 600;
  padding: 4px 6px; border-radius: 6px; cursor: pointer; white-space: nowrap;
}
.lpw__reopen:hover, .lpw__reopen:focus-visible { color: var(--accent); background: var(--lp-act); }
.lpw__reopen:disabled { opacity: .5; cursor: default; }
.lpw__muted { margin: 0; color: var(--text-secondary); }
.lpw__small { font-size: 13px; }
.lpw__error { color: var(--ui-color-danger); }

/* прогрес */
.lpw__prog {
  background: var(--surface-card, #fff); border-radius: 16px; padding: 14px 18px; display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto; gap: 18px; align-items: center; box-shadow: 0 6px 20px -18px var(--lp-shd);
}
.lpw__prog-num b { font-size: 20px; color: var(--text-primary); }
.lpw__prog-num small { display: block; font-size: 12px; color: var(--text-muted); }
.lpw__bar { display: flex; gap: 4px; height: 10px; }
.lpw__bar span { border-radius: 5px; background: var(--lp-line); position: relative; overflow: hidden; }
.lpw__bar i { position: absolute; inset: 0 auto 0 0; background: var(--accent); }
.lpw__set { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
.lpw__set-one { display: inline-flex; align-items: center; }
.lpw__k { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); margin-right: 6px; }
.lpw__levels { display: inline-flex; gap: 4px; }
.lpw__level {
  width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid var(--lp-line); background: var(--surface-card, #fff);
  font-weight: 700; cursor: pointer; color: var(--text-primary);
}
.lpw__level--on { background: var(--text-primary); border-color: var(--text-primary); color: var(--surface-card, #fff); }
.lpw__select {
  padding: 6px 10px; border-radius: 8px; border: 1.5px solid var(--lp-line); background: var(--surface-card, #fff);
  font: inherit; color: var(--text-primary);
}

/* сьогодні */
.lpw__today {
  background: var(--surface-card, #fff); border-radius: 20px; box-shadow: 0 14px 34px -24px var(--lp-shd);
  overflow: hidden; border: 2px solid var(--accent);
}
.lpw__flow {
  display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 12px; align-items: center;
  padding: 12px 20px; background: var(--lp-act); font-size: 13px; color: var(--text-secondary);
}
.lpw__flow-next { text-align: right; }
.lpw__lab { display: block; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
.lpw__t { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lpw__now { font-weight: 700; color: var(--accent); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
.lpw__t-body { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }
.lpw__t-main { padding: 20px 22px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.lpw__grp { font-size: 12px; color: var(--text-muted); }
.lpw__t-title { margin: 0; font-size: 22px; line-height: 1.25; font-weight: 700; color: var(--text-primary); text-wrap: pretty; }
.lpw__acts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; align-items: center; }
.lpw__t-out {
  padding: 20px 22px; border-left: 1px solid var(--lp-line); display: flex; flex-direction: column; gap: 10px;
  background: color-mix(in srgb, var(--accent) 2%, var(--surface-card, #fff));
}
.lpw__h3 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
.lpw__all-done { margin: 0; padding: 20px 22px; color: var(--text-secondary); }

/* план */
.lpw__plan-h {
  margin: 6px 0 2px; display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted);
}
.lpw__expand { border: 0; background: none; color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer; text-transform: none; letter-spacing: 0; }
.lpw__plan { display: flex; flex-direction: column; gap: 8px; }
.lpw__g { background: var(--surface-card, #fff); border-radius: 14px; box-shadow: 0 6px 20px -18px var(--lp-shd); }
.lpw__g--skipped { opacity: .6; }
.lpw__g-h {
  display: flex; align-items: center; gap: 12px; width: 100%; border: 0; background: none; padding: 12px 16px;
  text-align: left; font: inherit; color: var(--text-primary); cursor: pointer;
}
.lpw__chev { width: 12px; font-size: 12px; color: var(--text-muted); transition: transform .2s; }
.lpw__g--open .lpw__chev { transform: rotate(90deg); }
.lpw__g-name { flex: 1; font-weight: 700; }
.lpw__g-check { color: var(--accent); }
.lpw__g-cnt { font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.lpw__mini { width: 70px; height: 6px; border-radius: 3px; background: var(--lp-line); overflow: hidden; flex: 0 0 70px; }
.lpw__mini i { display: block; height: 100%; background: var(--accent); }
.lpw__g-b { padding: 0 8px 8px; }
.lpw__g-note { padding: 4px 8px 8px; }
.lpw__r {
  display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 10px; align-items: center;
  padding: 8px; border-radius: 10px; min-height: 44px;
}
.lpw__r:hover { background: color-mix(in srgb, var(--accent) 4%, var(--surface-card, #fff)); }
.lpw__n { color: var(--text-muted); text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; }
.lpw__tt { font-size: 14px; color: var(--text-primary); }
.lpw__r--passed .lpw__tt { color: var(--text-muted); }
.lpw__r--cur { background: var(--lp-act); box-shadow: inset 3px 0 0 var(--accent); }
.lpw__r--cur:hover { background: var(--lp-act); }
.lpw__ra { display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
.lpw__st { font-size: 12px; font-weight: 700; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
.lpw__st--ok { background: var(--lp-act); color: var(--accent); }
.lpw__st--rep { background: #fef3c7; color: #b45309; }
.lpw__st--now { background: var(--accent); color: var(--surface-card, #fff); }
.lpw__st--inline { align-self: flex-start; }
.lpw__hv {
  opacity: 0; transition: opacity .15s; border: 0; background: none; color: var(--accent); font: inherit;
  font-weight: 600; font-size: 13px; padding: 4px 6px; border-radius: 6px; cursor: pointer;
}
.lpw__r:hover .lpw__hv, .lpw__hv:focus-visible { opacity: 1; }
.lpw__hv:hover { background: var(--lp-act); }
@media (hover: none) { .lpw__hv { opacity: 1; } }

@media (max-width: 820px) {
  .lpw__t-body { grid-template-columns: 1fr; }
  .lpw__t-out { border-left: 0; border-top: 1px solid var(--lp-line); }
  .lpw__prog { grid-template-columns: 1fr; }
  .lpw__flow { grid-template-columns: 1fr; }
  .lpw__flow-next { text-align: left; }
  .lpw__now { display: none; }
  .lpw__r { grid-template-columns: 26px minmax(0, 1fr); }
  .lpw__ra { grid-column: 2; justify-content: flex-start; }
}
</style>
