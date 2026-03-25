<template>
  <div class="relative">
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
      :disabled="isCreating"
      @click="handleCreate"
    >
      <svg v-if="isCreating" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
        <path d="M16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
      </svg>
      {{ $t('invites.createButton') }}
    </button>

    <!-- Share modal -->
    <Teleport to="body">
      <div
        v-if="showShareModal && invite"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="closeModal" />

        <!-- Modal -->
        <div class="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-dark">
          <!-- Header -->
          <div class="mb-5 flex items-center justify-between">
            <h3 class="text-lg font-bold text-body">{{ $t('invites.shareTitle') }}</h3>
            <button
              type="button"
              class="rounded-lg p-1 text-muted transition hover:bg-surface-soft hover:text-body"
              @click="closeModal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>

          <!-- Invite URL field -->
          <div class="mb-2">
            <label class="mb-1 block text-xs font-medium text-muted">
              {{ $t('invites.inviteUrl') }}
            </label>
            <div class="flex items-stretch">
              <input
                ref="urlInput"
                type="text"
                class="flex-1 rounded-l-lg border border-r-0 border-border-subtle bg-surface-soft px-3 py-2.5 text-sm text-body outline-none select-all"
                :value="invite.invite_url"
                readonly
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-r-lg border px-3 text-sm font-medium transition"
                :class="copied
                  ? 'border-green-400 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'border-border-subtle bg-white text-muted hover:bg-surface-soft hover:text-body dark:bg-surface-dark'"
                @click="copyToClipboard"
              >
                <!-- Checkmark icon (copied) -->
                <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                <!-- Copy icon -->
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Expires at -->
          <p class="mb-5 text-xs text-muted">
            {{ $t('invites.expiresAt') }}: {{ formatDate(invite.expires_at) }}
          </p>

          <!-- Big copy button -->
          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition"
            :class="copied
              ? 'bg-green-600 text-white'
              : 'bg-accent text-white hover:bg-accent/90'"
            @click="copyToClipboard"
          >
            <!-- Checkmark -->
            <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            <!-- Link icon -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" />
            </svg>
            {{ copied ? $t('invites.copiedToClipboard') : $t('invites.shareCopy') }}
          </button>

          <!-- Hint -->
          <p class="mt-3 text-center text-xs text-muted">
            {{ $t('invites.shareHint') }}
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useInviteCreate } from '@/composables/useInviteCreate'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isCreating, invite, create } = useInviteCreate()

const showShareModal = ref(false)
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function handleCreate() {
  copied.value = false
  const result = await create()
  if (result) {
    showShareModal.value = true
  }
}

function closeModal() {
  showShareModal.value = false
  copied.value = false
}

async function copyToClipboard() {
  if (!invite.value) return
  try {
    await navigator.clipboard.writeText(invite.value.invite_url)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = false }, 3000)
  } catch (err) {
    // Fallback: select input text
    console.error('Failed to copy:', err)
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
