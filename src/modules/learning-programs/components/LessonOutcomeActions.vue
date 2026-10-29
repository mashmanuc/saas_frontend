<template>
  <div class="loa" data-testid="lp-outcome">
    <template v-if="!done">
      <fieldset v-if="lesson.material" class="loa__usage">
        <legend class="loa__legend">{{ t('learningPrograms.outcome.tasks') }}</legend>
        <label class="loa__radio">
          <input v-model="usage" type="radio" value="whole" data-testid="lp-usage-whole" />
          {{ t('learningPrograms.outcome.tasksAll') }}
        </label>
        <label class="loa__radio">
          <input v-model="usage" type="radio" value="unknown" data-testid="lp-usage-unknown" />
          {{ t('learningPrograms.outcome.tasksUnknown') }}
        </label>
      </fieldset>
      <div v-if="variant === 'cards'" class="loa__cards">
        <button v-for="o in options" :key="o.key" type="button" class="loa__oc" :class="[`loa__oc--${o.key}`, { 'loa__oc--busy': busy === o.key }]"
                :disabled="!!busy" :aria-busy="busy === o.key" :data-testid="o.testid" @click="record(o.attendance, o.action)">
          <i class="loa__icon" aria-hidden="true">{{ o.icon }}</i>
          <span><b class="loa__oc-title">{{ o.title }}</b><small class="loa__oc-hint">{{ o.hint }}</small></span>
        </button>
      </div>
      <div v-else class="loa__buttons">
        <template v-if="attendance !== 'not_held'">
          <Button size="sm" :loading="busy === 'next'" :disabled="!!busy" data-testid="lp-held-next" @click="record('held', 'next')">
            {{ t('learningPrograms.outcome.next') }}
          </Button>
          <Button size="sm" variant="secondary" :loading="busy === 'repeat'" :disabled="!!busy" data-testid="lp-held-repeat"
                  @click="record('held', 'repeat')">
            {{ t('learningPrograms.outcome.repeat') }}
          </Button>
        </template>
        <Button v-if="attendance !== 'held'" size="sm" variant="ghost" :loading="busy === 'not_held'" :disabled="!!busy"
                data-testid="lp-not-held" @click="record('not_held', 'none')">
          {{ t('learningPrograms.outcome.notHeld') }}
        </Button>
      </div>
    </template>

    <div v-else-if="offerReview" class="loa__offer" data-testid="lp-offer-review">
      <p class="loa__text">{{ t('learningPrograms.outcome.offerReview') }}</p>
      <div class="loa__buttons">
        <Button size="sm" :loading="busy === 'review'" :disabled="!!busy" data-testid="lp-add-review" @click="addReview">
          {{ t('learningPrograms.outcome.addReview') }}
        </Button>
        <Button size="sm" variant="ghost" :disabled="!!busy" @click="offerReview = false">{{ t('learningPrograms.outcome.noReview') }}</Button>
      </div>
    </div>
    <p v-else class="loa__saved" data-testid="lp-outcome-saved">{{ savedText }}</p>

    <p v-if="error" class="loa__error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * Підсумок заняття за дві дії (ТЗ §1, §7): «Відбувся — далі» (заняття зараховано, курсор на наступне),
 * «Відбувся — ще раз» (проведено, тему не визнано засвоєною; далі — пропозиція додати заняття-повторення в план,
 * сама вона нічого не генерує), «Не відбувся» (зміст лишається наступним). Задачі підготовленого уроку — явний вибір
 * «усі розв'язали» / «не знаю»: невідомо не вважається розв'язаним (антиповтор бере лише явні).
 *
 * Той самий блок призначено для кроку програми у «Підсумку уроку» (Лона): він працює лише з програмою й заняттям і
 * нічого не знає про розклад.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import {
  bodies, learningProgramsApi, errorCode, type MaterialUse, type PedagogicalAction, type ProgramDetail, type ProgramLesson,
  type Ref,
} from '../api/learningProgramsApi'
import { reasonKeyText } from '../reasons'
import { answered, createIntent } from '../intent'

const props = defineProps<{
  program: ProgramDetail
  lesson: ProgramLesson
  /** Урок розкладу (крок програми у «Підсумку уроку»): відвідування вже відоме з розкладу — лише відповідні дії. */
  calendarRef?: Ref | null
  attendance?: 'held' | 'not_held' | null
  /** `cards` — сторінка програми (макет власника 29.10): три картки з поясненням; типово — кнопки «Підсумку уроку». */
  variant?: 'buttons' | 'cards'
}>()
const emit = defineEmits<{ (e: 'changed'): void }>()
const { t, te } = useI18n({ useScope: 'global' })

// Підготовка уроку не доводить, що всі задачі розв'язали: це явне підтвердження вчителя.
const usage = ref<'whole' | 'unknown'>('unknown')
const busy = ref<string>('')
const done = ref<'' | 'next' | 'repeat' | 'not_held' | 'review'>('')
const offerReview = ref(false)
const error = ref('')
let revision = props.program.route_revision
// Остання відома ревізія: власна відповідь або свіжо перечитана програма (рівень/темп могли змінити поруч).
const latestRevision = () => Math.max(revision, props.program.route_revision)
// Один намір — один event_id / ключ: повтор після втраченої відповіді не запише другу подію чи друге повторення.
const outcomeIntent = createIntent<ReturnType<typeof bodies.outcome>>()
const reviewIntent = createIntent<ReturnType<typeof bodies.addReview>>()
const errorText = (e: unknown) => (answered(e) ? reasonKeyText(errorCode(e), t, te) : t('learningPrograms.errors.noAnswer'))

const options = computed(() => [
  { key: 'next', attendance: 'held', action: 'next', icon: '✓', testid: 'lp-held-next',
    title: t('learningPrograms.outcome.nextLong'), hint: t('learningPrograms.outcome.nextHint') },
  { key: 'repeat', attendance: 'held', action: 'repeat', icon: '↻', testid: 'lp-held-repeat',
    title: t('learningPrograms.outcome.repeatLong'), hint: t('learningPrograms.outcome.repeatHint') },
  { key: 'not_held', attendance: 'not_held', action: 'none', icon: '✕', testid: 'lp-not-held',
    title: t('learningPrograms.outcome.notHeld'), hint: t('learningPrograms.outcome.notHeldHint') },
].filter((o) => !props.attendance || o.attendance === props.attendance) as {
  key: string; attendance: 'held' | 'not_held'; action: PedagogicalAction; icon: string; testid: string; title: string; hint: string
}[])

const savedText = computed(() => ({
  next: t('learningPrograms.outcome.savedNext'),
  repeat: t('learningPrograms.outcome.savedRepeat'),
  not_held: t('learningPrograms.outcome.savedNotHeld'),
  review: t('learningPrograms.outcome.savedReview'),
  '': '',
}[done.value]))

async function record(attendance: 'held' | 'not_held', action: PedagogicalAction) {
  if (busy.value) return
  busy.value = attendance === 'held' ? action : 'not_held'
  error.value = ''
  const m = props.lesson.material
  const materials: MaterialUse[] = attendance === 'held' && m
    ? [{ material_ref: m.material_ref, usage: usage.value, content_refs_used: [] }]
    : []
  const sig = JSON.stringify([props.lesson.lesson_id, attendance, action, usage.value])
  const intent = outcomeIntent.take(sig, (eventId) => bodies.outcome({ ...props.program, route_revision: latestRevision() },
    props.lesson.lesson_id, { attendance, action, materials, calendarRef: props.calendarRef ?? null }, eventId))
  try {
    const r = await learningProgramsApi.sendOutcome(props.program.id, props.lesson.lesson_id, intent.body)
    outcomeIntent.settle(intent)
    revision = r.route_revision
    done.value = attendance === 'held' ? (action as 'next' | 'repeat') : 'not_held'
    offerReview.value = done.value === 'repeat' && !!props.lesson.unit_refs?.length
    emit('changed')
  } catch (e) {
    outcomeIntent.settle(intent, e)
    error.value = errorText(e)
    if (errorCode(e) === 'revision_conflict') emit('changed')
  } finally {
    busy.value = ''
  }
}

async function addReview() {
  if (busy.value || !props.lesson.unit_refs?.length) return
  busy.value = 'review'
  error.value = ''
  const refs = props.lesson.unit_refs
  const intent = reviewIntent.take(props.lesson.lesson_id,
    () => bodies.addReview({ ...props.program, route_revision: latestRevision() }, props.lesson.lesson_id, refs))
  try {
    await learningProgramsApi.sendProposal(props.program.id, intent.body, intent.key)
    reviewIntent.settle(intent)
    offerReview.value = false
    done.value = 'review'
    emit('changed')
  } catch (e) {
    reviewIntent.settle(intent, e)
    error.value = errorText(e)
  } finally {
    busy.value = ''
  }
}
</script>

<style scoped>
.loa { display: flex; flex-direction: column; gap: 10px; }
.loa__usage { border: 0; margin: 0; padding: 0; display: flex; gap: 14px; flex-wrap: wrap; font-size: var(--text-sm); }
.loa__legend { padding: 0; margin-bottom: 4px; color: var(--text-secondary); font-size: var(--text-xs); text-transform: uppercase; }
.loa__radio { display: flex; gap: 6px; align-items: center; cursor: pointer; }
.loa__buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.loa__cards { display: flex; flex-direction: column; gap: 10px; }
.loa__oc {
  display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer; color: var(--text-primary);
  border: 1.5px solid color-mix(in srgb, var(--accent) 18%, transparent); border-radius: 12px; padding: 10px 12px;
  background: var(--surface-card, #fff); font: inherit; transition: border-color .15s, background .15s;
}
.loa__oc:disabled { cursor: default; }
.loa__oc--busy { opacity: .6; }
.loa__icon {
  width: 28px; height: 28px; flex: 0 0 28px; border-radius: 50%; display: grid; place-items: center;
  font-style: normal; font-weight: 700; font-size: 14px;
}
.loa__oc-title { display: block; font-size: 14px; }
.loa__oc-hint { display: block; font-size: 12px; line-height: 1.35; color: var(--text-muted); }
.loa__oc--next .loa__icon { background: color-mix(in srgb, var(--accent) 12%, var(--surface-card, #fff)); color: var(--accent); }
.loa__oc--next:not(:disabled):hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface-card, #fff)); }
.loa__oc--repeat .loa__icon { background: #fef3c7; color: #b45309; }
.loa__oc--repeat:not(:disabled):hover { border-color: #f59e0b; background: #fffbeb; }
.loa__oc--not_held .loa__icon { background: #f3f4f6; color: #6b7280; }
.loa__oc--not_held:not(:disabled):hover { border-color: #9ca3af; background: #f9fafb; }
.loa__text { margin: 0; color: var(--text-primary); }
.loa__saved { margin: 0; color: var(--ui-color-success); font-weight: 600; }
.loa__error { margin: 0; color: var(--ui-color-danger); font-size: var(--text-sm); }
</style>
