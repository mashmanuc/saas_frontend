<template>
  <section class="material-panel">
    <header class="material-panel__head">
      <h3>{{ t('winterboard.materials.title', { name: assetName }) }}</h3>
      <button type="button" class="material-panel__close" @click="$emit('close')">
        {{ t('winterboard.materials.close') }}
      </button>
    </header>

    <p v-if="loading" class="material-panel__loading">{{ t('winterboard.materials.loading') }}</p>

    <!-- Прапорець вимкнено — це не помилка тьютора, і текст має це казати -->
    <p v-else-if="disabled" class="material-panel__disabled" role="status">
      {{ t('winterboard.materials.disabledOnServer') }}
    </p>

    <p v-else-if="error" class="material-panel__error" role="alert">{{ error }}</p>

    <template v-else>
      <!--
        ЦІНА ДО ЗАПУСКУ, і великим. Це головна чесність 6-1: тьютор має
        побачити, скільки викликів спишеться, ПЕРШ ніж натиснути, а не
        дізнатись із рахунку. Тому блок стоїть над кнопкою, а не під нею
        і не в тултипі.
      -->
      <div v-if="cost" class="material-panel__cost">
        <p class="material-panel__cost-main">
          {{ t('winterboard.materials.costMain', {
            pages: cost.total_pages, calls: cost.total_calls }) }}
        </p>
        <p class="material-panel__cost-detail">
          {{ t('winterboard.materials.costBreakdown', {
            free: cost.text_layer_pages, vision: cost.vision_calls, ocr: cost.ocr_calls }) }}
          <span v-if="cost.cached_pages">
            · {{ t('winterboard.materials.costCached', { n: cost.cached_pages }) }}
          </span>
        </p>
        <p v-if="cost.skipped_pages.length" class="material-panel__cost-detail">
          {{ t('winterboard.materials.costCeiling', {
            max: cost.max_pages, n: cost.skipped_pages.length }) }}
        </p>
        <p v-if="cost.upper_bound && cost.total_calls" class="material-panel__cost-detail">
          {{ t('winterboard.materials.costUpperBound') }}
        </p>
      </div>

      <div class="material-panel__actions">
        <button
          type="button"
          :disabled="running || !cost"
          @click="onExtract"
        >{{ t('winterboard.materials.read') }}</button>

        <button
          v-if="pages.length"
          type="button"
          :disabled="running"
          @click="$emit('make-lesson')"
        >{{ t('winterboard.materials.makeLesson') }}</button>
      </div>

      <!--
        202 — це НЕ «готово». Задача пішла в чергу, сторінки з'являються
        поступово, тож показуємо стан «читаю» і доопитуємо GET.
      -->
      <p v-if="running" class="material-panel__running" role="status">
        {{ t('winterboard.materials.reading', { done: doneCount, total: cost?.total_pages || 0 }) }}
      </p>

      <p v-if="report?.message" class="material-panel__message">{{ report.message }}</p>

      <ul v-if="pages.length" class="material-panel__pages">
        <MaterialPageRow
          v-for="p in pages"
          :key="p.page_no"
          :page="p"
          :busy="running"
          @confirm="onConfirm"
        />
      </ul>

      <p v-else-if="!running" class="material-panel__empty">
        {{ t('winterboard.materials.notReadYet') }}
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import materialsApi, {
  type CostEstimate, type ExtractReport, type MaterialPage,
} from '../../api/materials'
import MaterialPageRow from './MaterialPageRow.vue'

const props = defineProps<{ assetId: number; assetName: string }>()
defineEmits<{ (e: 'close'): void; (e: 'make-lesson'): void }>()

const { t } = useI18n()

const pages = ref<MaterialPage[]>([])
const cost = ref<CostEstimate | null>(null)
const report = ref<ExtractReport | null>(null)
const loading = ref(false)
const running = ref(false)
const disabled = ref(false)
const error = ref<string | null>(null)

// Інтервал полінгу — 2 с: сторінка OCR іде ~3 с (G-OCR §4.5), тож частіше
// питати немає сенсу, а рідше — тьютор дивиться в застиглий екран.
const POLL_MS = 2000
let timer: ReturnType<typeof setInterval> | null = null

const doneCount = computed(() => pages.value.filter((p) => p.status === 'done').length)

function stopPolling(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function load(): Promise<void> {
  try {
    const res = await materialsApi.read(props.assetId)
    pages.value = res.pages || []
    cost.value = res.cost_estimate
    disabled.value = false
    error.value = null
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      disabled.value = true
    } else {
      error.value = t('winterboard.materials.loadFailed')
    }
  }
}

async function onExtract(): Promise<void> {
  running.value = true
  report.value = null
  try {
    const res = await materialsApi.extract(props.assetId)
    if ('task_id' in res) {
      // Черга: доопитуємо, поки не з'являться всі сторінки.
      timer = setInterval(pollOnce, POLL_MS)
    } else {
      report.value = res
      await load()
      running.value = false
    }
  } catch {
    error.value = t('winterboard.materials.extractFailed')
    running.value = false
  }
}

async function pollOnce(): Promise<void> {
  await load()
  const expected = cost.value?.total_pages || 0
  const settled = pages.value.filter(
    (p) => p.status === 'done' || p.status === 'failed').length
  if (expected && settled >= expected) {
    stopPolling()
    running.value = false
  }
}

async function onConfirm(pageNo: number): Promise<void> {
  try {
    await materialsApi.confirm(props.assetId, [pageNo])
    await load()
  } catch {
    error.value = t('winterboard.materials.confirmFailed')
  }
}

onMounted(() => {
  loading.value = true
  load().finally(() => { loading.value = false })
})
onBeforeUnmount(stopPolling)

defineExpose({ load, pages, cost, running, disabled })
</script>

<style scoped>
.material-panel { border: 1px solid rgba(0,0,0,0.12); padding: 0.9em 1.1em; margin: 1em 0; }
.material-panel__head { display: flex; justify-content: space-between; align-items: center; }
.material-panel__close { background: none; border: 0; cursor: pointer; text-decoration: underline; }
/* Ціна — велика й перша, не виноска */
.material-panel__cost { border-left: 4px solid #2563eb; background: rgba(37,99,235,0.06);
  padding: 0.6em 0.9em; margin: 0.8em 0; }
.material-panel__cost-main { font-size: 1.05em; font-weight: 600; margin: 0; }
.material-panel__cost-detail { font-size: 0.85em; opacity: 0.8; margin: 0.2em 0 0; }
.material-panel__actions { display: flex; gap: 0.6em; margin: 0.8em 0; }
.material-panel__pages { padding: 0; margin: 0.6em 0 0; }
.material-panel__disabled { padding: 0.6em 0.9em; background: rgba(0,0,0,0.05); }
.material-panel__error { color: #dc3545; }
.material-panel__running { font-size: 0.9em; }
.material-panel__message { font-size: 0.86em; border-left: 3px solid #d97706;
  padding-left: 0.6em; }
.material-panel__empty { font-size: 0.9em; opacity: 0.75; }
</style>
