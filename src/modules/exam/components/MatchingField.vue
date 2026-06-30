<!--
  MatchingField — НМТ-завдання на відповідність: УСІ варіанти (А–Д) видимі одразу
  як пул, ліворуч — твердження (1-3) зі слотами. Призначення: ПЕРЕТЯГУВАННЯ
  (pointer-події — працює пером/тачем/мишею) АБО тап-варіант → тап-слот.
  Жодних випадайок/«вгадування». Pointer-only (графічний планшет). Ref: matching UX.
-->
<template>
  <div class="mf" :class="{ 'is-disabled': disabled }">
    <!-- ЛІВОРУЧ: твердження + слоти -->
    <div class="mf__rows">
      <div v-for="l in leftItems" :key="l.id" class="mf__row">
        <span class="mf__num">{{ l.id }}</span>
        <span class="mf__left" v-html="latex(l.text)" />
        <div
          class="mf__slot"
          :data-slot-left="l.id"
          :class="{ 'is-filled': !!pairs[l.id], 'is-target': !!activeRight && !pairs[l.id] }"
          @pointerup="onSlotTap(l.id)"
        >
          <template v-if="pairs[l.id]">
            <span class="mf__slot-chip"><b>{{ pairs[l.id] }}</b><span v-html="latex(rightText(pairs[l.id]))" /></span>
            <button v-if="!disabled" type="button" class="mf__clear" @pointerup.stop="clear(l.id)">×</button>
          </template>
          <span v-else class="mf__ph">{{ activeRight ? t('exam.match.placeHere') : t('exam.match.empty') }}</span>
        </div>
      </div>
    </div>

    <!-- ПРАВОРУЧ: пул усіх варіантів (завжди видимі) -->
    <div class="mf__pool">
      <div class="mf__pool-title">{{ t('exam.match.options') }}</div>
      <div class="mf__opts">
        <button
          v-for="r in rightItems"
          :key="r.id"
          type="button"
          class="mf__opt"
          :class="{ 'is-active': activeRight === r.id, 'is-used': used.has(r.id) }"
          @pointerdown="onOptDown(r.id, $event)"
        >
          <b class="mf__letter">{{ r.id }}</b>
          <span class="mf__opt-txt" v-html="latex(r.text)" />
        </button>
      </div>
    </div>

    <!-- привид при перетягуванні -->
    <div v-if="drag.active" class="mf__ghost" :style="{ left: drag.x + 'px', top: drag.y + 'px' }">
      <b>{{ drag.rid }}</b>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

const props = defineProps<{
  leftItems: Array<{ id: string; text: string }>
  rightItems: Array<{ id: string; text: string }>
  answer: Record<string, any> | null
  disabled?: boolean
}>()
const emit = defineEmits<{ (e: 'change', answer: Record<string, any>): void }>()
const { t } = useI18n()

const pairs = reactive<Record<string, string>>({})
const activeRight = ref<string | null>(null)
const drag = reactive({ active: false, moved: false, rid: '', x: 0, y: 0, startX: 0, startY: 0 })

const used = computed(() => new Set(Object.values(pairs)))

function latex(s: string): string {
  return renderTextWithLatex(s)
}
function rightText(rid: string): string {
  return props.rightItems.find((r) => r.id === rid)?.text ?? ''
}
function commit() {
  const out: [string, string][] = Object.entries(pairs).filter(([, r]) => r) as [string, string][]
  emit('change', { pairs: out })
}
function assign(leftId: string, rid: string) {
  pairs[leftId] = rid
  activeRight.value = null
  commit()
}
function clear(leftId: string) {
  if (props.disabled) return
  delete pairs[leftId]
  commit()
}

function onOptDown(rid: string, e: PointerEvent) {
  if (props.disabled) return
  drag.active = false
  drag.moved = false
  drag.rid = rid
  drag.startX = e.clientX
  drag.startY = e.clientY
  drag.x = e.clientX
  drag.y = e.clientY
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  } catch {}
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
function onMove(e: PointerEvent) {
  drag.x = e.clientX
  drag.y = e.clientY
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
    drag.moved = true
    drag.active = true
  }
}
function onUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  if (drag.moved) {
    // ПЕРЕТЯГУВАННЯ: знайти слот під вказівником
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const slot = el?.closest('[data-slot-left]') as HTMLElement | null
    if (slot?.dataset.slotLeft) assign(slot.dataset.slotLeft, drag.rid)
  } else {
    // ТАП: вибрати/зняти активний варіант (далі тап по слоту призначить)
    activeRight.value = activeRight.value === drag.rid ? null : drag.rid
  }
  drag.active = false
  drag.moved = false
}
function onSlotTap(leftId: string) {
  if (props.disabled || drag.moved) return
  if (activeRight.value) assign(leftId, activeRight.value)
}

function hydrate() {
  for (const k of Object.keys(pairs)) delete pairs[k]
  for (const [l, r] of props.answer?.pairs || []) pairs[l] = r
  activeRight.value = null
}
watch(() => props.answer, hydrate, { immediate: true })
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
})
</script>

<style scoped>
.mf { --mf-accent: #1f3a5f; --mf-soft: rgba(31,58,95,0.08); --mf-line: var(--border-color, rgba(0,0,0,0.14)); display: flex; flex-direction: column; gap: 18px; touch-action: none; }
[data-theme="dark"] .mf { --mf-accent: #7aa2d6; --mf-soft: rgba(122,162,214,0.16); }
.mf.is-disabled { opacity: 0.85; }

.mf__rows { display: flex; flex-direction: column; gap: 10px; }
.mf__row { display: flex; align-items: center; gap: 10px; }
.mf__num { width: 24px; height: 24px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--mf-soft); color: var(--mf-accent); font-size: 13px; font-weight: 700; }
.mf__left { flex: 1; min-width: 0; font-size: 15px; line-height: 1.4; }
.mf__slot { flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 2px dashed var(--mf-line); border-radius: 10px; background: var(--card-bg, #fff); }
.mf__slot.is-filled { border-style: solid; border-color: var(--mf-accent); background: var(--mf-soft); }
.mf__slot.is-target { border-color: var(--mf-accent); box-shadow: 0 0 0 3px var(--mf-soft); }
.mf__slot-chip { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; font-size: 15px; overflow: hidden; }
.mf__slot-chip b { flex-shrink: 0; color: var(--mf-accent); }
.mf__ph { flex: 1; color: var(--text-secondary, #9ca3af); font-size: 14px; }
.mf__clear { flex-shrink: 0; width: 24px; height: 24px; border: none; border-radius: 6px; background: rgba(0,0,0,0.06); color: inherit; font-size: 16px; line-height: 1; cursor: pointer; }

.mf__pool { border-top: 1px solid var(--mf-line); padding-top: 14px; }
.mf__pool-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary, #9ca3af); margin-bottom: 8px; }
.mf__opts { display: flex; flex-wrap: wrap; gap: 8px; }
.mf__opt { display: flex; align-items: center; gap: 8px; max-width: 100%; padding: 9px 13px; border: 1px solid var(--mf-line); border-radius: 10px; background: var(--card-bg, #fff); color: inherit; font-size: 15px; cursor: grab; text-align: left; user-select: none; }
.mf__opt:active { cursor: grabbing; }
.mf__opt.is-active { border-color: var(--mf-accent); background: var(--mf-soft); box-shadow: 0 0 0 3px var(--mf-soft); }
.mf__opt.is-used { opacity: 0.55; }
.mf__letter { flex-shrink: 0; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--mf-soft); color: var(--mf-accent); font-size: 13px; font-weight: 700; }
.mf__opt-txt { min-width: 0; line-height: 1.35; }

.mf__ghost { position: fixed; z-index: 1000; transform: translate(-50%, -130%); pointer-events: none; background: var(--mf-accent); color: #fff; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: 700; box-shadow: 0 6px 16px rgba(0,0,0,0.3); }

.mf :deep(.katex) { font-size: 1.02em; }
</style>
