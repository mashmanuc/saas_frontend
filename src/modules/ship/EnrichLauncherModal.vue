<!--
  EnrichLauncherModal — AI Enrich у власному вікні (винесено з діалогу «Експорт»).

  Оформлення ДЗЕРКАЛИТЬ чат-модалку (`modules/chat/components/ChatModal.vue`):
  та сама картка `rounded-2xl` + `shadow-2xl` + `backdrop-blur`, той самий
  дизайн-набір (`bg-card` / `border-default` / `text-muted` / `bg-accent`),
  і АВТО-ВИСОТА за вмістом — модалка не зяє порожнім коробом, а росте від форми
  до списку патчів (далі скролиться в межах екрана).

  Переюзає `EnrichPatchesPreview` БЕЗ правок її файлу — лише знімає його власну
  рамку/фон через `:deep`, щоб показувалась рамка картки (без подвійного бордюру).
-->
<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[1200] flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    @keydown.esc="$emit('close')"
  >
    <!-- Overlay: напівпрозорий + легке розмиття, як у чаті -->
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')" />

    <!-- Картка: та сама, що чат-модалка -->
    <div
      class="enrich-launcher-card relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-default bg-card shadow-2xl"
    >
      <div class="enrich-launcher-body flex-1 overflow-y-auto">
        <EnrichPatchesPreview
          v-if="artifactId"
          :artifact-id="artifactId"
          :visible="visible"
          :mode="mode"
          @close="$emit('close')"
          @applied="$emit('close')"
        />
        <div
          v-else
          class="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center"
        >
          <div
            v-if="loading"
            class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"
          />
          <template v-else>
            <div class="text-4xl">✨</div>
            <p class="max-w-sm text-sm text-muted">
              {{ t('winterboard.enrich.noArtifact', 'Для цієї дошки ще немає уроку для збагачення.') }}
            </p>
            <button
              type="button"
              class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
              @click="$emit('close')"
            >
              {{ t('common.close', 'Закрити') }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EnrichPatchesPreview from '@/modules/ship/EnrichPatchesPreview.vue'
import { shipApi } from '@/modules/ship/shipApi'

// Фаза 5: та сама модалка й те саме прев'ю для review (ТЗ §5.1 — не форк).
const props = defineProps<{ sessionId: string; visible: boolean; mode?: 'enrich' | 'review' }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const artifactId = ref('')
const loading = ref(false)

async function resolveArtifact() {
  if (!props.sessionId) return
  loading.value = true
  try {
    const art = await shipApi.getSessionArtifact(props.sessionId)
    artifactId.value = art?.id || ''
  } catch {
    artifactId.value = ''
  } finally {
    loading.value = false
  }
}

// Резолвимо артефакт при кожному відкритті (сесія могла отримати артефакт пізніше).
watch(
  () => props.visible,
  (open) => { if (open) resolveArtifact() },
  { immediate: true },
)
</script>

<style scoped>
/* Знімаємо власну рамку/фон/скрол EnrichPatchesPreview — рамку й скрол дає
   картка вище, щоб короб не зяяв і не було подвійного бордюру. Файл Феї не
   чіпаємо (deep-селектор). Внутрішні відступи лишаємо трохи повітрянішими. */
.enrich-launcher-body :deep(.enrich-patches-preview) {
  border: none;
  border-radius: 0;
  background: transparent;
  max-height: none;
  overflow: visible;
  padding: 20px;
}
</style>
