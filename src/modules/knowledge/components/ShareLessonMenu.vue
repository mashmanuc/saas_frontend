<!--
  ShareLessonMenu — одна кнопка «Поділитися ▾» замість двох незрозумілих 🔗/🎁
  (фідбек власника «чим відрізняється?»). Дві явні опції з поясненням:
    👁 Показати       — посилання на перегляд (безкоштовне демо, read-only)
    🎁 Передати копію — одноразовий код (покупець отримує СВОЮ редаговану копію)
  Логіка лишається в батька (handleShare / quickGrant) — тут лише вибір.
-->
<template>
  <div ref="rootEl" class="share-menu">
    <button
      type="button"
      class="share-menu__btn px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
      :disabled="busy"
      @click.stop="open = !open"
    >
      {{ busy ? '⏳' : '🔗' }} {{ $t('knowledge.grants.shareMenu') }} ▾
    </button>

    <div v-if="open" class="share-menu__pop" @click.stop>
      <button type="button" class="share-menu__item" @click="pick('share')">
        <span class="share-menu__icon">👁</span>
        <span class="share-menu__text">
          <span class="share-menu__title">{{ $t('knowledge.grants.optShow') }}</span>
          <span class="share-menu__hint">{{ $t('knowledge.grants.optShowHint') }}</span>
        </span>
      </button>
      <button type="button" class="share-menu__item" @click="pick('transfer')">
        <span class="share-menu__icon">🎁</span>
        <span class="share-menu__text">
          <span class="share-menu__title">{{ $t('knowledge.grants.optTransfer') }}</span>
          <span class="share-menu__hint">{{ $t('knowledge.grants.optTransferHint') }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ share: []; transfer: [] }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

function pick(which: 'share' | 'transfer') {
  open.value = false
  if (which === 'share') emit('share')
  else emit('transfer')
}

// close-outside на pointer (граф.планшет: перо=pointer, не click)
function onOutside(e: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))

void props
</script>

<style scoped>
.share-menu { position: relative; display: inline-block; }
.share-menu__pop {
  position: absolute; z-index: 30; top: calc(100% + 4px); left: 0;
  width: 260px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14); padding: 6px;
}
.share-menu__item {
  display: flex; align-items: flex-start; gap: 10px; width: 100%;
  padding: 9px 10px; border: none; background: none; border-radius: 8px;
  cursor: pointer; text-align: left;
}
.share-menu__item:hover { background: #f0fdf4; }
.share-menu__icon { font-size: 18px; line-height: 1.2; flex-shrink: 0; }
.share-menu__text { display: flex; flex-direction: column; gap: 2px; }
.share-menu__title { font-size: 13px; font-weight: 600; color: #0f172a; }
.share-menu__hint { font-size: 11px; color: #64748b; line-height: 1.3; }
</style>
