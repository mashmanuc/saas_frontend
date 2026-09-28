<template>
  <!-- Аркуш «📋 Сценарій» (LAW §9 v1.15, ТЗ TZ_REMOTE_SCENARIO §2.2–§2.3): відео, аудіо й
       документи дошки за сторінками. Кнопки — лише в об'єктів сторінки, що на екрані;
       до інших — через «Відкрити». Вимкнена кнопка лишається на місці, тап пояснює чому.
       Власник 2026-09-28: кожна сторінка — плитка; непарні й парні сторінки різного кольору,
       об'єкти в плитці чергуються відтінком — щоб з першого погляду було видно, де що. -->
  <div class="wb-scn" data-testid="scenario-sheet">
    <p v-if="!groups.length" class="wb-scn__empty" data-testid="scenario-empty">{{ t('winterboard.remote.scenario.empty') }}</p>

    <section
      v-for="g in groups"
      :key="g.pageIndex"
      :ref="(el) => setGroupEl(g.pageIndex, el)"
      class="wb-scn__group"
      :class="{
        'wb-scn__group--current': g.current,
        // парність за НОМЕРОМ сторінки (1, 3, 5… — непарні), а не за порядком плиток
        'wb-scn__group--odd': g.pageIndex % 2 === 0,
        'wb-scn__group--even': g.pageIndex % 2 === 1,
      }"
      :data-testid="`scenario-page-${g.pageIndex}`"
    >
      <header class="wb-scn__page">
        <span class="wb-scn__page-name">
          {{ t('winterboard.remote.scenario.page', { n: g.pageIndex + 1 }) }}<template v-if="g.current"> · {{ t('winterboard.remote.scenario.onScreen') }}</template>
        </span>
        <button
          v-if="!g.current"
          type="button"
          class="wb-scn__open"
          :data-testid="`scenario-open-${g.pageIndex}`"
          :disabled="!ready"
          @click="openPage(g.pageIndex)"
        >{{ t('winterboard.remote.scenario.open') }}</button>
      </header>

      <article
        v-for="(it, i) in g.items"
        :key="it.objectId"
        class="wb-scn__item"
        :class="{ 'wb-scn__item--dim': !g.current, 'wb-scn__item--alt': i % 2 === 1 }"
        :data-testid="`scenario-item-${it.objectId}`"
      >
        <!-- Сторінка не на екрані: лише значок і назва; тап по назві = «Відкрити» -->
        <button v-if="!g.current" type="button" class="wb-scn__name wb-scn__name--link" :disabled="!ready" @click="openPage(g.pageIndex)">
          <span class="wb-scn__icon" aria-hidden="true">{{ ICONS[it.kind] }}</span>
          <span class="wb-scn__title">{{ labelOf(it) }}</span>
        </button>
        <p v-else class="wb-scn__name">
          <span class="wb-scn__icon" aria-hidden="true">{{ ICONS[it.kind] }}</span>
          <span class="wb-scn__title">{{ labelOf(it) }}</span>
        </p>

        <template v-if="g.current">
          <p v-if="statusOf(it)" class="wb-scn__status" :class="{ 'wb-scn__status--warn': it.state === 'blocked' || it.state === 'error' }" data-testid="scenario-status">
            {{ statusOf(it) }}
          </p>

          <!-- Згорнутий: лише «Повернути» -->
          <div v-if="it.minimized" class="wb-scn__row wb-scn__row--one">
            <button type="button" class="wb-scn__btn" data-testid="scenario-restore" :disabled="!ready" @click="send('card.restore', { object_id: it.objectId })">
              ↩ {{ t('winterboard.remote.scenario.restore') }}
            </button>
          </div>

          <!-- Відео й аудіо -->
          <template v-else-if="isPlayable(it)">
            <div class="wb-scn__row">
              <button type="button" class="wb-scn__btn" data-testid="scenario-play" :disabled="!ready" @click="send('video.play', { object_id: it.objectId })">
                ▶ {{ t('winterboard.remote.scenario.play') }}
              </button>
              <button type="button" class="wb-scn__btn" data-testid="scenario-pause" :disabled="!ready" @click="send('video.pause', { object_id: it.objectId })">
                ⏸ {{ t('winterboard.remote.scenario.pause') }}
              </button>
            </div>
            <div class="wb-scn__row">
              <div class="wb-scn__slot" @click="why(it, 'quieter')">
                <button type="button" class="wb-scn__btn" data-testid="scenario-quieter" :disabled="!canQuieter(it)" @click="send('video.volume', { object_id: it.objectId, delta: -1 })">
                  🔉 {{ t('winterboard.remote.scenario.quieter') }}
                </button>
              </div>
              <div class="wb-scn__slot" @click="why(it, 'louder')">
                <button type="button" class="wb-scn__btn" data-testid="scenario-louder" :disabled="!canLouder(it)" @click="send('video.volume', { object_id: it.objectId, delta: 1 })">
                  🔊 {{ t('winterboard.remote.scenario.louder') }}
                </button>
              </div>
            </div>
            <div class="wb-scn__row" :class="{ 'wb-scn__row--one': it.kind === 'audio' }">
              <template v-if="it.kind === 'video'">
                <button v-if="focusId === it.objectId" type="button" class="wb-scn__btn" data-testid="scenario-whole-page" :disabled="!ready" @click="send('view.page', {})">
                  ▭ {{ t('winterboard.remote.fitPage') }}
                </button>
                <button v-else type="button" class="wb-scn__btn" data-testid="scenario-focus" :disabled="!ready" @click="send('view.focus', { object_id: it.objectId })">
                  ⛶ {{ t('winterboard.remote.scenario.fullscreen') }}
                </button>
              </template>
              <button type="button" class="wb-scn__btn" data-testid="scenario-minimize" :disabled="!ready" @click="send('card.minimize', { object_id: it.objectId })">
                — {{ t('winterboard.remote.scenario.minimize') }}
              </button>
            </div>
          </template>

          <!-- Презентація, PDF, документ -->
          <template v-else>
            <div v-if="it.docPages" class="wb-scn__row wb-scn__row--pager">
              <div class="wb-scn__slot" @click="why(it, 'docPrev')">
                <button type="button" class="wb-scn__btn" data-testid="scenario-doc-prev" :disabled="!canDocPrev(it)" :aria-label="t('winterboard.remote.scenario.docPrev')" @click="send('doc.page', { object_id: it.objectId, dir: -1 })">◀</button>
              </div>
              <span class="wb-scn__pager" data-testid="scenario-doc-label">{{ pagerOf(it) }}</span>
              <div class="wb-scn__slot" @click="why(it, 'docNext')">
                <button type="button" class="wb-scn__btn" data-testid="scenario-doc-next" :disabled="!canDocNext(it)" :aria-label="t('winterboard.remote.scenario.docNext')" @click="send('doc.page', { object_id: it.objectId, dir: 1 })">▶</button>
              </div>
            </div>
            <div class="wb-scn__row">
              <button v-if="focusId === it.objectId" type="button" class="wb-scn__btn" data-testid="scenario-whole-page" :disabled="!ready" @click="send('view.page', {})">
                ▭ {{ t('winterboard.remote.fitPage') }}
              </button>
              <button v-else type="button" class="wb-scn__btn" data-testid="scenario-focus" :disabled="!ready" @click="send('view.focus', { object_id: it.objectId })">
                ⛶ {{ t('winterboard.remote.scenario.fullscreen') }}
              </button>
              <button type="button" class="wb-scn__btn" data-testid="scenario-minimize" :disabled="!ready" @click="send('card.minimize', { object_id: it.objectId })">
                — {{ t('winterboard.remote.scenario.minimize') }}
              </button>
            </div>
          </template>

          <p v-if="whyItem === it.objectId && whyText" class="wb-scn__why" role="status" data-testid="scenario-why">{{ whyText }}</p>
        </template>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Аркуш «Сценарій» на пульті — лише показ стану від ноутбука і намір кнопок.
 * Команди абсолютні й для конкретного object_id; рішення приймає ноутбук (LAW §9 v1.15:
 * «схований на пульті ≠ дозволений на ноутбуці»). Тут нічого не пишеться і не
 * повторюється: загублену команду вчитель тисне ще раз (канал lossy, LAW §12).
 */
import { computed, nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RemoteScenarioItem, RemoteScenarioKind, RemoteStateDetail } from '../../composables/useRemoteChannel'

const props = defineProps<{
  scenario: RemoteStateDetail['scenario'] | null
  pageIndex: number | null
  ready: boolean
  /** Аркуш щойно відкрили — прокрутити до сторінки, що на екрані */
  open: boolean
}>()
const emit = defineEmits<{ send: [cmd: string, args: Record<string, unknown>] }>()
const { t } = useI18n()

const ICONS: Record<RemoteScenarioKind, string> = {
  video: '🎬', audio: '🎵', presentation: '📊', pdf: '📄', document: '📄',
}

const focusId = computed(() => props.scenario?.focusId ?? null)

/** Групи за сторінками в порядку сторінок; порядок усередині — як прислав ноутбук (y, x). */
const groups = computed(() => {
  const out: Array<{ pageIndex: number; current: boolean; items: RemoteScenarioItem[] }> = []
  for (const it of props.scenario?.items ?? []) {
    let g = out.find((x) => x.pageIndex === it.pageIndex)
    if (!g) {
      g = { pageIndex: it.pageIndex, current: it.pageIndex === props.pageIndex, items: [] }
      out.push(g)
    }
    g.items.push(it)
  }
  return out.sort((a, b) => a.pageIndex - b.pageIndex)
})

/** Без назви — вид і номер цього виду в списку: «Відео 2», «Аудіо 1» (ТЗ §2.2). */
const fallbackLabels = computed(() => {
  const counters: Partial<Record<RemoteScenarioKind, number>> = {}
  const labels: Record<string, string> = {}
  for (const it of props.scenario?.items ?? []) {
    const n = (counters[it.kind] = (counters[it.kind] ?? 0) + 1)
    labels[it.objectId] = t(`winterboard.remote.scenario.kind.${it.kind}`, { n })
  }
  return labels
})
function labelOf(it: RemoteScenarioItem): string {
  return it.title.trim() || fallbackLabels.value[it.objectId] || ''
}

const isPlayable = (it: RemoteScenarioItem) => it.kind === 'video' || it.kind === 'audio'

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

const canQuieter = (it: RemoteScenarioItem) => props.ready && typeof it.volume === 'number' && it.volume > 0
const canLouder = (it: RemoteScenarioItem) => props.ready && typeof it.volume === 'number' && it.volume < 100
const canDocPrev = (it: RemoteScenarioItem) => props.ready && !!it.docPages && (it.docPage ?? 0) > 0
const canDocNext = (it: RemoteScenarioItem) => props.ready && !!it.docPages && (it.docPage ?? 0) < it.docPages - 1

// ── Вид Б: тап по вимкненій кнопці пояснює причину одним рядком під об'єктом ──
const whyItem = ref<string | null>(null)
const whyText = ref('')
let whyTimer: ReturnType<typeof setTimeout> | null = null
function showWhy(id: string, text: string): void {
  whyItem.value = id
  whyText.value = text
  if (whyTimer) clearTimeout(whyTimer)
  whyTimer = setTimeout(() => { whyItem.value = null; whyText.value = '' }, 2500)
}
function why(it: RemoteScenarioItem, which: 'quieter' | 'louder' | 'docPrev' | 'docNext'): void {
  const enabled = which === 'quieter' ? canQuieter(it) : which === 'louder' ? canLouder(it)
    : which === 'docPrev' ? canDocPrev(it) : canDocNext(it)
  if (enabled) return
  if (!props.ready) { showWhy(it.objectId, t('winterboard.remote.waitingBoard')); return }
  const key = which === 'docPrev' ? 'whyFirstDocPage'
    : which === 'docNext' ? 'whyLastDocPage'
      : typeof it.volume !== 'number' ? 'whyNoVolume'
        : which === 'quieter' ? 'whyMuted' : 'whyMax'
  showWhy(it.objectId, t(`winterboard.remote.scenario.${key}`))
}
onBeforeUnmount(() => { if (whyTimer) clearTimeout(whyTimer) })

function send(cmd: string, args: Record<string, unknown>): void {
  emit('send', cmd, args)
}
function openPage(index: number): void {
  send('page.goto', { index })
}

// ── Відкриття аркуша: прокрутити до сторінки «на екрані» ──
const groupEls = new Map<number, HTMLElement>()
function setGroupEl(pageIndex: number, el: Element | ComponentPublicInstance | null): void {
  if (el instanceof HTMLElement) groupEls.set(pageIndex, el)
  else groupEls.delete(pageIndex)
}
watch(() => props.open, async (open) => {
  if (!open || props.pageIndex === null) return
  await nextTick()
  groupEls.get(props.pageIndex)?.scrollIntoView?.({ block: 'start' })
})
</script>

<style scoped>
/* Плитки (власник 2026-09-28): непарна сторінка — синя, парна — фіолетова; об'єкти всередині
   чергують світліший і темніший відтінок своєї плитки. Лише відтінки поверхні, не семантичні
   кольори (accent/success/warn/danger, v2 §5). Контраст тексту на кожному тлі ≥ 4.5:1 — з
   «warn» і приглушеною назвою; звірено для темної теми пульта. */
.wb-scn {
  --scn-odd: #1b3560; --scn-odd-a: #22406f; --scn-odd-b: #172c50;
  --scn-even: #3a2457; --scn-even-a: #452b66; --scn-even-b: #311e4a;
  /* Кнопки — світліший шар поверх будь-якої плитки, а не сірий --surface-2, що зливався б із тлом */
  --scn-btn: rgba(255, 255, 255, .12); --scn-btn-active: rgba(255, 255, 255, .2);
  --scn-status: #cbd5e1;
  display: flex; flex-direction: column; gap: 12px;
}
.wb-scn__empty { margin: 0; text-align: center; color: var(--muted); font-size: 14px; }
.wb-scn__group { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 16px; border: 2px solid transparent; }
.wb-scn__group--odd { background: var(--scn-odd); }
.wb-scn__group--even { background: var(--scn-even); }
/* Сторінка «на екрані» — та сама світла рамка; видно на обох кольорах */
.wb-scn__group--current { border-color: #cbd5e1; }
.wb-scn__page { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 40px; }
.wb-scn__page-name { font-size: 14px; font-weight: 700; color: var(--text); }
.wb-scn__open {
  min-height: 40px; padding: 0 14px; border: 1px solid rgba(255, 255, 255, .18); border-radius: 12px;
  background: var(--scn-btn); color: var(--text); font-size: 14px; font-weight: 600; -webkit-tap-highlight-color: transparent;
}
.wb-scn__open:disabled { opacity: .4; }
.wb-scn__item { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: 12px; }
.wb-scn__group--odd .wb-scn__item { background: var(--scn-odd-a); }
.wb-scn__group--odd .wb-scn__item--alt { background: var(--scn-odd-b); }
.wb-scn__group--even .wb-scn__item { background: var(--scn-even-a); }
.wb-scn__group--even .wb-scn__item--alt { background: var(--scn-even-b); }
/* Сторінка не на екрані — приглушено вміст, а не тло: чергування лишається видимим */
.wb-scn__item--dim > * { opacity: .6; }
.wb-scn__name {
  margin: 0; display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 32px;
  font-size: 15px; font-weight: 600; color: var(--text); background: transparent; border: 0; padding: 0; text-align: left;
}
.wb-scn__name--link { width: 100%; -webkit-tap-highlight-color: transparent; }
.wb-scn__icon { flex: none; font-size: 18px; }
.wb-scn__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
/* Вимкнена лишається на місці; тап ловить обгортка й пояснює причину */
.wb-scn__btn:disabled { opacity: .4; pointer-events: none; }
.wb-scn__why { margin: 0; text-align: center; font-size: 13px; color: var(--warn); }
</style>
