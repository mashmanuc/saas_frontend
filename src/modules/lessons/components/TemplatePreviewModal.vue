<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="mp-modal-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="detail?.title ?? t('lessons.marketplace.preview')"
      @click.self="$emit('close')"
      @keydown.escape="$emit('close')"
    >
      <div class="mp-modal" tabindex="-1">
        <!-- Close button -->
        <button
          class="mp-modal-close"
          :aria-label="t('lessons.marketplace.close')"
          @click="$emit('close')"
        >
          &#10005;
        </button>

        <!-- Loading -->
        <div v-if="isLoading" class="mp-modal-loading">
          {{ t('lessons.marketplace.loading') }}
        </div>

        <!-- Error -->
        <div v-else-if="error" class="mp-modal-error">
          {{ error }}
        </div>

        <!-- Content -->
        <template v-else-if="detail">
          <!-- Title -->
          <h2 class="mp-modal-title">{{ detail.title }}</h2>

          <!-- Meta badges -->
          <div class="mp-modal-meta">
            <span v-if="detail.subject" class="mp-meta-badge mp-meta-subject">
              {{ detail.subject }}
            </span>
            <span class="mp-meta-badge mp-meta-type">
              {{ t(`lessons.type.${detail.lesson_type}`) }}
            </span>
            <span class="mp-meta-badge" :class="priceClass">
              {{ priceLabel }}
            </span>
          </div>

          <!-- Description -->
          <p v-if="detail.description" class="mp-modal-description">
            {{ detail.description }}
          </p>

          <!-- Author -->
          <div class="mp-modal-row">
            <span class="mp-row-label">{{ t('lessons.marketplace.author') }}</span>
            <span class="mp-row-value">{{ detail.owner_display_name }}</span>
          </div>

          <!-- Version -->
          <div class="mp-modal-row">
            <span class="mp-row-label">{{ t('lessons.marketplace.version') }}</span>
            <span class="mp-row-value">v{{ detail.version }}</span>
          </div>

          <!-- Used count -->
          <div class="mp-modal-row">
            <span class="mp-row-label">{{ t('lessons.marketplace.usedCount', { count: detail.used_in_lessons_count ?? 0 }) }}</span>
          </div>

          <!-- Materials -->
          <div v-if="detail.materials?.length" class="mp-modal-section">
            <h4 class="mp-section-title">{{ t('lessons.marketplace.materials') }}</h4>
            <div class="mp-materials-list">
              <div
                v-for="mat in detail.materials"
                :key="mat.id"
                class="mp-material-item"
              >
                <span class="mp-material-type" :class="`mp-mat-${mat.type}`">
                  {{ mat.type }}
                </span>
                <span class="mp-material-title">{{ mat.title }}</span>
              </div>
            </div>
          </div>

          <!-- Homework template -->
          <div v-if="detail.homework_template?.instructions" class="mp-modal-section">
            <h4 class="mp-section-title">{{ t('lessons.marketplace.hasHomework') }}</h4>
            <p class="mp-homework-preview">
              {{ detail.homework_template.instructions }}
            </p>
          </div>

          <!-- Action buttons -->
          <div class="mp-modal-actions">
            <!-- Paid template, not purchased yet -->
            <button
              v-if="detail.requires_purchase && !detail.can_use"
              class="mp-btn mp-btn-purchase"
              :disabled="isPurchasing || !isTutor"
              :title="!isTutor ? t('lessons.marketplace.tutorsOnly') : ''"
              data-test="purchase-template-btn"
              @click="onPurchaseTemplate"
            >
              <span v-if="isPurchasing">...</span>
              <span v-else>{{ t('lessons.purchase.buyFor', { price: detail.price ?? 0 }) }}</span>
            </button>

            <!-- Free or already purchased -->
            <button
              v-else
              class="mp-btn mp-btn-primary"
              :disabled="!detail.can_use || isUsing"
              :title="!detail.can_use ? t('lessons.marketplace.tutorsOnly') : ''"
              data-test="use-template-btn"
              @click="onUseTemplate"
            >
              <span v-if="isUsing">...</span>
              <span v-else>{{ t('lessons.marketplace.useTemplate') }}</span>
            </button>

            <button
              class="mp-btn mp-btn-secondary"
              @click="$emit('close')"
            >
              {{ t('lessons.marketplace.close') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { lessonsTemplateApi } from '../api/lessonsTemplateApi'
import type { MarketplaceTemplateDetail } from '../types/lessonTypes'
import { useAuthStore } from '@/modules/auth/store/authStore'

const props = defineProps<{
  templateId: number | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  used: [lessonId: number]
}>()

const { t } = useI18n()
const authStore = useAuthStore()

const detail = ref<MarketplaceTemplateDetail | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const isUsing = ref(false)
const isPurchasing = ref(false)

const isTutor = computed(() => authStore.user?.role === 'tutor')

watch(
  () => [props.visible, props.templateId],
  async ([vis, id]) => {
    if (!vis || !id) {
      detail.value = null
      error.value = null
      return
    }
    isLoading.value = true
    error.value = null
    try {
      detail.value = await lessonsTemplateApi.getMarketplaceDetail(id as number)
    } catch {
      error.value = t('lessons.marketplace.error')
    } finally {
      isLoading.value = false
    }
  },
)

const priceLabel = computed(() => {
  if (!detail.value) return ''
  const p = detail.value.price
  if (p == null || p === 0) return t('lessons.marketplace.free')
  return `${p}\u20B4`
})

const priceClass = computed(() => {
  if (!detail.value) return ''
  const p = detail.value.price
  if (p == null || p === 0) return 'mp-price-free'
  return 'mp-price-paid'
})

async function onPurchaseTemplate() {
  if (!props.templateId || isPurchasing.value) return
  isPurchasing.value = true
  try {
    await lessonsTemplateApi.purchaseTemplate(props.templateId)
    // Refresh detail to update can_use and requires_purchase
    detail.value = await lessonsTemplateApi.getMarketplaceDetail(props.templateId)
  } catch (e: any) {
    const status = e?.response?.status ?? e?.status
    if (status === 402) {
      error.value = t('lessons.purchase.purchaseRequired')
    } else if (status === 409) {
      error.value = t('lessons.purchase.alreadyPurchased')
      // Refresh anyway — template is already purchased
      if (props.templateId) {
        detail.value = await lessonsTemplateApi.getMarketplaceDetail(props.templateId)
      }
    } else {
      error.value = t('lessons.purchase.purchaseError')
    }
  } finally {
    isPurchasing.value = false
  }
}

async function onUseTemplate() {
  if (!props.templateId || isUsing.value) return
  isUsing.value = true
  try {
    const result = await lessonsTemplateApi.useTemplate(props.templateId)
    emit('used', result.id ?? result)
  } catch (e: any) {
    const status = e?.response?.status ?? e?.status
    if (status === 402) {
      error.value = t('lessons.purchase.purchaseRequired')
    } else {
      error.value = t('lessons.marketplace.error')
    }
  } finally {
    isUsing.value = false
  }
}
</script>

<style scoped>
.mp-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.mp-modal {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 28px;
  max-width: 640px;
  width: 92%;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 24px 64px var(--shadow);
}
.mp-modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  line-height: 1;
}
.mp-modal-close:hover { color: var(--text-primary); background: var(--bg-secondary); }
.mp-modal-close:focus-visible { outline: 2px solid var(--accent); }

.mp-modal-loading,
.mp-modal-error {
  text-align: center;
  padding: 40px 20px;
  font-size: 14px;
}
.mp-modal-loading { color: var(--text-secondary); }
.mp-modal-error { color: var(--danger-bg); }

.mp-modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
  padding-right: 32px;
}

.mp-modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.mp-meta-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 6px;
}
.mp-meta-subject { background: var(--bg-secondary); color: var(--text-primary); }
.mp-meta-type { background: color-mix(in srgb, #7c3aed 12%, var(--card-bg)); color: #7c3aed; }
.mp-price-free { background: color-mix(in srgb, var(--success-bg) 12%, var(--card-bg)); color: var(--success-bg); }
.mp-price-paid { background: color-mix(in srgb, var(--info-bg) 12%, var(--card-bg)); color: var(--info-bg); }

.mp-modal-description {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.mp-modal-row {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}
.mp-row-label { color: var(--text-secondary); }
.mp-row-value { color: var(--text-primary); font-weight: 500; }

.mp-modal-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}
.mp-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.mp-materials-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mp-material-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--bg-secondary);
}
.mp-material-type {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  flex-shrink: 0;
}
.mp-mat-problem { background: color-mix(in srgb, #7c3aed 12%, var(--card-bg)); color: #7c3aed; }
.mp-mat-test { background: color-mix(in srgb, var(--warning-bg) 15%, var(--card-bg)); color: var(--warning-bg); }
.mp-mat-theory { background: color-mix(in srgb, var(--info-bg) 12%, var(--card-bg)); color: var(--info-bg); }
.mp-mat-video { background: color-mix(in srgb, #ec4899 10%, var(--card-bg)); color: #ec4899; }
.mp-mat-presentation { background: color-mix(in srgb, var(--success-bg) 12%, var(--card-bg)); color: var(--success-bg); }
.mp-mat-link { background: color-mix(in srgb, var(--accent) 10%, var(--card-bg)); color: var(--accent); }
.mp-material-title {
  font-size: 12px;
  color: var(--text-primary);
}

.mp-homework-preview {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.mp-modal-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.mp-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s, opacity 0.15s;
}
.mp-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mp-btn-primary {
  background: var(--accent);
  color: var(--accent-contrast);
}
.mp-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.mp-btn-purchase {
  background: var(--success-bg);
  color: var(--accent-contrast);
}
.mp-btn-purchase:hover:not(:disabled) { background: color-mix(in srgb, var(--success-bg) 85%, black); }
.mp-btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.mp-btn-secondary:hover { background: var(--border-color); }
</style>
