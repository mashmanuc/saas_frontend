<template>
  <a
    class="wb-link-badge-icon"
    :class="{ 'wb-link-badge-icon--has-link': hasLink }"
    :href="hasLink ? linkUrl : '#'"
    :title="tooltipText"
    target="_blank"
    rel="noopener noreferrer"
    @click="onClick"
    @mousedown.stop
    @pointerdown.stop
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <!-- Heroicons-style link icon (two slanted chain segments) -->
      <path
        d="M9.172 14.828a4 4 0 0 1 0-5.656l3-3a4 4 0 1 1 5.656 5.656l-1.5 1.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M14.828 9.172a4 4 0 0 1 0 5.656l-3 3a4 4 0 0 1-5.656-5.656l1.5-1.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </a>
</template>

<script setup lang="ts">
// WB: LinkBadge — 24×24 icon на корнері об'єкта з прикріпленим URL.
// Click → відкриває посилання у новій вкладці з noopener,noreferrer.
// Container layer (.wb-link-badge у WBCanvas) має pointer-events: none —
// лише сама іконка clickable.
//
// Replay safety: badge IS rendered у replay (бо linkUrl у object state),
// але user-induced click на нього є side-effect (window navigation), не op,
// тому replay log нічого не змінюється.
//
// Click semantics (per helper recommendation):
//   - event.stopPropagation() → не select object
//   - target="_blank" + rel="noopener noreferrer" → secure new tab
//   - isSafeUrl() guard → защита от javascript:/data:/etc URLs

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isSafeUrl, hostOf } from '../../utils/urlSafety'

interface Props {
  linkUrl: string
  linkTitle?: string
  objectId: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const hasLink = computed(() => isSafeUrl(props.linkUrl))

const tooltipText = computed(() => {
  if (!hasLink.value) return t('winterboard.linkAttachment.invalidUrl')
  const label = props.linkTitle?.trim() || hostOf(props.linkUrl)
  return `${label} — ${t('winterboard.linkAttachment.open')}`
})

function onClick(e: MouseEvent): void {
  // Захист від селекції об'єкта під badge (mirror helper recommendation).
  e.stopPropagation()
  // Якщо URL invalid — блокуємо browser navigation попри href="#".
  if (!hasLink.value) {
    e.preventDefault()
    return
  }
  // target=_blank + rel=noopener noreferrer обробляє відкриття безпечно.
  // Не викликаємо window.open вручну — нативний <a> respect-ує middle-click,
  // Ctrl+click тощо.
}
</script>

<style scoped>
.wb-link-badge-icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  pointer-events: auto;
  color: #64748b;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s, color 0.15s;
}

.wb-link-badge-icon:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  background: rgba(99, 102, 241, 0.18);
  color: #4338ca;
}

.wb-link-badge-icon--has-link {
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.12);
}

.wb-link-badge-icon--has-link:hover {
  color: #312e81;
}
</style>
