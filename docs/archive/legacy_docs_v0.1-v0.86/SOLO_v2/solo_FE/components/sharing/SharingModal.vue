<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="sharing-modal">
      <header class="sharing-modal__header">
        <h2>{{ $t('solo.sharing.title') }}</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </header>

      <div class="sharing-modal__content">
        <!-- Existing share -->
        <div v-if="shareToken" class="share-active">
          <div class="share-link">
            <input
              ref="linkInput"
              type="text"
              :value="shareUrl"
              readonly
              class="link-input"
            />
            <button class="btn btn-ghost" @click="copyLink">
              {{ copied ? '✓' : '📋' }}
            </button>
          </div>

          <div class="share-info">
            <p v-if="shareToken.expires_at">
              {{ $t('solo.sharing.expiresAt') }}: {{ formatDate(shareToken.expires_at) }}
            </p>
            <p>
              {{ $t('solo.sharing.views') }}: {{ shareToken.view_count }}
              <span v-if="shareToken.max_views">/ {{ shareToken.max_views }}</span>
            </p>
          </div>

          <button class="btn btn-danger" @click="revokeShare">
            {{ $t('solo.sharing.revoke') }}
          </button>
        </div>

        <!-- Create share -->
        <div v-else class="share-create">
          <div class="share-option">
            <label>{{ $t('solo.sharing.expiresIn') }}</label>
            <select v-model="options.expires_in_days">
              <option :value="1">1 {{ $t('solo.sharing.day') }}</option>
              <option :value="7">7 {{ $t('solo.sharing.days') }}</option>
              <option :value="30">30 {{ $t('solo.sharing.days') }}</option>
              <option :value="null">{{ $t('solo.sharing.never') }}</option>
            </select>
          </div>

          <div class="share-option">
            <label class="checkbox-label">
              <input type="checkbox" v-model="options.allow_download" />
              {{ $t('solo.sharing.allowDownload') }}
            </label>
          </div>

          <div class="share-option">
            <label>{{ $t('solo.sharing.maxViews') }}</label>
            <input
              type="number"
              v-model.number="options.max_views"
              min="0"
              :placeholder="$t('solo.sharing.unlimited')"
            />
          </div>

          <button
            class="btn btn-primary"
            :disabled="isCreating"
            @click="createShare"
          >
            {{ isCreating ? '...' : $t('solo.sharing.createLink') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useSharing } from '../../composables/useSharing'
import type { SoloSession, ShareToken } from '../../types/solo'

interface Props {
  session: SoloSession
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { createShareToken, revokeShareToken, getShareToken } = useSharing()

// State
const shareToken = ref<ShareToken | null>(null)
const isCreating = ref(false)
const copied = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)

const options = reactive({
  expires_in_days: 7 as number | null,
  max_views: null as number | null,
  allow_download: false,
})

// Computed
const shareUrl = computed(() => {
  if (!shareToken.value) return ''
  return `${window.location.origin}/solo/shared/${shareToken.value.token}`
})

// Methods
async function createShare(): Promise<void> {
  isCreating.value = true
  try {
    shareToken.value = await createShareToken(props.session.id, options)
  } finally {
    isCreating.value = false
  }
}

async function revokeShare(): Promise<void> {
  if (confirm('Revoke this share link?')) {
    await revokeShareToken(props.session.id)
    shareToken.value = null
  }
}

function copyLink(): void {
  if (linkInput.value) {
    linkInput.value.select()
    navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}

// Load existing share
onMounted(async () => {
  shareToken.value = await getShareToken(props.session.id)
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.sharing-modal {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
}

.sharing-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.sharing-modal__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
}

.sharing-modal__content {
  padding: 1.5rem;
}

.share-link {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.link-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.875rem;
}

.share-info {
  margin-bottom: 1rem;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
}

.share-info p {
  margin: 0.25rem 0;
}

.share-option {
  margin-bottom: 1rem;
}

.share-option label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.share-option select,
.share-option input[type='number'] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent-color, #3b82f6);
  color: white;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  background: var(--danger-color, #ef4444);
  color: white;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color, #e5e7eb);
}
</style>
