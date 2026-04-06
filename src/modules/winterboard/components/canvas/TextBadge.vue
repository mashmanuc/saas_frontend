<template>
  <div
    class="wb-text-badge-icon"
    :class="{ 'wb-text-badge-icon--open': isOpen, 'wb-text-badge-icon--has-text': hasText }"
    :title="hasText ? t('winterboard.objectText.view') : t('winterboard.objectText.add')"
    @click.stop="emit('click')"
  >
    <span class="wb-text-badge-letter">Т</span>
  </div>
</template>

<script setup lang="ts">
// WB: TextBadge — small 24×24 icon on top-right corner of objects with text interaction.
// Same pattern as AudioBadge. Container layer uses pointer-events: none.

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  objectId: string
  hasText: boolean
  isOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.wb-text-badge-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  pointer-events: auto;
  font-size: 13px;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
  user-select: none;
}

.wb-text-badge-letter {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  color: #64748b;
  transition: color 0.15s;
}

.wb-text-badge-icon:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.wb-text-badge-icon--has-text {
  background: rgba(245, 158, 11, 0.15);
}

.wb-text-badge-icon--has-text .wb-text-badge-letter {
  color: #d97706;
}

.wb-text-badge-icon--open {
  background: rgba(59, 130, 246, 0.15);
}

.wb-text-badge-icon--open .wb-text-badge-letter {
  color: #2563eb;
}
</style>
