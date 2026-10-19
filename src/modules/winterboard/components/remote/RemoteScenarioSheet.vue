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
        :class="{ 'wb-scn__item--dim': !g.current, 'wb-scn__item--alt': i % 2 === 1, 'wb-scn__item--current': selectable && it.objectId === currentId }"
        :data-testid="`scenario-item-${it.objectId}`"
      >
        <!-- Сторінка не на екрані: лише значок і назва; тап по назві = «Відкрити».
             v1.35 (етап 2): ноутбук уміє поточний об'єкт для всіх видів — тап по назві відкриває сторінку і робить
             цей об'єкт поточним (на головному екрані — його кнопки); на сторінці, що на екрані, — лише обирає. -->
        <button v-if="!g.current || selectable" type="button" class="wb-scn__name wb-scn__name--link" :data-testid="`scenario-name-${it.objectId}`" :disabled="!ready" @click="pick(g, it)">
          <span class="wb-scn__icon" aria-hidden="true">{{ ICONS[it.kind] }}</span>
          <span class="wb-scn__title">{{ labelOf(it) }}</span>
          <span v-if="selectable && it.objectId === currentId" class="wb-scn__current" data-testid="scenario-current">{{ t('winterboard.remote.scenario.current') }}</span>
        </button>
        <p v-else class="wb-scn__name">
          <span class="wb-scn__icon" aria-hidden="true">{{ ICONS[it.kind] }}</span>
          <span class="wb-scn__title">{{ labelOf(it) }}</span>
        </p>

        <template v-if="g.current">
          <RemoteObjectControls :item="it" :focus-id="focusId" :ready="ready" @send="send" />
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
import { computed, nextTick, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RemoteScenarioItem, RemoteScenarioKind, RemoteStateDetail } from '../../composables/useRemoteChannel'
import RemoteObjectControls from './RemoteObjectControls.vue'

const props = defineProps<{
  scenario: RemoteStateDetail['scenario'] | null
  pageIndex: number | null
  ready: boolean
  /** Аркуш щойно відкрили — прокрутити до сторінки, що на екрані */
  open: boolean
  /** v1.35: ноутбук оголосив 'objects' — тап по назві обирає об'єкт (поточний об'єкт пульта для всіх видів). */
  selectable?: boolean
  /** v1.35: поточний об'єкт пульта — позначено в списку. */
  currentId?: string | null
}>()
const emit = defineEmits<{ send: [cmd: string, args: Record<string, unknown>] }>()
const { t } = useI18n()

const ICONS: Record<RemoteScenarioKind, string> = {
  video: '🎬', audio: '🎵', presentation: '📊', pdf: '📄', document: '📄', card: '📘', image: '🖼',
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

function send(cmd: string, args: Record<string, unknown>): void {
  emit('send', cmd, args)
}
function openPage(index: number): void {
  send('page.goto', { index })
}
/**
 * Тап по назві. Без 'objects' — як до v1.35: «Відкрити» сторінку. З ним (Р2 етапу 2) — сторінка, потім вибір:
 * ноутбук виконує по черзі, а правило «лише об'єкт поточної сторінки» (v1.34) не змінюється.
 */
function pick(g: { pageIndex: number; current: boolean }, it: RemoteScenarioItem): void {
  if (!props.selectable) { openPage(g.pageIndex); return }
  if (!g.current) openPage(g.pageIndex)
  send('object.select', { object_id: it.objectId })
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
/* Автопрокрутка до поточної сторінки зупиняється під закріпленою шапкою аркуша (40 px + відступ). */
.wb-scn__group { scroll-margin-top: 56px; }
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
/* Стан і кнопки об'єкта — у `RemoteObjectControls.vue` (v1.35: той самий блок на головному екрані). */
/* v1.35: поточний об'єкт пульта — світла рамка й позначка біля назви */
.wb-scn__item--current { box-shadow: inset 0 0 0 2px #5eead4; }
.wb-scn__current { flex: none; margin-left: auto; padding: 2px 8px; border-radius: 8px; background: #0f766e; color: #fff; font-size: 12px; font-weight: 700; }
</style>
