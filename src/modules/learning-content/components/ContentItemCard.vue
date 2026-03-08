<template>
  <div
    class="lc-item-card"
    :class="{ 'lc-item-card--has-image': item.thumbnail_url }"
    draggable="true"
    role="listitem"
    :aria-label="t(`learningContent.item.${item.type}`) + ': ' + item.title"
    tabindex="0"
    @dragstart="onDragStart"
    @click="onCardClick"
    @keydown.enter="onCardClick"
  >
    <!-- Image thumbnail -->
    <div v-if="item.thumbnail_url" class="lc-item-image-wrap">
      <img
        :src="item.thumbnail_url"
        :alt="item.title"
        class="lc-item-image"
        loading="lazy"
        @error="onImageError"
      />
    </div>

    <!-- Text fallback (no image) -->
    <div class="lc-item-info">
      <div class="lc-item-info-top">
        <span class="lc-item-type-badge" :class="`lc-type-${item.type}`">
          {{ t(`learningContent.item.${item.type}`) }}
        </span>
        <span class="lc-item-title">{{ item.title }}</span>
      </div>
      <span class="lc-item-badges">
        <OwnershipBadge v-if="item.ownership_type" :ownership-type="item.ownership_type" size="sm" />
        <AccessLockIcon v-if="item.access_type" :access-type="item.access_type" size="sm" />
      </span>
      <span v-if="item.language" class="lc-item-lang-badge">
        {{ item.language === 'uk' ? 'UA' : 'EN' }}
      </span>
      <span
        class="lc-item-difficulty"
        :title="t(`learningContent.difficulty.${item.difficulty}`)"
        :aria-label="t(`learningContent.difficulty.${item.difficulty}`)"
      >
        {{ '\u25CF'.repeat(item.difficulty) }}{{ '\u25CB'.repeat(5 - item.difficulty) }}
      </span>
      <!-- Phase 1c: Delete button (own content only) -->
      <button
        v-if="canDelete"
        class="lc-item-delete-btn"
        :title="t('learningContent.actions.delete')"
        :aria-label="t('learningContent.actions.deleteItem', { title: item.title })"
        @click.stop="onDeleteClick"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M5 2V1h6v1h4v2H1V2h4zm1 4v7h4V6H6zm-3 9h10l1-10H3l1 10z" fill="currentColor" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ContentItemSummary, ContentDragPayload } from '../types/learningContent'
import OwnershipBadge from './OwnershipBadge.vue'
import AccessLockIcon from './AccessLockIcon.vue'
import { useContentAccess } from '../composables/useContentAccess'

const LOCKED_ACCESS_TYPES = new Set(['PAID', 'SUBSCRIPTION', 'RESTRICTED', 'ARCHIVED'])

const props = defineProps<{ item: ContentItemSummary }>()
const emit = defineEmits<{
  preview: [item: ContentItemSummary]
  dragStart: [payload: ContentDragPayload]
  accessDenied: [reason: string]
  delete: [item: ContentItemSummary]
}>()
const { t } = useI18n()
const { checkAccess } = useContentAccess()

function onDragStart(event: DragEvent) {
  const payload: ContentDragPayload = {
    itemId: props.item.id,
    type: props.item.type,
    title: props.item.title,
    contentJson: {} as any,
    version: props.item.version,  // B1: version pinning at drag time
  }
  event.dataTransfer?.setData('application/learning-content', JSON.stringify(payload))
  event.dataTransfer!.effectAllowed = 'copy'
  emit('dragStart', payload)
}

async function onCardClick() {
  const accessType = props.item.access_type
  if (accessType && LOCKED_ACCESS_TYPES.has(accessType)) {
    const result = await checkAccess(props.item.id)
    if (result && !result.has_access) {
      const reasonKey = result.reason === 'subscription_required'
        ? 'learningContent.accessCheck.subscriptionRequired'
        : result.reason === 'purchase_required'
          ? 'learningContent.accessCheck.purchaseRequired'
          : result.reason === 'owner_only'
            ? 'learningContent.accessCheck.ownerOnly'
            : 'learningContent.accessCheck.restricted'
      emit('accessDenied', t(reasonKey))
      return
    }
  }
  // PREVIEW access → open in preview mode (read-only)
  emit('preview', props.item)
}

const canDelete = computed(() => {
  return props.item.ownership_type === 'TUTOR'
    || props.item.ownership_type === 'USER_GENERATED'
})

function onDeleteClick() {
  emit('delete', props.item)
}

function onImageError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<style scoped>
.lc-item-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 8px;
  cursor: grab;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  border: 1px solid transparent;
}
.lc-item-card:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.lc-item-card:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 1px;
}
.lc-item-card:active {
  cursor: grabbing;
}

/* Image thumbnail */
.lc-item-image-wrap {
  width: 100%;
  border-radius: 6px;
  overflow: hidden;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}
.lc-item-image {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
}

/* Info row */
.lc-item-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 0 2px;
}
.lc-item-info-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.lc-item-type-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}
.lc-type-problem { background: #ede9fe; color: #6d28d9; }
.lc-type-test { background: #fef3c7; color: #92400e; }
.lc-type-theory { background: #dbeafe; color: #1e40af; }
.lc-type-video { background: #fce7f3; color: #9d174d; }
.lc-type-presentation { background: #d1fae5; color: #065f46; }
.lc-type-link { background: #e0e7ff; color: #3730a3; }
.lc-item-title {
  flex: 1;
  font-size: 11px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-item-badges {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.lc-item-lang-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  background: #f3f4f6;
  color: #6b7280;
  flex-shrink: 0;
  text-transform: uppercase;
}
.lc-item-difficulty {
  font-size: 9px;
  color: #9ca3af;
  flex-shrink: 0;
  letter-spacing: 1px;
}
.lc-item-delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  flex-shrink: 0;
}
.lc-item-card:hover .lc-item-delete-btn { opacity: 1; }
.lc-item-delete-btn:hover { color: #dc2626; background: #fef2f2; }
</style>
