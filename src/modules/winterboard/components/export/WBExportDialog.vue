<!-- WB: Export dialog — format selection, polling, download
     Ref: TASK_BOARD.md B4.3 -->
<template>
  <Modal :open="isOpen" :title="t('winterboard.export.title')" size="sm" @close="emit('close')">
    <p class="wb-export-dialog__desc">{{ t('winterboard.export.description') }}</p>

          <!-- State: idle — format selection + options -->
          <template v-if="state === 'idle'">
            <!-- Format selector -->
            <fieldset class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.format') }}</legend>
              <div class="wb-export-dialog__formats">
                <label
                  v-for="fmt in formats"
                  :key="fmt.value"
                  class="wb-export-format"
                  :class="{
                    'wb-export-format--selected': selectedFormat === fmt.value,
                    'wb-export-format--disabled': fmt.disabled,
                  }"
                  :title="fmt.tooltip || undefined"
                >
                  <input
                    v-model="selectedFormat"
                    type="radio"
                    name="wb-export-format"
                    :value="fmt.value"
                    :disabled="fmt.disabled"
                    class="wb-export-format__radio"
                  />
                  <div class="wb-export-format__icon" v-html="fmt.icon" />
                  <div class="wb-export-format__info">
                    <span class="wb-export-format__name">{{ fmt.label }}</span>
                    <span class="wb-export-format__desc">{{ fmt.desc }}</span>
                  </div>
                </label>
              </div>
            </fieldset>

            <!-- Вибір «поточна / всі сторінки» ПРИБРАНО (2026-08-06).
                 Він нічого не робив: `pageScope` ніде не читався, а обсяг
                 задає сам формат — PNG завжди знімає поточну сторінку,
                 PDF і презентація завжди беруть усі. Тобто перемикач
                 обіцяв вибір, якого не існує. -->

            <!-- PNG options -->
            <fieldset v-if="selectedFormat === 'png'" class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.pngOptions') }}</legend>
              <div class="wb-export-dialog__option-row">
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.quality') }}</span>
                  <select v-model="pngQuality" class="wb-export-select">
                    <option value="high">{{ t('winterboard.export.qualityHigh') }}</option>
                    <option value="medium">{{ t('winterboard.export.qualityMedium') }}</option>
                    <option value="low">{{ t('winterboard.export.qualityLow') }}</option>
                  </select>
                </label>
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.background') }}</span>
                  <select v-model="pngBackground" class="wb-export-select">
                    <option value="white">{{ t('winterboard.export.bgWhite') }}</option>
                    <option value="transparent">{{ t('winterboard.export.bgTransparent') }}</option>
                  </select>
                </label>
              </div>
            </fieldset>

            <!-- Presentation options (North Ship) -->
            <fieldset v-if="selectedFormat === 'pptx' && shipThemes.length" class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.pptxOptions') }}</legend>
              <div class="wb-export-dialog__option-row">
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.theme') }}</span>
                  <select v-model="selectedTheme" class="wb-export-select">
                    <option v-for="theme in shipThemes" :key="theme.name" :value="theme.name">
                      {{ themeLabel(theme) }}
                    </option>
                  </select>
                </label>
              </div>
              <div class="wb-export-dialog__option-row">
                <label class="wb-export-option">
                  <input v-model="includeSolutions" type="checkbox" />
                  <span>{{ t('winterboard.export.solutionSlides') }}</span>
                </label>
              </div>
            </fieldset>

            <!-- PDF options -->
            <fieldset v-if="selectedFormat === 'pdf'" class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.export.pdfOptions') }}</legend>
              <div class="wb-export-dialog__option-row">
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.pageSize') }}</span>
                  <select v-model="pdfPageSize" class="wb-export-select">
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                    <option value="original">{{ t('winterboard.export.original') }}</option>
                  </select>
                </label>
                <label class="wb-export-option">
                  <span>{{ t('winterboard.export.orientation') }}</span>
                  <select v-model="pdfOrientation" class="wb-export-select">
                    <option value="auto">Auto</option>
                    <option value="portrait">{{ t('winterboard.export.portrait') }}</option>
                    <option value="landscape">{{ t('winterboard.export.landscape') }}</option>
                  </select>
                </label>
              </div>
            </fieldset>


            <!-- B5.1: Annotated PDF options -->
            <fieldset v-if="selectedFormat === 'annotated_pdf'" class="wb-export-dialog__fieldset">
              <legend class="wb-export-dialog__legend">{{ t('winterboard.pdf.annotationTypes') }}</legend>
              <div class="wb-export-dialog__option-row">
                <label class="wb-export-option">
                  <input v-model="annotationFilters" type="checkbox" value="strokes" />
                  <span>{{ t('winterboard.pdf.filterStrokes') }}</span>
                </label>
                <label class="wb-export-option">
                  <input v-model="annotationFilters" type="checkbox" value="text" />
                  <span>{{ t('winterboard.pdf.filterText') }}</span>
                </label>
                <label class="wb-export-option">
                  <input v-model="annotationFilters" type="checkbox" value="shapes" />
                  <span>{{ t('winterboard.pdf.filterShapes') }}</span>
                </label>
              </div>
            </fieldset>

            <Button
              variant="primary"
              fullWidth
              :disabled="exporting"
              :loading="exporting"
              @click="startExport"
            >
              {{ t('winterboard.export.startExport') }}
            </Button>
          </template>

          <!-- State: capturing (Stage 1 PR-2 EXPORT_PREPARATION_SSOT) -->
          <!-- Pre-export FE widget snapshot phase. Failures degrade gracefully -->
          <!-- (INV-EP-3: never block export); cancel button aborts captures. -->
          <template v-else-if="state === 'capturing'">
            <div class="wb-export-dialog__progress" role="status" aria-live="polite">
              <div class="wb-export-dialog__spinner" />
              <p class="wb-export-dialog__progress-text">
                {{ t('winterboard.export.capturingWidgets', {
                  done: captureProgress,
                  total: captureTotal,
                }) }}
              </p>
              <Button variant="ghost" @click="cancelCapture">
                {{ t('common.cancel') }}
              </Button>
            </div>
          </template>

          <!-- State: processing -->
          <template v-else-if="state === 'processing'">
            <div class="wb-export-dialog__progress" role="status" aria-live="polite">
              <div class="wb-export-dialog__spinner" />
              <p class="wb-export-dialog__progress-text">{{ t('winterboard.export.processing') }}</p>
              <p v-if="pollElapsed > 0" class="wb-export-dialog__progress-elapsed">
                {{ Math.round(pollElapsed / 1000) }}s
              </p>
              <p v-if="pollElapsed >= POLL_TIMEOUT_MS" class="wb-export-dialog__progress-timeout">
                {{ t('winterboard.export.timeout') }}
              </p>
            </div>
          </template>

          <!-- State: ready — download -->
          <template v-else-if="state === 'ready'">
            <div class="wb-export-dialog__ready">
              <svg class="wb-export-dialog__ready-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="22" stroke="#16a34a" stroke-width="2" />
                <path d="M16 24l6 6 10-12" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <p class="wb-export-dialog__ready-text">{{ t('winterboard.export.ready') }}</p>
              <Button variant="primary" fullWidth @click="downloadFile">
                {{ t('winterboard.export.download') }}
              </Button>
            </div>
          </template>

          <!-- State: error -->
          <template v-else-if="state === 'error'">
            <div class="wb-export-dialog__error">
              <svg class="wb-export-dialog__error-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="22" stroke="#ef4444" stroke-width="2" />
                <path d="M24 14v12M24 30v2" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
              </svg>
              <p class="wb-export-dialog__error-text">{{ t('winterboard.export.error') }}</p>
              <p v-if="errorMessage" class="wb-export-dialog__error-detail">{{ errorMessage }}</p>
              <Button variant="primary" fullWidth @click="resetToIdle">
                {{ t('winterboard.export.retry') }}
              </Button>
            </div>
          </template>
  </Modal>
</template>

<script setup lang="ts">
// WB: WBExportDialog — export with format selection, polling, download
// Ref: TASK_BOARD.md B4.3
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'
import { nextTick } from 'vue'
import { winterboardApi } from '../../api/winterboardApi'
import { shipApi } from '@/modules/ship/shipApi'
import type { ShipArtifactInfo, ShipTheme } from '@/modules/ship/shipApi'
import { isLimitError } from '@/utils/apiClient'
import { useToast } from '../../composables/useToast'
import type { WBExportFormat } from '../../types/winterboard'
// EXPORT_PREPARATION_SSOT (Stage 1 PR-2): widget snapshot pre-export phase.
import { exportPreviewService } from '../../services/exportPreviewService'
import type { CapturedPreview } from '../../services/exportPreviewService'
import { useWBStore } from '../../board/state/boardStore'

// Asset types що рендеряться нативно бекендом (image/sticky/media plaholders).
// Все інше — widget, потребує preview capture.
// Sync with backend NATIVE_RENDERED_ASSET_TYPES у services/render_utils.py.
const NATIVE_ASSET_TYPES: ReadonlySet<string> = new Set([
  'image',
  'sticky',
  'audio_player',
  'video_player',
  'youtube_player',
])

const props = defineProps<{
  sessionId: string
  isOpen: boolean
  /** Number of pages with PDF background (enables annotated_pdf option) */
  pdfPageCount?: number
  /** Палітра/Інтегралик: формат уже названо у фразі («експортуй у PDF») —
      діалог відкривається ОДРАЗУ в процесі експорту цього формату (без повторного вибору). */
  autostart?: 'pdf' | 'png' | null
}>()

const emit = defineEmits<{
  close: []
  exported: []
}>()

const { t } = useI18n()
const { showToast } = useToast()

// ── State ─────────────────────────────────────────────────────────────────
// 'capturing' state (Stage 1 PR-2): FE widget preview snapshot phase,
// runs BEFORE BE export task. Fails gracefully → 'processing' continues
// regardless (INV-EP-3 — BE renders placeholders for missing previews).
type ExportState = 'idle' | 'capturing' | 'processing' | 'ready' | 'error'
const state = ref<ExportState>('idle')
const selectedFormat = ref<WBExportFormat>('png')
const exporting = ref(false)
const exportId = ref<string | null>(null)
const fileUrl = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

// ── Format-specific options (B2.2) ───────────────────────────────────────
type PngQuality = 'high' | 'medium' | 'low'
type PngBackground = 'white' | 'transparent'
type PdfPageSize = 'a4' | 'letter' | 'original'
type PdfOrientation = 'auto' | 'portrait' | 'landscape'

const pngQuality = ref<PngQuality>('high')
const pngBackground = ref<PngBackground>('white')
const pdfPageSize = ref<PdfPageSize>('a4')
const pdfOrientation = ref<PdfOrientation>('auto')

// B5.1: Annotated PDF options
type AnnotationFilter = 'strokes' | 'text' | 'shapes'
const annotationFilters = ref<AnnotationFilter[]>(['strokes', 'text', 'shapes'])

const hasPdfPages = computed(() => (props.pdfPageCount ?? 0) > 0)

// ── Timeout tracking ─────────────────────────────────────────────────────
const POLL_TIMEOUT_MS = 60_000
const pollElapsed = ref(0)
let pollStartTime = 0

// ── Widget capture phase state ───────────────────────────────────────────
const captureProgress = ref(0)
const captureTotal = ref(0)
let captureAbort: AbortController | null = null

// ── Format options ────────────────────────────────────────────────────────
const formats = computed(() => {
  const base = [
    {
      value: 'png' as WBExportFormat,
      label: t('winterboard.export.formats.png'),
      desc: t('winterboard.export.formats.pngDesc'),
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#0066FF" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="2" stroke="#0066FF" stroke-width="1.5"/><path d="M3 15l5-5 4 4 3-3 6 6" stroke="#0066FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      disabled: false,
      tooltip: '',
    },
    {
      value: 'pdf' as WBExportFormat,
      label: t('winterboard.export.formats.pdf'),
      desc: t('winterboard.export.formats.pdfDesc'),
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#ef4444" stroke-width="1.5"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/></svg>',
      disabled: false,
      tooltip: '',
    },
  ]

  // Only show Annotated PDF when session has PDF-background pages
  if (hasPdfPages.value) {
    base.push({
      value: 'annotated_pdf' as WBExportFormat,
      label: t('winterboard.pdf.exportAnnotatedPdf'),
      desc: t('winterboard.pdf.pdfPagesWithAnnotations', { count: props.pdfPageCount ?? 0 }),
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#059669" stroke-width="1.5"/><path d="M14 2v6h6" stroke="#059669" stroke-width="1.5"/><path d="M9 15l2 2 4-5" stroke="#059669" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      disabled: false,
      tooltip: t('winterboard.pdf.exportAnnotatedPdfTooltip'),
    })
  }

  // North Ship (Фаза 3): презентація доступна лише там, де за дошкою стоїть
  // AST-урок — інакше рендерити нема з чого, і кнопка світилася б даремно.
  if (shipArtifact.value) {
    base.push({
      value: 'pptx' as WBExportFormat,
      label: t('winterboard.export.formats.pptx'),
      desc: t('winterboard.export.formats.pptxDesc'),
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="13" rx="2" stroke="#d97706" stroke-width="1.5"/><path d="M8 21h8M12 17v4" stroke="#d97706" stroke-width="1.5" stroke-linecap="round"/><path d="M7 12l3-3 2 2 5-5" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      disabled: false,
      tooltip: '',
    })
  }

  // V2 export (semantic vector engine) is FROZEN — hidden from the UI.
  // BE engine + startExportV2()/exportV2() remain behind the flag in case
  // it's revived; this dialog no longer offers it as a format choice.

  return base
})

// Ship-артефакт для цієї дошки. null = немає AST-уроку або ship вимкнено —
// для UI це одне й те саме: формату «презентація» просто не буде.
const shipArtifact = ref<ShipArtifactInfo | null>(null)

// Теми оформлення презентації. Порожньо = ship вимкнено або запит не дійшов;
// тоді пікера просто немає, а рендер іде темою за умовчанням бекенду.
const shipThemes = ref<ShipTheme[]>([])
const selectedTheme = ref('')
// D-2: кадри розбору після задач — за явним вибором тьютора (колода довшає).
const includeSolutions = ref(false)

/**
 * Підпис теми: свій переклад, якщо ключ є, інакше — те, що дав бекенд.
 * Так нова тема з'являється в пікері одразу, ще до появи перекладу.
 */
function themeLabel(theme: ShipTheme): string {
  const key = `winterboard.export.themes.${theme.name}`
  const translated = t(key)
  return translated === key ? theme.label : translated
}

onMounted(async () => {
  shipArtifact.value = await shipApi.getSessionArtifact(props.sessionId)
  if (!shipArtifact.value) return
  const themes = await shipApi.getThemes()
  if (!themes) return
  shipThemes.value = themes.themes ?? []
  selectedTheme.value = themes.default || themes.themes?.[0]?.name || ''
})

// Autostart (палітра/Інтегралик): формат уже відомий із фрази — стартуємо одразу,
// користувач бачить прогрес (capture → обробка → файл), а не повторний вибір формату.
onMounted(() => {
  if (props.autostart === 'pdf' || props.autostart === 'png') {
    selectedFormat.value = props.autostart
    startExport()
  }
})

// ── Start export ──────────────────────────────────────────────────────────
async function startExport(): Promise<void> {
  // V2 is frozen + hidden from the format list, so this dispatch is no longer
  // reachable. startExportV2() is kept (dead) for a possible future revival.

  exporting.value = true
  errorMessage.value = null

  // ── Phase 1: FE widget preview capture (Stage 1 PR-2) ──────────────────
  // Snapshots interactive math widgets (trig_circle, graph_calculator, etc.)
  // BEFORE BE export task. Failures are silent — BE renders placeholders
  // (INV-EP-3 + INV-EP-7). User can cancel mid-capture; abort propagates.
  try {
    await runCapturePhase()
  } catch (err) {
    // runCapturePhase swallows failures internally — this catch is defensive.
    console.warn('[WB:ExportDialog] capture_phase_unexpected_error', err)
  }
  // If user cancelled mid-capture → reset, do NOT proceed to export.
  if (captureAbort?.signal.aborted) {
    captureAbort = null
    captureProgress.value = 0
    captureTotal.value = 0
    state.value = 'idle'
    exporting.value = false
    return
  }
  captureAbort = null

  // ── Phase 2: BE export request (existing behavior) ─────────────────────
  try {
    // Ship іде своїм ендпоінтом (приймає лише artifact_id — знімки вже
    // завантажені фазою 1), але статус далі политься тим самим WBExport.
    let result: { id: string; status: string; file_url?: string | null; error?: string | null }
    if (selectedFormat.value === 'pptx') {
      // Формат є в списку лише коли артефакт знайдено; якщо він встиг зникнути —
      // чесна помилка, а не тихий відкат на winterboard-експорт, який 'pptx' не приймає.
      if (!shipArtifact.value) throw new Error('ship_artifact_missing')
      result = await shipApi.renderPptx(shipArtifact.value.id, {
        theme: selectedTheme.value || undefined,
        solutions: includeSolutions.value || undefined,
      })
    } else {
      result = await winterboardApi.createExport(props.sessionId, selectedFormat.value)
    }
    exportId.value = result.id

    if (result.status === 'done' && result.file_url) {
      fileUrl.value = result.file_url
      state.value = 'ready'
      emit('exported')
    } else if (result.status === 'error') {
      errorMessage.value = result.error || null
      state.value = 'error'
    } else {
      state.value = 'processing'
      startPolling()
    }
  } catch (err: any) {
    // Ф3: SaaS-ліміт тарифу (403 LIMIT_EXCEEDED) — НЕ показуємо суху «Помилка
    // експорту». Глобальний apiClient-інтерсептор уже відкрив LimitPaywallModal
    // («Оформи PRO»). Тихо закриваємо діалог, щоб лишилась одна зрозуміла картка.
    if (isLimitError(err)) {
      emit('close')
      return
    }
    console.error('[WB:ExportDialog] Export request failed', err)
    showToast(t('winterboard.export.exportError'), 'error')
    state.value = 'error'
  } finally {
    exporting.value = false
  }
}

// ── V2 export (sync, no polling) ─────────────────────────────────────────
async function startExportV2(): Promise<void> {
  exporting.value = true
  errorMessage.value = null

  // Block D (hybrid): snapshot graphic widgets BEFORE export so the BE V2
  // engine embeds editor-identical previews (graphs, circles, geometry).
  // Text + formulas still render natively as vector. Capture failures are
  // silent — BE falls back to matplotlib (INV-EP-3).
  try {
    await runCapturePhase()
  } catch (err) {
    console.warn('[WB:ExportDialog] v2_capture_phase_error', err)
  }
  if (captureAbort?.signal.aborted) {
    captureAbort = null
    captureProgress.value = 0
    captureTotal.value = 0
    state.value = 'idle'
    exporting.value = false
    return
  }
  captureAbort = null

  state.value = 'processing'
  try {
    const result = await winterboardApi.exportV2(props.sessionId)
    if (result.status === 'completed' && result.file_url) {
      fileUrl.value = result.file_url
      state.value = 'ready'
      emit('exported')
    } else {
      errorMessage.value = 'Export V2 failed'
      state.value = 'error'
    }
  } catch (err: any) {
    const detail = err?.response?.data?.detail || err?.message || ''
    if (err?.response?.status === 503) {
      errorMessage.value = 'Export V2 вимкнено на сервері. Використовуйте звичайний PDF.'
    } else {
      errorMessage.value = detail || 'Export V2 error'
    }
    state.value = 'error'
  } finally {
    exporting.value = false
  }
}

/**
 * Wait until всі assets зареєстровано у capture registry — або до timeout.
 *
 * Vue монтує widget renderers тільки для активної сторінки (lazy view).
 * Після `goToPageSilent(idx)` потрібен `nextTick` + час на vendor bundle
 * init перед тим, як `useExportCapture` встигне зареєструвати функцію.
 *
 * Returns коли всі assetIds зареєстровані, або після timeoutMs (вже частково
 * зареєстровані assets все одно будуть capture-нуті у наступному кроку —
 * unregistered повертають null від captureOne → BE placeholder per INV-EP-7).
 */
// Heavy vendor widgets (graph_calculator/Desmos-like, nmt3d/Three.js,
// trig_solver) can take several seconds to initialize their bundle before
// useExportCapture registers. 2s was too short → they missed capture → no
// preview → "widget not visible" in the PDF. 6s ceiling; the poll returns
// the instant all widgets register, so fast widgets aren't slowed down.
const _REGISTRATION_TIMEOUT_MS = 6000

async function waitForRegistration(
  assetIds: string[],
  signal: AbortSignal,
  timeoutMs: number = _REGISTRATION_TIMEOUT_MS,
  pollIntervalMs: number = 50,
): Promise<void> {
  // Give Vue 2-3 nextTick для mount + render children before polling.
  await nextTick()
  await nextTick()
  await nextTick()

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (signal.aborted) return
    const missing = assetIds.filter((id) => !exportPreviewService.hasCapture(id))
    if (missing.length === 0) return
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }
  // Timeout — продовжуємо з тим, що зареєстровано. Не блокуємо export.
}

async function runCapturePhase(): Promise<void> {
  const boardStore = useWBStore()
  // 1. Group widget assets by pageIndex (skip native types — BE рендерить сам).
  const pageWidgets = new Map<number, string[]>() // pageIndex -> assetId[]
  let totalWidgets = 0
  boardStore.pages.forEach((page, pageIndex) => {
    if (Array.isArray(page.assets)) {
      for (const asset of page.assets) {
        const type = String(asset?.type ?? '')
        const id = String(asset?.id ?? '')
        if (!type || !id || NATIVE_ASSET_TYPES.has(type)) continue
        if (!pageWidgets.has(pageIndex)) pageWidgets.set(pageIndex, [])
        pageWidgets.get(pageIndex)!.push(id)
        totalWidgets += 1
      }
    }
    // Page-level theory (theoryBlock/formulaBlock) → snapshot the whole
    // overlay under `theory-<pageId>`. V1.5 composites it at page top.
    const pageId = String((page as any)?.id ?? '')
    if (pageId && ((page as any)?.theoryBlock || (page as any)?.formulaBlock)) {
      if (!pageWidgets.has(pageIndex)) pageWidgets.set(pageIndex, [])
      pageWidgets.get(pageIndex)!.push(`theory-${pageId}`)
      totalWidgets += 1
    }
  })

  if (pageWidgets.size === 0) {
    return // no widgets on any page — skip capture phase
  }

  captureAbort = new AbortController()
  captureProgress.value = 0
  captureTotal.value = totalWidgets
  state.value = 'capturing'

  // Save original active page to restore at the end (always — finally block).
  const originalPageIndex = boardStore.currentPageIndex
  const pageIndices = Array.from(pageWidgets.keys()).sort((a, b) => a - b)
  let capturedAcrossPages = 0

  // 2026-07-27: раніше uploadAll() стояв ВСЕРЕДИНІ цього циклу — тобто на 20-сторінковій
  // дошці ми робили 20 окремих раундів відправки, ПЕРЕМІЖ важким рендером (кожне
  // захоплення = 1-2.2с CPU + блоки головного потоку по 300-400мс, зміряно у DevTools).
  // Відправка, що не встигла, приходила в apiClient як «no response» → глобальний тост
  // «Немає з'єднання з сервером» + інкремент circuit breaker (5 підряд = ВСІ запити
  // застосунку блокуються на 30с). Юзер бачив «зависло» + 3 тости про мережу, хоча
  // сам код вважає ці прев'ю неважливими (INV-EP-3: BE domalює placeholder).
  // Тепер: збираємо все за цикл → відправляємо ОДНИМ пакетом після рендеру.
  const pendingUploads = new Map<string, CapturedPreview>()
  let pendingBytes = 0
  let uploadFailedCount = 0
  // Запобіжник пам'яті: BE тримає 2 МБ на прев'ю, тож 22 віджети — до 44 МБ у
  // найгіршому разі. На планшеті це відчутно, тож скидаємо пакет достроково.
  const FLUSH_THRESHOLD_BYTES = 24 * 1024 * 1024

  async function flushUploads(): Promise<void> {
    if (pendingUploads.size === 0) return
    const batch = new Map(pendingUploads)
    pendingUploads.clear()
    pendingBytes = 0
    const res = await exportPreviewService.uploadAll(
      props.sessionId,
      batch,
      captureAbort!.signal,
    )
    uploadFailedCount += res.failed
  }

  try {
    // 2. Sequentially iterate pages with widgets, mount via goToPageSilent,
    //    poll registry until widgets register, capture, collect. Upload — після циклу.
    for (const pageIdx of pageIndices) {
      if (captureAbort.signal.aborted) break

      const pageAssetIds = pageWidgets.get(pageIdx) ?? []
      if (pageAssetIds.length === 0) continue

      // 2a. Activate page (silent — no page_navigate op emitted).
      if (pageIdx !== boardStore.currentPageIndex) {
        boardStore.goToPageSilent(pageIdx)
      }

      // 2b. Wait for widget components to mount and register capture functions.
      await waitForRegistration(pageAssetIds, captureAbort.signal)
      if (captureAbort.signal.aborted) break

      // 2c. Capture only widgets registered for THIS page.
      const registeredOnPage = pageAssetIds.filter((id) =>
        exportPreviewService.hasCapture(id),
      )
      if (registeredOnPage.length === 0) {
        // No widgets registered — count them all as "done" for progress.
        capturedAcrossPages += pageAssetIds.length
        captureProgress.value = capturedAcrossPages
        continue
      }

      const captureResult = await exportPreviewService.captureAll(
        registeredOnPage,
        captureAbort.signal,
        {
          onProgress: (done) => {
            captureProgress.value = capturedAcrossPages + done
          },
        },
      )
      capturedAcrossPages += pageAssetIds.length
      captureProgress.value = capturedAcrossPages

      if (captureAbort.signal.aborted) break

      // 2d. Збираємо у пакет замість негайної відправки (див. коментар вище).
      for (const [id, cap] of captureResult.captured) {
        pendingUploads.set(id, cap)
        pendingBytes += cap.blob.size
      }
      if (pendingBytes >= FLUSH_THRESHOLD_BYTES) {
        await flushUploads()
      }
      // failed[] / skipped[] — silent; BE renders placeholders per INV-EP-7.
    }

    // 3. Один пакет після завершення рендеру — мережа більше не конкурує з CPU.
    if (!captureAbort.signal.aborted) {
      await flushUploads()
    }
  } catch (err) {
    // INV-EP-3: capture failure must never block export — log and continue.
    console.warn('[WB:ExportDialog] capture_phase_error_swallowed', err)
  } finally {
    // Always restore original active page — навіть при abort/throw.
    if (boardStore.currentPageIndex !== originalPageIndex) {
      boardStore.goToPageSilent(originalPageIndex)
    }
    // 2026-07-27: прев'ю більше не кричать «немає інтернету» (див. meta.nonCriticalRequest
    // у winterboardApi.uploadExportPreview), але й мовчки зникати не мають — інакше юзер
    // отримає файл з порожніми віджетами і без пояснення. Кажемо чесно, не блокуючи export.
    if (uploadFailedCount > 0 && !captureAbort?.signal.aborted) {
      showToast(t('winterboard.export.previewsFailed', { count: uploadFailedCount }), 'warning')
    }
  }
}

function cancelCapture(): void {
  captureAbort?.abort()
}

// ── Polling ───────────────────────────────────────────────────────────────
function startPolling(): void {
  stopPolling()
  pollStartTime = Date.now()
  pollElapsed.value = 0
  pollTimer = setInterval(async () => {
    if (!exportId.value) return
    pollElapsed.value = Date.now() - pollStartTime

    // Timeout check
    if (pollElapsed.value >= POLL_TIMEOUT_MS) {
      console.warn('[WB:ExportDialog] Export timeout after 60s')
      errorMessage.value = t('winterboard.export.timeout')
      state.value = 'error'
      stopPolling()
      return
    }

    try {
      const result = await winterboardApi.getExport(exportId.value)
      if (result.status === 'done' && result.file_url) {
        fileUrl.value = result.file_url
        state.value = 'ready'
        stopPolling()
        emit('exported')
      } else if (result.status === 'error') {
        errorMessage.value = result.error || null
        state.value = 'error'
        stopPolling()
      }
    } catch (err) {
      console.error('[WB:ExportDialog] Poll failed', err)
      showToast(t('winterboard.export.pollError'), 'warning')
      state.value = 'error'
      stopPolling()
    }
  }, 2000)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ── Download ──────────────────────────────────────────────────────────────

/** Sanitize board name into a safe filename component.
 *
 * Replaces filesystem-unfriendly chars (/, \, :, *, ?, ", <, >, |, control chars)
 * з '-'; колапсуємо whitespace; trim; обмежуємо до 80 chars; fallback to 'board'
 * якщо результат порожній.
 */
function buildExportFilename(rawName: string | undefined | null, format: WBExportFormat): string {
  const ext = format === 'pdf' ? 'pdf' : format === 'png' ? 'png' : format
  const safe = String(rawName ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${safe || 'board'}.${ext}`
}

function downloadFile(): void {
  if (!fileUrl.value) return
  const boardStore = useWBStore()
  const filename = buildExportFilename(boardStore.workspaceName, selectedFormat.value)
  const a = document.createElement('a')
  a.href = fileUrl.value
  a.download = filename
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── Reset ─────────────────────────────────────────────────────────────────
function resetToIdle(): void {
  state.value = 'idle'
  exportId.value = null
  fileUrl.value = null
  errorMessage.value = null
  exporting.value = false
  pollElapsed.value = 0
  captureProgress.value = 0
  captureTotal.value = 0
  captureAbort?.abort()
  captureAbort = null
}

// ── Cleanup ───────────────────────────────────────────────────────────────
onUnmounted(() => {
  stopPolling()
  // Dialog closed mid-capture: abort in-flight captures + uploads.
  captureAbort?.abort()
  captureAbort = null
})
</script>

<style scoped>
.wb-export-dialog__desc {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0 0 20px;
}

/* ── Format selection ────────────────────────────────────────────────── */
.wb-export-dialog__formats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.wb-export-format {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.wb-export-format:hover {
  background: var(--wb-canvas-bg, #f8fafc);
}

.wb-export-format--selected {
  border-color: var(--wb-brand, #0066FF);
  background: var(--accent-bg, #eff6ff);
}

.wb-export-format__radio {
  width: 16px;
  height: 16px;
  accent-color: var(--wb-brand, #0066FF);
  cursor: pointer;
  flex-shrink: 0;
}

.wb-export-format__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.wb-export-format__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-export-format__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
}

.wb-export-format__desc {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Action button ───────────────────────────────────────────────────── */
.wb-export-dialog__action-btn {
  display: block;
  width: 100%;
  padding: 10px;
  background: var(--wb-brand, #0066FF);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.wb-export-dialog__action-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-export-dialog__action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Processing ──────────────────────────────────────────────────────── */
.wb-export-dialog__progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
  gap: 12px;
}

.wb-export-dialog__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--wb-toolbar-border, #e2e8f0);
  border-top-color: var(--wb-brand, #0066FF);
  border-radius: 50%;
  animation: wb-spin 0.6s linear infinite;
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

.wb-export-dialog__progress-text {
  font-size: 14px;
  color: var(--wb-fg-secondary, #64748b);
  margin: 0;
}

/* ── Ready ────────────────────────────────────────────────────────────── */
.wb-export-dialog__ready {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.wb-export-dialog__ready-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--success);
  margin: 0;
}

/* ── Error ────────────────────────────────────────────────────────────── */
.wb-export-dialog__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.wb-export-dialog__error-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--danger);
  margin: 0;
}

.wb-export-dialog__error-detail {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
  text-align: center;
}

/* ── B2.2: Fieldset & options ────────────────────────────────────────── */
.wb-export-dialog__fieldset {
  border: none;
  padding: 0;
  margin: 0 0 12px;
}

.wb-export-dialog__legend {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-fg-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.wb-export-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  cursor: pointer;
}

.wb-export-option input[type="radio"],
.wb-export-option input[type="checkbox"] {
  accent-color: var(--wb-brand, #0066FF);
  cursor: pointer;
}

.wb-export-dialog__option-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.wb-export-select {
  padding: 4px 8px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 13px;
  color: var(--wb-fg, #0f172a);
  background: var(--card-bg);
  cursor: pointer;
  margin-left: 8px;
}

.wb-export-select:focus {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -1px;
}

.wb-export-dialog__progress-elapsed {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
  margin: 0;
}

.wb-export-dialog__progress-timeout {
  font-size: 13px;
  color: var(--danger);
  font-weight: 500;
  margin: 0;
}

/* B5.2: Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wb-export-format,
  .wb-export-dialog__spinner {
    transition: none;
    animation: none;
  }
}
</style>
