<template>
  <Transition name="template-fade">
    <div v-if="isOpen" class="template-selector-backdrop" @click.self="$emit('close')">
      <div class="template-selector">
        <div class="template-selector__header">
          <h3 class="template-selector__title">{{ t('winterboard.templates.chooseTemplate') }}</h3>
          <button type="button" class="template-selector__close" @click="$emit('close')">&#x2715;</button>
        </div>
        <div class="template-selector__grid">
          <button
            v-for="tmpl in templates"
            :key="tmpl.id"
            class="template-card"
            :class="{ 'template-card--selected': selected === tmpl.id }"
            @click="selected = tmpl.id"
            @dblclick="applyAndClose(tmpl.id)"
          >
            <span class="template-card__icon">{{ tmpl.icon }}</span>
            <span class="template-card__name">{{ t(tmpl.nameKey) }}</span>
            <span class="template-card__desc">{{ t(tmpl.descriptionKey) }}</span>
          </button>
        </div>
        <div class="template-selector__footer">
          <button type="button" class="template-selector__btn template-selector__btn--secondary" @click="$emit('close')">
            {{ t('winterboard.templates.cancel') }}
          </button>
          <button type="button" class="template-selector__btn template-selector__btn--primary" :disabled="!selected" @click="applyAndClose(selected!)">
            {{ t('winterboard.templates.apply') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BOARD_TEMPLATES } from '../../data/boardTemplates'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  apply: [templateId: string]
}>()

const { t } = useI18n()
const templates = BOARD_TEMPLATES
const selected = ref<string | null>('blank')

function applyAndClose(id: string) {
  emit('apply', id)
  emit('close')
}
</script>

<style scoped>
.template-selector-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.template-selector {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  width: 480px;
  max-width: 90vw;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.template-selector__header {
  display: flex;
  align-items: center;
  padding: 20px 24px 12px;
}
.template-selector__title {
  flex: 1;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.template-selector__close {
  background: none;
  border: none;
  font-size: 18px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
}
.template-selector__close:hover { color: #475569; }

.template-selector__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 12px 24px;
  overflow-y: auto;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 12px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  text-align: center;
}
.template-card:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}
.template-card--selected {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
.template-card__icon {
  font-size: 28px;
  line-height: 1;
}
.template-card__name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}
.template-card__desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
}

.template-selector__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 24px 20px;
  border-top: 1px solid #f1f5f9;
}
.template-selector__btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}
.template-selector__btn--secondary {
  background: #f1f5f9;
  color: #475569;
}
.template-selector__btn--secondary:hover { background: #e2e8f0; }
.template-selector__btn--primary {
  background: #3b82f6;
  color: white;
}
.template-selector__btn--primary:hover { background: #2563eb; }
.template-selector__btn--primary:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

/* Transition */
.template-fade-enter-active { transition: opacity 0.2s ease-out; }
.template-fade-leave-active { transition: opacity 0.15s ease-in; }
.template-fade-enter-from,
.template-fade-leave-to { opacity: 0; }
</style>
