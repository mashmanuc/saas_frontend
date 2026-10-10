<template>
  <!-- «Створити відеофрагмент» (ТЗ «Дзеркало уроку», пілот): сторінка й діапазон знімків → прогноз → відео в
       браузері → перегляд того самого файла → завантаження. Файл лишається на пристрої; сайт його не зберігає. -->
  <div class="wb-mclip__scrim" data-testid="mirror-clip-dialog" @click.self="close">
    <section class="wb-mclip" role="dialog" aria-modal="true" :aria-label="t('winterboard.mirrorClip.title')">
      <header class="wb-mclip__top">
        <h2 class="wb-mclip__title">{{ t('winterboard.mirrorClip.title') }}</h2>
        <button type="button" class="wb-mclip__x" data-testid="mirror-clip-close" :aria-label="t('common.close')" @click="close">×</button>
      </header>

      <p v-if="support && !support.ok" class="wb-mclip__problem" data-testid="mirror-clip-unsupported">
        {{ t('winterboard.mirrorClip.unsupported') }}
      </p>

      <p v-if="phase === 'loading'" class="wb-mclip__status" role="status" data-testid="mirror-clip-loading">
        {{ t('winterboard.mirrorClip.loadingRecord') }}
      </p>
      <p v-if="phase === 'empty'" class="wb-mclip__problem" role="status" data-testid="mirror-clip-empty">
        {{ t('winterboard.mirrorClip.noPhotos') }}
      </p>

      <template v-if="phase === 'choose' || phase === 'ready'">
        <label v-if="allPages.length > 1" class="wb-mclip__field">
          <span>{{ t('winterboard.mirrorClip.page') }}</span>
          <select v-model.number="pageIdx" data-testid="mirror-clip-page">
            <option v-for="(p, i) in allPages" :key="p.pageId" :value="i">{{ pageLabel(p, i) }} · {{ t('winterboard.mirrorClip.shots', { n: p.states.length }) }}</option>
          </select>
        </label>
        <div class="wb-mclip__range">
          <label class="wb-mclip__field">
            <span>{{ t('winterboard.mirrorClip.from') }}</span>
            <select v-model.number="fromIdx" data-testid="mirror-clip-from" @change="invalidate">
              <option v-for="(_, i) in states" :key="i" :value="i" :disabled="i >= toIdx">{{ t('winterboard.mirrorClip.shotN', { n: i + 1, total: states.length }) }}</option>
            </select>
            <img v-if="states[fromIdx]" :src="states[fromIdx].url" alt="" class="wb-mclip__thumb" crossorigin="anonymous">
          </label>
          <label class="wb-mclip__field">
            <span>{{ t('winterboard.mirrorClip.to') }}</span>
            <select v-model.number="toIdx" data-testid="mirror-clip-to" @change="invalidate">
              <option v-for="(_, i) in states" :key="i" :value="i" :disabled="i <= fromIdx">{{ t('winterboard.mirrorClip.shotN', { n: i + 1, total: states.length }) }}</option>
            </select>
            <img v-if="states[toIdx]" :src="states[toIdx].url" alt="" class="wb-mclip__thumb" crossorigin="anonymous">
          </label>
        </div>
        <p v-if="tooMany" class="wb-mclip__problem" data-testid="mirror-clip-too-many">
          {{ t('winterboard.mirrorClip.tooMany', { n: rangeUrls.length, max: CLIP.maxSources }) }}
        </p>
      </template>

      <p v-if="phase === 'analyzing'" class="wb-mclip__status" role="status" data-testid="mirror-clip-analyzing">
        {{ t('winterboard.mirrorClip.analyzing', { done: progress[0], total: progress[1] }) }}
      </p>

      <template v-if="phase === 'ready' && analysis">
        <p class="wb-mclip__summary" data-testid="mirror-clip-summary">
          {{ t('winterboard.mirrorClip.summary', { real: analysis.realSteps, light: analysis.lightOnly, dur: fmtDur(analysis.estimatedMs) }) }}
        </p>
        <p v-if="tooLong" class="wb-mclip__problem" data-testid="mirror-clip-too-long">
          {{ t('winterboard.mirrorClip.tooLong', { max: CLIP.maxMs / 60000 }) }}
        </p>
      </template>

      <div v-if="phase === 'exporting'" class="wb-mclip__status" role="status" data-testid="mirror-clip-exporting">
        <p>{{ t('winterboard.mirrorClip.exporting', { pct: Math.round((progress[0] / Math.max(1, progress[1])) * 100) }) }}</p>
        <progress :value="progress[0]" :max="Math.max(1, progress[1])" />
      </div>

      <template v-if="phase === 'done' && videoUrl">
        <video :src="videoUrl" class="wb-mclip__video" controls playsinline data-testid="mirror-clip-video" />
        <p class="wb-mclip__hint">{{ t('winterboard.mirrorClip.checkBeforeSharing') }}</p>
      </template>

      <p v-if="phase === 'error'" class="wb-mclip__problem" role="status" data-testid="mirror-clip-error">{{ errorText }}</p>

      <footer class="wb-mclip__actions">
        <button
          v-if="phase === 'choose'"
          type="button" class="wb-mclip__btn is-on" data-testid="mirror-clip-prepare"
          :disabled="tooMany || rangeUrls.length < 2" @click="prepare"
        >{{ t('winterboard.mirrorClip.prepare') }}</button>
        <button
          v-if="phase === 'ready'"
          type="button" class="wb-mclip__btn is-on" data-testid="mirror-clip-create"
          :disabled="tooLong || !support?.ok" @click="create"
        >{{ t('winterboard.mirrorClip.create') }}</button>
        <a
          v-if="phase === 'done' && videoUrl"
          class="wb-mclip__btn is-on" data-testid="mirror-clip-download" :href="videoUrl" :download="fileName"
        >{{ t('winterboard.mirrorClip.download') }}</a>
        <button
          v-if="(phase === 'done' || phase === 'error' || phase === 'ready') && allPages.length"
          type="button" class="wb-mclip__btn" data-testid="mirror-clip-again" @click="reset"
        >{{ t('winterboard.mirrorClip.again') }}</button>
        <button v-if="phase === 'analyzing' || phase === 'exporting'" type="button" class="wb-mclip__btn" data-testid="mirror-clip-cancel" @click="reset">
          {{ t('winterboard.mirrorClip.cancel') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Діалог відеофрагмента (ТЗ «Дзеркало уроку» §2 п. 3, §4). Рушій — `engine/lessonMirror`: той самий аналіз
 * пари, що й для плеєра. Передперегляд — сам готовий файл (не друга відмальовка), тож що вчитель бачить,
 * те й завантажує. Нічого не надсилається на сервер.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { analyzeRange, clipExportSupport, exportClip, CLIP, type ClipAnalysis } from '../../engine/lessonMirror'
import type { MirrorPhotoPage } from '../../engine/lessonMirror/types'
import { loadReplayMirrorPages } from '../../composables/replayMirrorPages'

const props = defineProps<{
  /** Сторінки запису з ≥ 2 фото-фонами (добрав плеєр) — або порожньо, тоді вікно завантажує запис саме */
  pages?: MirrorPhotoPage[]
  /** Зі списку «Мої записи»: id свого завершеного запису — вікно саме завантажить і добере знімки */
  replayId?: string
  /** Назва уроку — для імені файла */
  lessonTitle?: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

type Phase = 'loading' | 'empty' | 'choose' | 'analyzing' | 'ready' | 'exporting' | 'done' | 'error'
const phase = ref<Phase>('choose')
/** Сторінки, добрані самим вікном (відкрите зі списку) */
const loadedPages = shallowRef<MirrorPhotoPage[]>([])
const allPages = computed<MirrorPhotoPage[]>(() => (props.pages?.length ? props.pages : loadedPages.value))
const pageIdx = ref(0)
const fromIdx = ref(0)
const toIdx = ref(0)
const progress = ref<[number, number]>([0, 0])
const analysis = shallowRef<ClipAnalysis | null>(null)
const support = ref<{ ok: boolean; codec?: string } | null>(null)
const videoUrl = ref('')
const errorText = ref('')
let ctrl: AbortController | null = null

const states = computed(() => allPages.value[pageIdx.value]?.states ?? [])
const rangeUrls = computed(() => states.value.slice(fromIdx.value, toIdx.value + 1).map((s) => s.url))
const tooMany = computed(() => rangeUrls.value.length > CLIP.maxSources)
const tooLong = computed(() => (analysis.value?.estimatedMs ?? 0) > CLIP.maxMs)

function pageLabel(p: MirrorPhotoPage, i: number): string {
  return /^\d+$/.test(p.label) ? t('winterboard.mirrorClip.pageN', { n: p.label }) : (p.label || t('winterboard.mirrorClip.pageN', { n: i + 1 }))
}

const fileName = computed(() => {
  const base = (props.lessonTitle || 'm4sh').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'm4sh'
  const page = allPages.value[pageIdx.value]
  return `${base} — ${page ? pageLabel(page, pageIdx.value) : ''}, ${fromIdx.value + 1}–${toIdx.value + 1}.mp4`
})

function fmtDur(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function defaultRange(): void {
  fromIdx.value = 0
  toIdx.value = Math.min(states.value.length, CLIP.maxSources) - 1
}

function revokeVideo(): void {
  if (videoUrl.value) URL.revokeObjectURL(videoUrl.value)
  videoUrl.value = ''
}

function reset(): void {
  ctrl?.abort()
  ctrl = null
  revokeVideo()
  analysis.value = null
  errorText.value = ''
  phase.value = 'choose'
}

/** Діапазон змінився — прогноз уже не про нього */
function invalidate(): void {
  if (phase.value === 'ready') { analysis.value = null; phase.value = 'choose' }
}

// Інша сторінка — діапазон на всю нову сторінку (стежимо за значенням, а не за подією: порядок
// обробників «change» і v-model не гарантований)
watch(pageIdx, () => { defaultRange(); invalidate() })

function failText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.startsWith('load_failed:')) {
    const url = msg.slice('load_failed:'.length)
    const n = rangeUrls.value.indexOf(url) + fromIdx.value + 1
    return t('winterboard.mirrorClip.loadFailed', { n: n > fromIdx.value ? n : '?' })
  }
  return t('winterboard.mirrorClip.failed')
}

async function prepare(): Promise<void> {
  ctrl?.abort()
  ctrl = new AbortController()
  phase.value = 'analyzing'
  progress.value = [0, rangeUrls.value.length - 1]
  try {
    analysis.value = await analyzeRange(rangeUrls.value, (d, tot) => { progress.value = [d, tot] }, ctrl.signal)
    phase.value = 'ready'
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return
    errorText.value = failText(err)
    phase.value = 'error'
  }
}

async function create(): Promise<void> {
  if (!analysis.value || !support.value?.codec) return
  ctrl?.abort()
  ctrl = new AbortController()
  phase.value = 'exporting'
  progress.value = [0, 1]
  try {
    const blob = await exportClip(rangeUrls.value, analysis.value, support.value.codec, (d, tot) => { progress.value = [d, tot] }, ctrl.signal)
    revokeVideo()
    videoUrl.value = URL.createObjectURL(blob)
    phase.value = 'done'
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return
    errorText.value = failText(err)
    phase.value = 'error'
  }
}

function close(): void {
  ctrl?.abort()
  revokeVideo()
  emit('close')
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  const supportP = clipExportSupport()
  if (!props.pages?.length && props.replayId) {
    // Зі списку: записи в списку без журналу дій — перевіряємо знімки вже тут і кажемо словами, якщо їх немає
    phase.value = 'loading'
    ctrl = new AbortController()
    try {
      loadedPages.value = await loadReplayMirrorPages(props.replayId, ctrl.signal)
      phase.value = loadedPages.value.length ? 'choose' : 'empty'
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return
      errorText.value = t('winterboard.mirrorClip.loadRecordFailed')
      phase.value = 'error'
    }
  }
  defaultRange()
  support.value = await supportP
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  ctrl?.abort()
  revokeVideo()
})

defineExpose({ phase })
</script>

<style scoped>
.wb-mclip__scrim {
  position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(2, 6, 23, .55);
}
.wb-mclip {
  width: min(720px, 100%); max-height: calc(100dvh - 32px); overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  padding: 16px 20px; border-radius: 14px; background: #fff; color: #0f172a; box-shadow: 0 20px 50px rgba(2, 6, 23, .35);
}
.wb-mclip__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.wb-mclip__title { margin: 0; font-size: 18px; font-weight: 700; }
.wb-mclip__x { width: 36px; height: 36px; border: 0; border-radius: 10px; background: #f1f5f9; font-size: 20px; cursor: pointer; }
.wb-mclip__field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; flex: 1; min-width: 0; }
.wb-mclip__field select { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff; }
.wb-mclip__range { display: flex; gap: 12px; flex-wrap: wrap; }
.wb-mclip__thumb { width: 100%; aspect-ratio: 16 / 9; object-fit: contain; border-radius: 8px; background: #0f172a; }
.wb-mclip__status, .wb-mclip__summary { margin: 0; font-size: 15px; }
.wb-mclip__status progress { width: 100%; }
.wb-mclip__problem { margin: 0; padding: 10px 12px; border-radius: 10px; background: #fef3c7; color: #78350f; font-size: 14px; }
.wb-mclip__hint { margin: 0; font-size: 13px; color: #475569; }
.wb-mclip__video { width: 100%; border-radius: 10px; background: #000; }
.wb-mclip__actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
.wb-mclip__btn {
  min-height: 40px; padding: 0 16px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a;
  font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; text-decoration: none;
}
.wb-mclip__btn.is-on { background: #047857; border-color: #047857; color: #fff; }
.wb-mclip__btn:disabled { opacity: .45; cursor: default; }
</style>
