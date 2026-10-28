<template>
  <Modal :open="open" :title="t('learningPrograms.prepare.title', { lesson: lesson?.title ?? '' })" size="md" @close="close">
    <div class="pld" data-testid="lp-prepare">
      <p v-if="loadingCaps" class="pld__muted">{{ t('loader.loading') }}</p>
      <p v-else-if="caps && caps.status !== 'available'" class="pld__reason" data-testid="lp-prepare-unavailable">
        {{ reasonText(caps.reason_key) }}
      </p>
      <template v-else-if="caps && caps.level && caps.volume">
        <section>
          <h4 class="pld__label">{{ t('learningPrograms.prepare.profile') }}</h4>
          <div class="pld__chips">
            <button
              v-for="code in caps.level.codes"
              :key="code"
              type="button"
              class="pld__chip"
              :class="{ 'pld__chip--on': profile === code }"
              :aria-pressed="profile === code"
              :data-testid="`lp-profile-${code}`"
              @click="profile = code"
            >{{ t(`learningPrograms.profile.${code}`) }}</button>
          </div>
        </section>
        <section>
          <h4 class="pld__label">{{ t('learningPrograms.prepare.count') }}</h4>
          <div class="pld__count">
            <button type="button" class="pld__step" :disabled="count <= caps.volume.min" @click="count--">−</button>
            <span class="pld__num" data-testid="lp-count">{{ count }}</span>
            <button type="button" class="pld__step" :disabled="count >= caps.volume.max" @click="count++">+</button>
          </div>
        </section>

        <div class="pld__preview" aria-live="polite">
          <p v-if="previewing" class="pld__muted">{{ t('learningPrograms.prepare.checking') }}</p>
          <template v-else-if="preview">
            <p v-if="topicLabels" class="pld__muted" data-testid="lp-prepare-topic">
              {{ t('learningPrograms.prepare.topic') }}: {{ topicLabels }}
            </p>
            <p v-for="(w, i) in visibleWarnings" :key="i" class="pld__note">{{ w.detail }}</p>
            <p v-if="preview.can_prepare" class="pld__ok" data-testid="lp-preview-ok">{{ t('learningPrograms.prepare.ready', { n: count }) }}</p>
            <p v-else class="pld__reason" data-testid="lp-preview-fail">
              {{ shortageText ?? lastDetail ?? t('learningPrograms.errors.generic') }}
            </p>
          </template>
        </div>

        <p v-if="result === 'prepared'" class="pld__ok" data-testid="lp-prepared">{{ t('learningPrograms.prepare.done') }}</p>
        <p v-else-if="result" class="pld__reason" role="alert">{{ result }}</p>
      </template>
    </div>
    <template #footer>
      <Button variant="ghost" @click="close">{{ t('common.close') }}</Button>
      <Button
        v-if="result === 'prepared' && openRoute"
        data-testid="lp-open-prepared"
        @click="openPrepared"
      >{{ t('learningPrograms.lesson.open') }}</Button>
      <Button
        v-else-if="caps?.status === 'available'"
        :loading="preparing"
        :disabled="!preview?.can_prepare || previewing || preparing"
        data-testid="lp-prepare-go"
        @click="go"
      >{{ t('learningPrograms.prepare.go') }}</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
/**
 * Підготовка заняття наявним генератором (контракт gen.v1): профіль конструктора й кількість задач; попередній
 * перегляд — справжній добір без створення уроку (нестачу й несумісний профіль видно ДО генерації). Рівень учня
 * 1–5 тут не підставляється — це окремий показник програми. Генерація триває кілька секунд; повтор натискання
 * з тим самим `request_id` не створює другого уроку (сервер).
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import {
  bodies, learningProgramsApi, errorCode, materialRoute,
  type Capabilities, type GenerationPreview, type ProgramDetail, type ProgramLesson, type Ref,
} from '../api/learningProgramsApi'
import { answered, createIntent, latestOnly } from '../intent'
import { reasonKeyText } from '../reasons'
import { TOPICS } from '@/modules/lesson_constructor/api/lessonConstructorApi'

const TOPIC_LABEL = new Map<string, string>(TOPICS.map((x: { value: string; label: string }) => [x.value, x.label]))

const props = defineProps<{ open: boolean; program: ProgramDetail | null; lesson: ProgramLesson | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'prepared'): void }>()
const { t, te } = useI18n({ useScope: 'global' })
const router = useRouter()

const caps = ref<Capabilities | null>(null)
const loadingCaps = ref(false)
const profile = ref('balanced')
const count = ref(10)
const preview = ref<GenerationPreview | null>(null)
const previewing = ref(false)
const preparing = ref(false)
const result = ref<string>('')
const preparedRef = ref<Ref | null>(null)
let previewSeq = 0
let timer: ReturnType<typeof setTimeout> | null = null
// Одна підготовка — один request_id (review F3): після втраченої відповіді повторне «Підготувати» з тими самими
// параметрами — той самий запит; сервер упізнає повтор і другого уроку не створює.
const prepareIntent = createIntent<ReturnType<typeof bodies.prepare>>()
// Відкриття вікна для конкретного заняття (review F4b): закриття чи інше заняття робить старі відповіді
// (можливості, перегляд, підготовка) чужими — вони не чіпають екран поточного заняття.
const opening = latestOnly()
let opened = 0

const reasonText = (key: string | null) => reasonKeyText(key, t, te)
// Учителю — лише зрозуміле: скільки задач не беремо (антиповтор). Службова примітка даних програми не показується.
const visibleWarnings = computed(() => (preview.value?.warnings ?? [])
  .filter((w) => w.detail && w.reason_key === 'lesson.excluded_used'))
// Тема добірки — людською назвою з переліку тем конструктора; невідому тему не показуємо кодом.
const topicLabels = computed(() => (preview.value?.context.unit_refs ?? [])
  .map((ref) => TOPIC_LABEL.get(ref)).filter(Boolean).join(', '))
const lastDetail = computed(() => {
  const w = (preview.value?.warnings ?? []).filter((x) => !['lesson.preparation_note', 'lesson.excluded_used'].includes(x.reason_key))
  return w.length ? (w[w.length - 1].detail || reasonText(w[w.length - 1].reason_key)) : null
})
const shortageText = computed(() => {
  const s = preview.value?.shortage?.[0]
  return s && s.available !== null ? t('learningPrograms.prepare.shortage', { available: s.available, requested: s.requested }) : null
})
const openRoute = computed(() => materialRoute(preparedRef.value
  ? { provider: 'winterboard.prepare', id: preparedRef.value.id } : null))

watch(() => [props.open, props.program?.id, props.lesson?.lesson_id], async ([open]) => {
  const token = opened = opening.start()
  if (timer) clearTimeout(timer)
  previewSeq += 1
  caps.value = null
  preview.value = null
  previewing.value = false
  preparing.value = false
  result.value = ''
  preparedRef.value = null
  loadingCaps.value = false
  if (!open || !props.program || !props.lesson) return
  loadingCaps.value = true
  try {
    const fresh = await learningProgramsApi.capabilities(props.program.id, props.lesson.lesson_id)
    if (!opening.isCurrent(token)) return
    caps.value = fresh
    if (fresh.level) profile.value = fresh.level.default
    if (fresh.volume) count.value = fresh.volume.default
  } catch {
    if (opening.isCurrent(token)) caps.value = { status: 'unsupported', reason_key: 'load_failed', level: null, volume: null }
  } finally {
    if (opening.isCurrent(token)) loadingCaps.value = false
  }
}, { immediate: true })

watch([profile, count, caps], () => {
  if (caps.value?.status !== 'available' || !props.open) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(runPreview, 250)
})

async function runPreview() {
  if (!props.program || !props.lesson) return
  const token = opened
  const mine = ++previewSeq
  const here = () => mine === previewSeq && opening.isCurrent(token)
  previewing.value = true
  try {
    const p = await learningProgramsApi.previewGeneration(props.program.id, props.lesson.lesson_id, profile.value, count.value)
    if (here()) preview.value = p
  } catch (e) {
    if (here()) {
      preview.value = { can_prepare: false, context: { unit_refs: [], role: '', route_revision: 0 }, shortage: [],
        warnings: [{ reason_key: errorCode(e) ?? 'load_failed' }] }
    }
  } finally {
    if (here()) previewing.value = false
  }
}

async function go() {
  if (!props.program || !props.lesson || preparing.value) return
  const token = opened
  const here = () => opening.isCurrent(token)
  const program = props.program
  const lessonId = props.lesson.lesson_id
  const sig = JSON.stringify([program.id, lessonId, profile.value, count.value, program.route_revision])
  const intent = prepareIntent.take(sig, (requestId) => bodies.prepare(program, profile.value, count.value, requestId))
  preparing.value = true
  result.value = ''
  let accepted = false
  try {
    await learningProgramsApi.sendPrepare(program.id, lessonId, intent.body)
    accepted = true
    const st = await learningProgramsApi.preparation(intent.key)
    // Ще готується — намір не завершено (review F3b): повторне натискання — той самий request_id, сервер
    // поверне ту саму підготовку, другого уроку не буде.
    if (st.status === 'requested') {
      if (here()) result.value = t('learningPrograms.prepare.stillPreparing')
      return
    }
    prepareIntent.settle(intent)
    // Програму оновлюємо завжди: прийнята підготовка лишається у СВОЄМУ занятті. Вікно іншого заняття
    // (закрили й відкрили інше, review F4b) її результату не показує.
    if (st.status === 'prepared') emit('prepared')
    if (!here()) return
    if (st.status === 'prepared') {
      result.value = 'prepared'
      preparedRef.value = st.material_ref
    } else {
      const s = st.shortage?.[0]
      result.value = s && s.available !== null
        ? t('learningPrograms.prepare.shortage', { available: s.available, requested: s.requested })
        : reasonText(st.reason_key)
    }
  } catch (e) {
    // Команду прийнято, а результат не прочитано: помилка читання стану — не відмова створити урок (review F3b).
    // Намір лишається до визначеного результату; повтор — той самий request_id.
    if (!accepted) prepareIntent.settle(intent, e)
    const code = accepted ? null : errorCode(e)
    if (code === 'revision_conflict') emit('prepared')
    if (!here()) return
    result.value = accepted ? t('learningPrograms.prepare.resultUnknown')
      : !answered(e) ? t('learningPrograms.errors.noAnswer')
        : code === 'revision_conflict' ? t('learningPrograms.errors.revisionConflict') : reasonText(code)
  } finally {
    if (here()) preparing.value = false
  }
}

function openPrepared() {
  if (openRoute.value) router.push(openRoute.value)
}

function close() {
  emit('close')
}
</script>

<style scoped>
.pld { display: flex; flex-direction: column; gap: 16px; }
.pld__label { margin: 0 0 8px; font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.pld__muted { margin: 0; color: var(--text-secondary); font-size: var(--text-sm); }
.pld__note { margin: 0; color: var(--text-secondary); font-size: var(--text-sm); }
.pld__ok { margin: 0; color: var(--ui-color-success); font-weight: 600; }
.pld__reason { margin: 0; color: var(--ui-color-danger); }
.pld__chips { display: flex; gap: 8px; flex-wrap: wrap; }
.pld__chip {
  padding: 8px 14px; border-radius: var(--radius-full); border: 1px solid var(--border-color);
  background: var(--card-bg); color: var(--text-primary); cursor: pointer;
}
.pld__chip--on { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast); }
.pld__count { display: flex; align-items: center; gap: 12px; }
.pld__step {
  width: 36px; height: 36px; border-radius: var(--radius-md); border: 1px solid var(--border-color);
  background: var(--card-bg); font-size: 18px; cursor: pointer;
}
.pld__step:disabled { opacity: 0.4; cursor: default; }
.pld__num { min-width: 28px; text-align: center; font-weight: 700; font-size: var(--text-lg); }
.pld__preview { min-height: 44px; display: flex; flex-direction: column; gap: 6px; }
</style>
