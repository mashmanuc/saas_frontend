<template>
  <div class="dictation-line" :data-testid="`dictation-line-${asset.id}`">
    <!-- SVG містить лише видиме чорнило й пропуски, без службових кнопок. -->
    <div v-if="data" ref="inkRef" class="dictation-line__ink" data-testid="dictation-ink" v-html="svg" />
    <p v-else class="dictation-line__error" role="alert">Речення має некоректні дані. Його не змінено.</p>
    <div
      v-if="canEdit && data"
      class="dictation-line__controls"
      data-export-hide
      data-testid="dictation-controls"
      @mousedown.stop
      @pointerdown.stop
    >
      <p v-if="actionError" role="alert">{{ actionError }}</p>
      <div class="dictation-line__words" aria-label="Виберіть слово">
        <button
          v-for="token in words" :key="token.id" type="button"
          :data-token-id="token.id" :aria-pressed="selectedWord === token.id"
          :class="{ 'is-hidden': data.hidden.words.includes(token.id) }"
          @pointerdown.stop.prevent="onPress($event, () => selectWord(token.id))"
          @click.stop="onKeyboardClick($event, () => selectWord(token.id))"
        >{{ token.text }}</button>
      </div>
      <button
        type="button" data-testid="dictation-word" :disabled="!selectedWord"
        @pointerdown.stop.prevent="onPress($event, changeWord)"
        @click.stop="onKeyboardClick($event, changeWord)"
      >{{ selectedHidden ? 'Показати слово' : 'Сховати слово' }}</button>
      <button
        type="button" data-testid="dictation-punctuation"
        @pointerdown.stop.prevent="onPress($event, changePunctuation)"
        @click.stop="onKeyboardClick($event, changePunctuation)"
      >{{ data.hidden.punct ? 'Показати пунктуацію' : 'Сховати пунктуацію' }}</button>
      <button
        type="button" data-testid="dictation-restore" :disabled="!data.hidden.punct && !data.hidden.words.length"
        @pointerdown.stop.prevent="onPress($event, restore)"
        @click.stop="onKeyboardClick($event, restore)"
      >Повернути оригінал</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WBAsset } from '../../../types/winterboard'
import { applyDictationAction, assertDictationLine, DictationLineError, type DictationAction } from '../../../board/dictationLine'
import { dictationLineSvg } from '../../../board/dictationLineSvg'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const props = withDefaults(defineProps<{ asset: WBAsset; isSelected?: boolean; interactive?: boolean; actionError?: string }>(), {
  isSelected: false, interactive: false, actionError: '',
})
const emit = defineEmits<{ 'dictation-action': [action: DictationAction] }>()
const inkRef = ref<HTMLElement | null>(null)
const selectedWord = ref<string | null>(null)
const data = computed(() => {
  try {
    assertDictationLine(props.asset.data)
    return props.asset.data
  } catch (error) {
    if (!(error instanceof DictationLineError)) throw error
    // Явна помилка на полотні, жодних часткових штрихів чи «виправлень» даних.
    return null
  }
})
const canEdit = computed(() => props.interactive && props.isSelected && !props.asset.locked)
const svg = computed(() => data.value ? dictationLineSvg(data.value) : '')
const words = computed(() => data.value?.tokens.filter((token) => token.kind === 'word') ?? [])
const selectedHidden = computed(() => Boolean(selectedWord.value && data.value?.hidden.words.includes(selectedWord.value)))
watch(() => `${props.asset.id}:${data.value?.source.revision}`, () => { selectedWord.value = null })

function selectWord(id: string) {
  if (canEdit.value && words.value.some((token) => token.id === id)) selectedWord.value = id
}
function apply(action: DictationAction) {
  if (!canEdit.value || !data.value) return
  const next = applyDictationAction(data.value, action)
  if (next !== data.value) emit('dictation-action', action)
}
function changeWord() {
  if (!data.value || !selectedWord.value) return
  apply({ action: 'set_word', token_id: selectedWord.value, hidden: !selectedHidden.value,
    source_revision: data.value.source.revision })
}
function changePunctuation() {
  if (data.value) apply({ action: 'set_punctuation', hidden: !data.value.hidden.punct,
    source_revision: data.value.source.revision })
}
function restore() {
  if (data.value) apply({ action: 'restore', source_revision: data.value.source.revision })
}
// Перо/миша: дія на pointerdown. Клік клавіатурою detail=0; звичайний click не повторює дію.
function onPress(event: PointerEvent, run: () => void) { if (event.button === 0) run() }
function onKeyboardClick(event: MouseEvent, run: () => void) { if (event.detail === 0) run() }

useExportCapture(() => props.asset.id, (signal) => snapshotElement(inkRef.value, signal))
</script>

<style scoped>
.dictation-line { position: relative; width: 100%; height: 100%; pointer-events: none; }
.dictation-line__ink { width: 100%; height: 100%; }
.dictation-line__ink :deep(svg) { display: block; width: 100%; height: 100%; }
.dictation-line__error { color: #b91c1c; background: #fff; font: 14px system-ui; padding: 8px; }
.dictation-line__controls {
  position: absolute; top: 100%; left: 0; z-index: 1; padding: 8px; background: #fff;
  border: 1px solid #94a3b8; border-radius: 8px; box-shadow: 0 3px 12px #0002;
  display: flex; flex-wrap: wrap; gap: 6px; max-width: 640px; min-width: 280px;
  pointer-events: auto; font: 14px system-ui;
}
.dictation-line__words { display: flex; flex-wrap: wrap; gap: 4px; width: 100%; max-height: 120px; overflow: auto; }
button { border: 1px solid #cbd5e1; border-radius: 5px; background: #f8fafc; padding: 6px 9px; color: #134e4a; cursor: pointer; }
button[aria-pressed="true"] { border-color: #047857; background: #d1fae5; }
button.is-hidden { text-decoration: underline dotted; }
button:disabled { opacity: .5; cursor: default; }
</style>
