<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-base font-bold text-body">{{ $t('invites.list.title') }}</h3>
      <InviteCreateButton />
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-8">
      <svg class="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>

    <!-- Empty state -->
    <div v-else-if="invites.length === 0" class="rounded-2xl border border-dashed border-border-subtle bg-surface-soft/50 px-6 py-8 text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
          <path d="M16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-body">{{ $t('invites.list.empty') }}</p>
      <p class="mt-1 text-xs text-muted">{{ $t('invites.list.createFirst') }}</p>
    </div>

    <!-- Invites list -->
    <div v-else class="space-y-2">
      <div
        v-for="inv in invites"
        :key="inv.public_id"
        class="rounded-xl border border-border-subtle bg-white p-4 transition hover:shadow-sm dark:bg-surface-dark"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-1.5">
            <!-- Status badge -->
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="statusBadgeClass(inv.status)"
            >
              {{ $t(`invites.status.${inv.status}`) }}
            </span>

            <!-- Token -->
            <div class="truncate font-mono text-xs text-muted">
              {{ inv.token }}
            </div>

            <!-- Stats -->
            <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
              <span class="inline-flex items-center gap-1">
                👁 {{ $t('invites.list.openedCount', { count: inv.opened_count || 0 }) }}
              </span>
              <span class="inline-flex items-center gap-1">
                📅 {{ formatDate(inv.created_at) }}
              </span>
              <span v-if="inv.expires_at" class="inline-flex items-center gap-1">
                ⏰ {{ formatDate(inv.expires_at) }}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5">
            <!-- Copy link -->
            <button
              type="button"
              class="rounded-lg p-2 transition"
              :class="copiedId === inv.public_id
                ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                : 'text-muted hover:bg-surface-soft hover:text-body'"
              :title="copiedId === inv.public_id ? $t('invites.copiedToClipboard') : $t('invites.shareCopy')"
              @click="copyToClipboard(inv)"
            >
              <!-- Checkmark (copied) -->
              <svg v-if="copiedId === inv.public_id" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <!-- Clipboard -->
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            </button>

            <!-- Cancel -->
            <button
              v-if="inv.status === 'active'"
              type="button"
              class="rounded-lg p-2 text-danger transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
              :disabled="cancellingId === inv.public_id"
              :title="$t('invites.list.cancel')"
              @click="handleCancel(inv)"
            >
              <svg v-if="cancellingId === inv.public_id" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invitesApi } from '@/api/invites'
import type { InviteDTO } from '@/types/invites'
import { useI18n } from 'vue-i18n'
import InviteCreateButton from './InviteCreateButton.vue'

const { t } = useI18n()

const isLoading = ref(false)
const invites = ref<InviteDTO[]>([])
const cancellingId = ref<string | null>(null)
const copiedId = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function fetchInvites() {
  isLoading.value = true
  try {
    const allInvites = await invitesApi.fetchInvites()
    // Show only active and recently used invites (hide old cancelled/expired)
    invites.value = allInvites.filter(inv => {
      if (inv.status === 'active' || inv.status === 'used') return true
      // Show cancelled/expired only if created in last 7 days
      const createdAt = new Date(inv.created_at)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return createdAt > weekAgo
    })
  } catch (err) {
    console.error('Failed to fetch invites:', err)
  } finally {
    isLoading.value = false
  }
}

async function handleCancel(inv: InviteDTO) {
  cancellingId.value = inv.public_id
  try {
    const updated = await invitesApi.cancelInvite(inv.public_id)
    // Update local state with cancelled invite
    const index = invites.value.findIndex(i => i.public_id === inv.public_id)
    if (index !== -1) {
      invites.value[index] = updated
    }
  } catch (err: any) {
    const errorCode = err.response?.data?.code || 'unknown'
    console.error(`Cancel failed: ${errorCode}`, err)
  } finally {
    cancellingId.value = null
  }
}

async function copyToClipboard(inv: InviteDTO) {
  try {
    await navigator.clipboard.writeText(inv.invite_url)
    copiedId.value = inv.public_id
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copiedId.value = null }, 2500)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'used': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'expired': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'cancelled': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('uk-UA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(fetchInvites)
</script>
