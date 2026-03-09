<template>
  <Teleport to="body">
    <div
      v-if="item"
      class="lc-preview-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="item.title"
      @click.self="$emit('close')"
      @keydown.escape="$emit('close')"
    >
      <div class="lc-preview-modal" tabindex="-1">
        <button class="lc-preview-close" aria-label="Close" @click="$emit('close')">&#10005;</button>
        <div class="lc-preview-title">{{ item.title }}</div>
        <div class="lc-preview-meta">
          <span class="lc-type-badge" :class="`lc-type-${item.type}`">
            {{ t(`learningContent.item.${item.type}`) }}
          </span>
          <span class="lc-diff-badge">
            {{ t(`learningContent.difficulty.${item.difficulty}`) }}
          </span>
          <OwnershipBadge v-if="item.ownership_type" :ownership-type="item.ownership_type" size="md" />
          <AccessLockIcon v-if="item.access_type" :access-type="item.access_type" size="md" />
        </div>
        <div v-if="detail?.owner_display_name" class="lc-preview-owner">
          {{ detail.owner_display_name }}
        </div>
        <div v-if="isLoadingDetail" class="lc-preview-loading">
          {{ t('learningContent.panel.loading') }}
        </div>
        <template v-else-if="detail">
          <div v-if="detailImageUrl" class="lc-preview-image-wrap">
            <img :src="detailImageUrl" :alt="detail.title" class="lc-preview-image" />
          </div>
          <div v-if="renderedHtml" class="lc-preview-content" v-html="renderedHtml" />
          <div v-if="detailAnswer" class="lc-preview-answer">
            <strong>Відповідь:</strong> {{ detailAnswer }}
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { learningContentApi } from '../api/learningContentApi'
import { renderTextWithLatex } from '../utils/contentRenderer'
import { isProblem, isTheory, isTest } from '../schemas/contentSchemas'
import type { ContentItemSummary, ContentItemDetail } from '../types/learningContent'
import OwnershipBadge from './OwnershipBadge.vue'
import AccessLockIcon from './AccessLockIcon.vue'

const props = defineProps<{ item: ContentItemSummary | null }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const detail = ref<ContentItemDetail | null>(null)
const isLoadingDetail = ref(false)

watch(
  () => props.item,
  async (newItem) => {
    if (!newItem) {
      detail.value = null
      return
    }
    isLoadingDetail.value = true
    try {
      detail.value = await learningContentApi.getItemDetail(newItem.id)
    } finally {
      isLoadingDetail.value = false
    }
  },
)

const detailImageUrl = computed(() => {
  if (!detail.value) return null
  const cj = detail.value.content_json as Record<string, unknown>
  const images = cj?.images as string[] | undefined
  if (images && Array.isArray(images) && images.length > 0) return images[0]
  return null
})

const detailAnswer = computed(() => {
  if (!detail.value) return ''
  const cj = detail.value.content_json as Record<string, unknown>
  return (cj?.answer as string) || ''
})

const renderedHtml = computed(() => {
  if (!detail.value) return ''
  const { content_json: c, type } = detail.value
  if (type === 'problem' && isProblem(c)) {
    const statement = c.statement?.trim()
    if (statement && !statement.startsWith('Задача №')) return renderTextWithLatex(statement)
    return ''
  }
  if (type === 'theory' && isTheory(c)) return renderTextWithLatex(c.body)
  if (type === 'test' && isTest(c)) return renderTextWithLatex(c.question)
  return ''
})
</script>

<style scoped>
.lc-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.lc-preview-modal {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 24px;
  max-width: 560px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 20px 60px var(--shadow);
}
.lc-preview-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  line-height: 1;
}
.lc-preview-close:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}
.lc-preview-close:focus-visible {
  outline: 2px solid var(--accent);
}
.lc-preview-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  padding-right: 32px;
}
.lc-preview-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.lc-type-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}
.lc-type-problem { background: color-mix(in srgb, #7c3aed 12%, var(--card-bg)); color: #7c3aed; }
.lc-type-test { background: color-mix(in srgb, var(--warning-bg) 15%, var(--card-bg)); color: var(--warning-bg); }
.lc-type-theory { background: color-mix(in srgb, var(--info-bg) 12%, var(--card-bg)); color: var(--info-bg); }
.lc-type-video { background: color-mix(in srgb, #ec4899 10%, var(--card-bg)); color: #ec4899; }
.lc-type-presentation { background: color-mix(in srgb, var(--success-bg) 12%, var(--card-bg)); color: var(--success-bg); }
.lc-type-link { background: color-mix(in srgb, var(--accent) 10%, var(--card-bg)); color: var(--accent); }
.lc-diff-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.lc-preview-loading {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary);
  font-size: 13px;
}
.lc-preview-image-wrap {
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
.lc-preview-image {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
}
.lc-preview-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
}
.lc-preview-answer {
  margin-top: 12px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--success-bg) 10%, var(--card-bg));
  border-left: 3px solid var(--success-bg);
  border-radius: 4px;
  font-size: 13px;
  color: var(--success-bg);
}
.lc-preview-owner {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
.lc-preview-content :deep(.lc-display-math) {
  text-align: center;
  margin: 12px 0;
}
</style>
