<template>
  <!-- Кнопки одного об'єкта «Сценарію» (LAW §9 v1.15, v1.25): стан, ▶/⏸, гучність, сторінки документа,
       «На весь екран», «Згорнути» / «Повернути». Один блок для двох місць (v1.35, етап 2 поточного об'єкта):
       аркуш «Сценарій» і головний екран пульта — ті самі кнопки, ті самі команди з адресою, ті самі причини. -->
  <div class="wb-obj" :class="{ 'wb-obj--main': variant === 'main' }" :data-testid="`${idPrefix}-controls`">
    <p
      v-if="statusOf(item)"
      class="wb-scn__status"
      :class="{
        'wb-scn__status--warn': item.state === 'blocked' || item.state === 'error',
        'wb-scn__status--playing': isPlayingNow(item),
      }"
      :data-testid="`${idPrefix}-status`"
    >
      <span v-if="isPlayingNow(item)" aria-hidden="true">● </span>{{ statusOf(item) }}
    </p>

    <!-- Згорнутий: лише «Повернути» -->
    <div v-if="item.minimized" class="wb-scn__row wb-scn__row--one">
      <button type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-restore`" :disabled="!ready" @click="send('card.restore', { object_id: item.objectId })">
        ↩ {{ t('winterboard.remote.scenario.restore') }}
      </button>
    </div>

    <!-- Відео й аудіо -->
    <template v-else-if="isPlayable(item)">
      <div class="wb-scn__row">
        <!-- Власник 2026-09-28: з кнопок видно стан — «▶ Грає» зелена, «⏸ На паузі» підсвічена -->
        <button
          type="button"
          class="wb-scn__btn"
          :class="{ 'wb-scn__btn--playing': item.state === 'playing' }"
          :data-testid="`${idPrefix}-play`"
          :aria-pressed="item.state === 'playing'"
          :disabled="!ready"
          @click="send('video.play', { object_id: item.objectId })"
        >
          ▶ {{ playLabel(item.state) }}
        </button>
        <button
          type="button"
          class="wb-scn__btn"
          :class="{ 'wb-scn__btn--paused': item.state === 'paused' }"
          :data-testid="`${idPrefix}-pause`"
          :aria-pressed="item.state === 'paused'"
          :disabled="!ready"
          @click="send('video.pause', { object_id: item.objectId })"
        >
          ⏸ {{ pauseLabel(item.state) }}
        </button>
      </div>
      <div class="wb-scn__row">
        <div class="wb-scn__slot" @click="why('quieter')">
          <button type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-quieter`" :disabled="!canQuieter" @click="send('video.volume', { object_id: item.objectId, delta: -1 })">
            🔉 {{ t('winterboard.remote.scenario.quieter') }}
          </button>
        </div>
        <div class="wb-scn__slot" @click="why('louder')">
          <button type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-louder`" :disabled="!canLouder" @click="send('video.volume', { object_id: item.objectId, delta: 1 })">
            🔊 {{ t('winterboard.remote.scenario.louder') }}
          </button>
        </div>
      </div>
      <div class="wb-scn__row" :class="{ 'wb-scn__row--one': item.kind === 'audio' }">
        <template v-if="item.kind === 'video'">
          <button v-if="focusId === item.objectId" type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-whole-page`" :disabled="!ready" @click="send('view.page', {})">
            ▭ {{ t('winterboard.remote.fitPage') }}
          </button>
          <button v-else type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-focus`" :disabled="!ready" @click="send('view.focus', { object_id: item.objectId })">
            ⛶ {{ t('winterboard.remote.scenario.fullscreen') }}
          </button>
        </template>
        <button type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-minimize`" :disabled="!ready" @click="send('card.minimize', { object_id: item.objectId })">
          — {{ t('winterboard.remote.scenario.minimize') }}
        </button>
      </div>
    </template>

    <!-- Презентація, PDF, документ; v1.25 — картинка (⛶ і «Згорнути») і картка (лише «Згорнути») -->
    <template v-else>
      <div v-if="item.docPages" class="wb-scn__row wb-scn__row--pager">
        <div class="wb-scn__slot" @click="why('docPrev')">
          <button type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-doc-prev`" :disabled="!canDocPrev" :aria-label="t('winterboard.remote.scenario.docPrev')" @click="send('doc.page', { object_id: item.objectId, dir: -1 })">◀</button>
        </div>
        <span class="wb-scn__pager" :data-testid="`${idPrefix}-doc-label`">{{ pagerOf(item) }}</span>
        <div class="wb-scn__slot" @click="why('docNext')">
          <button type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-doc-next`" :disabled="!canDocNext" :aria-label="t('winterboard.remote.scenario.docNext')" @click="send('doc.page', { object_id: item.objectId, dir: 1 })">▶</button>
        </div>
      </div>
      <div class="wb-scn__row" :class="{ 'wb-scn__row--one': item.kind === 'card' }">
        <!-- Картка «на весь екран» не має сенсу: текст не росте з полотном (§9.C) -->
        <template v-if="item.kind !== 'card'">
          <button v-if="focusId === item.objectId" type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-whole-page`" :disabled="!ready" @click="send('view.page', {})">
            ▭ {{ t('winterboard.remote.fitPage') }}
          </button>
          <button v-else type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-focus`" :disabled="!ready" @click="send('view.focus', { object_id: item.objectId })">
            ⛶ {{ t('winterboard.remote.scenario.fullscreen') }}
          </button>
        </template>
        <button type="button" class="wb-scn__btn" :data-testid="`${idPrefix}-minimize`" :disabled="!ready" @click="send('card.minimize', { object_id: item.objectId })">
          — {{ t('winterboard.remote.scenario.minimize') }}
        </button>
      </div>
    </template>

    <p v-if="whyText" class="wb-scn__why" role="status" :data-testid="`${idPrefix}-why`">{{ whyText }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * Кнопки одного об'єкта для пульта — лише показ стану від ноутбука і намір кнопок. Команди абсолютні й для
 * конкретного object_id; рішення приймає ноутбук (LAW §9 v1.15: «схований на пульті ≠ дозволений на ноутбуці»).
 * Тут нічого не пишеться і не повторюється: загублену команду вчитель тисне ще раз (канал lossy, LAW §12).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RemoteScenarioItem } from '../../composables/useRemoteChannel'

const props = withDefaults(defineProps<{
  item: RemoteScenarioItem
  focusId: string | null
  ready: boolean
  /** Префікс `data-testid`: аркуш — `scenario` (як до v1.35), головний екран — `object`. */
  idPrefix?: string
  /** `main` — кнопки в кольорі головного екрана пульта; `sheet` — поверх плитки «Сценарію». */
  variant?: 'sheet' | 'main'
}>(), { idPrefix: 'scenario', variant: 'sheet' })
const emit = defineEmits<{ send: [cmd: string, args: Record<string, unknown>] }>()
const { t } = useI18n()

const isPlayable = (it: RemoteScenarioItem) => it.kind === 'video' || it.kind === 'audio'

/** Грає просто зараз (незгорнутий програвач) — зелена крапка в рядку стану. */
function isPlayingNow(it: RemoteScenarioItem): boolean {
  return isPlayable(it) && !it.minimized && it.state === 'playing'
}

/** Підпис ▶ за станом програвача: «Грає» / «Запускається…» / «Грати». */
function playLabel(state: RemoteScenarioItem['state']): string {
  if (state === 'playing') return t('winterboard.remote.video.state.playing')
  if (state === 'loading') return t('winterboard.remote.video.starting')
  return t('winterboard.remote.scenario.play')
}

/** Підпис ⏸: «На паузі», коли стоїть на паузі, інакше «Пауза». */
function pauseLabel(state: RemoteScenarioItem['state']): string {
  return state === 'paused' ? t('winterboard.remote.video.state.paused') : t('winterboard.remote.scenario.pause')
}

function statusOf(it: RemoteScenarioItem): string {
  if (it.minimized) return t('winterboard.remote.scenario.minimized')
  if (isPlayable(it)) {
    const state = it.state ?? 'idle'
    const text = state === 'error'
      ? t(`winterboard.remote.video.playerError.${it.error ?? 'playback'}`)
      : state === 'blocked'
        ? t('winterboard.remote.video.blocked')
        : t(`winterboard.remote.video.state.${state}`)
    return typeof it.volume === 'number'
      ? `${text} · ${t('winterboard.remote.scenario.volume', { v: it.volume })}`
      : text
  }
  if (!it.docPages) return ''
  const key = it.kind === 'presentation' ? 'slideOf' : 'pageOf'
  return t(`winterboard.remote.scenario.${key}`, { n: (it.docPage ?? 0) + 1, total: it.docPages })
}

function pagerOf(it: RemoteScenarioItem): string {
  const key = it.kind === 'presentation' ? 'slideShort' : 'pageShort'
  return t(`winterboard.remote.scenario.${key}`, { n: (it.docPage ?? 0) + 1, total: it.docPages })
}

const canQuieter = computed(() => props.ready && typeof props.item.volume === 'number' && props.item.volume > 0)
const canLouder = computed(() => props.ready && typeof props.item.volume === 'number' && props.item.volume < 100)
const canDocPrev = computed(() => props.ready && !!props.item.docPages && (props.item.docPage ?? 0) > 0)
const canDocNext = computed(() => props.ready && !!props.item.docPages && (props.item.docPage ?? 0) < props.item.docPages - 1)

// ── Вид Б: тап по вимкненій кнопці пояснює причину одним рядком під об'єктом ──
const whyText = ref('')
let whyTimer: ReturnType<typeof setTimeout> | null = null
function showWhy(text: string): void {
  whyText.value = text
  if (whyTimer) clearTimeout(whyTimer)
  whyTimer = setTimeout(() => { whyText.value = '' }, 2500)
}
function why(which: 'quieter' | 'louder' | 'docPrev' | 'docNext'): void {
  const enabled = which === 'quieter' ? canQuieter.value : which === 'louder' ? canLouder.value
    : which === 'docPrev' ? canDocPrev.value : canDocNext.value
  if (enabled) return
  if (!props.ready) { showWhy(t('winterboard.remote.waitingBoard')); return }
  const it = props.item
  const key = which === 'docPrev' ? 'whyFirstDocPage'
    : which === 'docNext' ? 'whyLastDocPage'
      : typeof it.volume !== 'number' ? 'whyNoVolume'
        : which === 'quieter' ? 'whyMuted' : 'whyMax'
  showWhy(t(`winterboard.remote.scenario.${key}`))
}
// Інший об'єкт — стара причина не про нього
watch(() => props.item.objectId, () => { whyText.value = '' })
onBeforeUnmount(() => { if (whyTimer) clearTimeout(whyTimer) })

function send(cmd: string, args: Record<string, unknown>): void {
  emit('send', cmd, args)
}
</script>

<style scoped>
/* Кольори — як у плитці «Сценарію» (2026-09-28); на головному екрані — кнопки пульта (`--surface`). */
.wb-obj {
  --scn-btn: rgba(255, 255, 255, .12); --scn-btn-active: rgba(255, 255, 255, .2);
  --scn-status: #cbd5e1;
  display: flex; flex-direction: column; gap: 8px;
}
.wb-obj--main { --scn-btn: #1e293b; --scn-btn-active: #334155; }
.wb-scn__status { margin: 0; font-size: 13px; color: var(--scn-status); }
.wb-scn__status--warn { color: var(--warn); font-weight: 600; }
/* Кнопки — 48 px, два стовпці (ТЗ §2.3, відступи як v2 §5) */
.wb-scn__row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.wb-scn__row--one { grid-template-columns: minmax(0, 1fr); }
.wb-scn__row--pager { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr); align-items: center; }
.wb-scn__pager { text-align: center; font-size: 15px; font-weight: 700; color: var(--text); }
.wb-scn__slot { display: flex; }
.wb-scn__btn {
  flex: 1; width: 100%; min-height: 48px; border: 0; border-radius: 14px; background: var(--scn-btn); color: var(--text);
  font-size: 15px; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wb-scn__btn:active { background: var(--scn-btn-active); }
/* Власник 2026-09-28: стан відтворення видно з витягнутої руки — кнопка поточного стану підсвічена */
.wb-scn__btn--playing { background: var(--success); color: #fff; box-shadow: inset 0 0 0 2px #5eead4; }
.wb-scn__btn--paused { background: rgba(255, 255, 255, .26); box-shadow: inset 0 0 0 2px #cbd5e1; }
.wb-scn__status--playing { color: #5eead4; font-weight: 600; }
/* Вимкнена лишається на місці; тап ловить обгортка й пояснює причину */
.wb-scn__btn:disabled { opacity: .4; pointer-events: none; }
.wb-scn__why { margin: 0; text-align: center; font-size: 13px; color: var(--warn); }
</style>
