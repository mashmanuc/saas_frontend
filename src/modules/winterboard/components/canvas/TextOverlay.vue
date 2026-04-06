<template>
  <div
    class="wb-text-overlay"
    @mousedown.stop
    @click.stop
  >
    <div class="wb-text-overlay__header">
      <span class="wb-text-overlay__title">{{ t('winterboard.objectText.title') }}</span>
      <button class="wb-text-overlay__close" @click="emit('close')">×</button>
    </div>
    <textarea
      ref="textareaRef"
      class="wb-text-overlay__textarea"
      :value="text"
      :placeholder="t('winterboard.objectText.placeholder')"
      :readonly="readonly"
      @input="onInput"
      @keydown.stop
    />
    <div v-if="!readonly" class="wb-text-overlay__footer">
      <button
        v-if="text"
        class="wb-text-overlay__btn wb-text-overlay__btn--delete"
        @click="emit('delete')"
      >
        {{ t('winterboard.objectText.delete') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  text: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
})

const emit = defineEmits<{
  update: [text: string]
  close: []
  delete: []
}>()

const { t } = useI18n()
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function onInput(e: Event) {
  const value = (e.target as HTMLTextAreaElement).value
  emit('update', value)
}

onMounted(() => {
  nextTick(() => {
    textareaRef.value?.focus()
  })
})
</script>

<style scoped>
.wb-text-overlay {
  width: 260px;
  background: var(--wb-bg-primary, #ffffff);
  border: 1px solid var(--wb-border, #e2e8f0);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
}

.wb-text-overlay__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--wb-border, #e2e8f0);
  background: var(--wb-bg-secondary, #f8fafc);
  border-radius: 8px 8px 0 0;
}

.wb-text-overlay__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-secondary, #64748b);
}

.wb-text-overlay__close {
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  color: var(--wb-text-secondary, #64748b);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.wb-text-overlay__close:hover {
  background: var(--wb-bg-hover, #f1f5f9);
  color: var(--wb-text-primary, #334155);
}

.wb-text-overlay__textarea {
  min-height: 80px;
  max-height: 200px;
  padding: 8px 10px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--wb-text-primary, #1e293b);
  background: transparent;
}

.wb-text-overlay__textarea::placeholder {
  color: var(--wb-text-secondary, #94a3b8);
}

.wb-text-overlay__textarea[readonly] {
  cursor: default;
  resize: none;
  background: var(--wb-bg-secondary, #f8fafc);
}

.wb-text-overlay__footer {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px 6px;
  border-top: 1px solid var(--wb-border, #e2e8f0);
}

.wb-text-overlay__btn {
  font-size: 11px;
  padding: 3px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.wb-text-overlay__btn--delete {
  background: none;
  color: #ef4444;
}

.wb-text-overlay__btn--delete:hover {
  background: rgba(239, 68, 68, 0.1);
}
</style>
