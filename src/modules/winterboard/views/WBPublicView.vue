<template>
  <div class="wb-public-view">
    <!-- Loading state -->
    <div v-if="isLoading" class="wb-public-view__loading">
      <div class="wb-public-view__spinner" />
      <p>{{ t('winterboard.public.loading') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="wb-public-view__error">
      <h2>{{ error.title }}</h2>
      <p>{{ error.message }}</p>
      <router-link to="/winterboard" class="wb-public-view__back-btn">
        {{ t('winterboard.public.goBack') }}
      </router-link>
    </div>

    <!-- Read-only canvas -->
    <template v-else-if="sessionData">
      <header class="wb-public-view__header">
        <h1 class="wb-public-view__title">{{ sessionData.name || t('winterboard.room.untitled') }}</h1>
        <span class="wb-public-view__badge">{{ t('winterboard.public.readOnly') }}</span>
        <div class="wb-public-view__header-actions">
          <button
            v-if="allowDownload"
            type="button"
            class="wb-download-btn"
            @click="handleDownload"
          >
            {{ t('winterboard.public.download') }}
          </button>
        </div>
      </header>

      <div class="wb-public-view__canvas-area">
        <WBCanvas
          ref="canvasRef"
          :strokes="currentPageStrokes"
          :assets="currentPageAssets"
          :page-id="currentPageId"
          :read-only="true"
          color="#000000"
          tool="select"
          :size="2"
        />
      </div>

      <!-- Page navigation (read-only) -->
      <footer v-if="pages.length > 1" class="wb-public-view__footer">
        <button
          type="button"
          class="wb-page-btn"
          :disabled="currentPageIndex === 0"
          @click="currentPageIndex--"
        >
          &larr;
        </button>
        <span class="wb-page-indicator">
          {{ currentPageIndex + 1 }} / {{ pages.length }}
        </span>
        <button
          type="button"
          class="wb-page-btn"
          :disabled="currentPageIndex >= pages.length - 1"
          @click="currentPageIndex++"
        >
          &rarr;
        </button>
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { winterboardApi } from '../api/winterboardApi'
import WBCanvas from '../components/canvas/WBCanvas.vue'
import type { WBStroke, WBAsset, WBPage } from '../types/winterboard'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const error = ref<{ title: string; message: string } | null>(null)
const sessionData = ref<Record<string, unknown> | null>(null)
const currentPageIndex = ref(0)
const canvasRef = ref<InstanceType<typeof WBCanvas> | null>(null)

// ── Computed ──

const pages = computed<WBPage[]>(() => {
  if (!sessionData.value?.state) return []
  const state = sessionData.value.state as { pages?: WBPage[] }
  return state.pages ?? []
})

const currentPageId = computed(() => {
  return pages.value[currentPageIndex.value]?.id ?? ''
})

const currentPageStrokes = computed<WBStroke[]>(() => {
  return pages.value[currentPageIndex.value]?.strokes ?? []
})

const currentPageAssets = computed<WBAsset[]>(() => {
  return pages.value[currentPageIndex.value]?.assets ?? []
})

const allowDownload = computed(() => {
  if (!sessionData.value) return false
  return (sessionData.value as Record<string, unknown>).allow_download === true
})

// ── Download ──

function handleDownload(): void {
  try {
    const stage = (canvasRef.value as unknown as { getStage?: () => { toDataURL: (opts?: { pixelRatio?: number }) => string } | null })?.getStage?.()
    if (!stage) {
      console.warn('[WB:PublicView] Canvas stage not available for download')
      return
    }
    const dataUrl = stage.toDataURL({ pixelRatio: 2 })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${(sessionData.value?.name as string) || 'winterboard'}-page-${currentPageIndex.value + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('[WB:PublicView] Download failed:', err)
  }
}

// ── Lifecycle ──

onMounted(async () => {
  const token = route.params.token as string
  if (!token) {
    error.value = {
      title: t('winterboard.public.notFound'),
      message: t('winterboard.public.invalidLink'),
    }
    isLoading.value = false
    return
  }

  try {
    const data = await winterboardApi.getPublicSession(token)
    sessionData.value = data
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) {
      error.value = {
        title: t('winterboard.public.notFound'),
        message: t('winterboard.public.sessionNotFound'),
      }
    } else if (status === 410) {
      error.value = {
        title: t('winterboard.public.expired'),
        message: t('winterboard.public.linkExpired'),
      }
    } else {
      error.value = {
        title: t('winterboard.public.error'),
        message: t('winterboard.public.loadFailed'),
      }
    }
    console.error('[WB:PublicView] Failed to load public session:', err)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.wb-public-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--wb-bg, #f8f9fa);
}

.wb-public-view__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--wb-text-muted, #6c757d);
}

.wb-public-view__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--wb-border, #dee2e6);
  border-top-color: var(--wb-primary, #2563eb);
  border-radius: 50%;
  animation: wb-spin 0.8s linear infinite;
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

.wb-public-view__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  text-align: center;
  padding: 2rem;
}

.wb-public-view__error h2 {
  font-size: 1.25rem;
  color: var(--wb-text, #212529);
}

.wb-public-view__error p {
  color: var(--wb-text-muted, #6c757d);
}

.wb-public-view__back-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  background: var(--wb-primary, #2563eb);
  color: #fff;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.875rem;
}

.wb-public-view__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--wb-border, #dee2e6);
  background: var(--wb-surface, #fff);
}

.wb-public-view__header-actions {
  margin-left: auto;
  flex-shrink: 0;
}

.wb-download-btn {
  padding: 0.375rem 1rem;
  background: var(--wb-primary, #2563eb);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.wb-download-btn:hover {
  background: var(--wb-primary-hover, #1d4ed8);
}

.wb-public-view__title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-public-view__badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  background: var(--wb-warning-bg, #fff3cd);
  color: var(--wb-warning-text, #856404);
  border-radius: 4px;
  white-space: nowrap;
}

.wb-public-view__canvas-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.wb-public-view__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.5rem;
  border-top: 1px solid var(--wb-border, #dee2e6);
  background: var(--wb-surface, #fff);
}

.wb-page-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--wb-border, #dee2e6);
  border-radius: 4px;
  background: var(--wb-surface, #fff);
  cursor: pointer;
  font-size: 1rem;
}

.wb-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wb-page-indicator {
  font-size: 0.875rem;
  color: var(--wb-text-muted, #6c757d);
}

@media (prefers-reduced-motion: reduce) {
  .wb-public-view__spinner {
    animation: none;
  }
}
</style>
