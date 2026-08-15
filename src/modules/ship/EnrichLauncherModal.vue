<!--
  EnrichLauncherModal — виносить AI Enrich з діалогу «Експорт» у власне вікно.

  Enrich = ДОДАВАННЯ контенту в урок, не експорт; раніше кнопка й прев'ю жили
  всередині export-діалогу (тісний ~600px блок). Ця обгортка дає enrich власну
  широку модалку з resize і переюзає `EnrichPatchesPreview` БЕЗ правок її файлу
  (зона іншої сесії) — лише резолвить артефакт сесії й обгортає overlay+панеллю.
-->
<template>
  <div
    class="enrich-launcher-overlay"
    v-if="visible"
    @click.self="$emit('close')"
    role="dialog"
    aria-modal="true"
  >
    <div class="enrich-launcher-panel">
      <EnrichPatchesPreview
        v-if="artifactId"
        :artifact-id="artifactId"
        :visible="visible"
        @close="$emit('close')"
        @applied="$emit('close')"
      />
      <div v-else class="enrich-launcher-empty">
        <p>{{ loading
          ? t('common.loading', 'Завантаження…')
          : t('winterboard.enrich.noArtifact', 'Для цієї дошки ще немає уроку для збагачення.') }}</p>
        <button class="enrich-launcher-empty__close" @click="$emit('close')">
          {{ t('common.close', 'Закрити') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EnrichPatchesPreview from '@/modules/ship/EnrichPatchesPreview.vue'
import { shipApi } from '@/modules/ship/shipApi'

const props = defineProps<{ sessionId: string; visible: boolean }>()
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
.enrich-launcher-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  padding: 16px;
}

.enrich-launcher-panel {
  width: min(920px, 92vw);
  height: min(82vh, 900px);
  min-width: 380px;
  min-height: 300px;
  max-width: 96vw;
  max-height: 92vh;
  /* Головне «зручно»: тягни за правий-нижній кут. */
  resize: both;
  overflow: auto;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

/* Дати прев'ю Феї заповнити панель, НЕ чіпаючи її файл (deep-селектор). */
.enrich-launcher-panel :deep(.enrich-patches-preview) {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow: auto;
  margin: 0;
  border-radius: 8px;
}

.enrich-launcher-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  color: #ddd;
  border-radius: 8px;
  padding: 28px;
  text-align: center;
}

.enrich-launcher-empty__close {
  background: #555;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 8px 18px;
  cursor: pointer;
}
</style>
