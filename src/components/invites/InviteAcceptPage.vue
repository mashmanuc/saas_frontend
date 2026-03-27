<template>
  <div class="mx-auto max-w-lg px-4 py-10">
    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-16">
      <svg class="h-8 w-8 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-800 dark:bg-red-900/20">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      </div>
      <p class="text-sm font-medium text-red-800 dark:text-red-300">
        {{ $t(`invites.errors.${error.toLowerCase()}`, $t('invites.errors.unknown')) }}
      </p>
    </div>

    <!-- Success (after accept) -->
    <div v-else-if="acceptResult" class="rounded-2xl border border-border-subtle bg-white p-8 text-center shadow-lg dark:bg-surface-dark">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </div>
      <h2 class="mb-2 text-xl font-bold text-body">{{ $t('invites.viral.title') }}</h2>
      <p class="mb-6 text-sm text-muted">
        {{ $t('invites.viral.subtitle', { tutorName: invite?.tutor_info?.full_name || '' }) }}
      </p>

      <!-- Viral hooks -->
      <div class="flex flex-col gap-3">
        <router-link
          :to="dashboardRoute"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
        >
          {{ $t('invites.viral.goToDashboard') }}
        </router-link>
        <router-link
          to="/tutors"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-soft hover:text-body"
        >
          {{ $t('invites.viral.exploreMore') }}
        </router-link>
      </div>
    </div>

    <!-- Invite details (before accept) -->
    <div v-else-if="invite" class="rounded-2xl border border-border-subtle bg-white p-6 shadow-lg dark:bg-surface-dark">
      <!-- Tutor info -->
      <div class="mb-6 text-center">
        <img
          v-if="invite.tutor_info?.avatar_url"
          :src="invite.tutor_info.avatar_url"
          :alt="invite.tutor_info.full_name"
          class="mx-auto mb-3 h-24 w-24 rounded-full object-cover ring-2 ring-accent/20"
        />
        <div v-else class="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-accent/10 text-3xl font-bold text-accent">
          {{ (invite.tutor_info?.full_name || '?')[0] }}
        </div>
        <h2 class="text-lg font-bold text-body">
          {{ $t('invites.detail.title', { tutorName: invite.tutor_info?.full_name || '' }) }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          {{ $t('invites.detail.description', { tutorName: invite.tutor_info?.full_name || '' }) }}
        </p>
      </div>

      <!-- Subjects -->
      <div v-if="invite.tutor_info?.subjects?.length" class="mb-4 flex flex-wrap justify-center gap-2">
        <span
          v-for="subject in invite.tutor_info.subjects"
          :key="subject"
          class="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
        >
          {{ subject }}
        </span>
      </div>

      <!-- Status warnings -->
      <div
        v-if="!invite.is_active"
        class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      >
        <template v-if="invite.status === 'expired'">{{ $t('invites.detail.expired') }}</template>
        <template v-else-if="invite.status === 'used'">{{ $t('invites.detail.used') }}</template>
        <template v-else-if="invite.status === 'cancelled'">{{ $t('invites.detail.cancelled') }}</template>
        <template v-else>{{ $t('invites.detail.inactive') }}</template>
      </div>

      <!-- Accept / Fallback -->
      <div class="flex flex-col gap-2">
        <button
          v-if="invite.is_active"
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-base font-bold text-white shadow transition hover:bg-accent/90 disabled:opacity-50"
          :disabled="isAccepting"
          @click="handleAccept"
        >
          <svg v-if="isAccepting" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ $t('invites.detail.acceptButton') }}
        </button>

        <router-link
          v-if="!invite.is_active"
          :to="`/tutors/${invite.tutor_info?.id}`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/5"
        >
          {{ $t('invites.detail.viewProfile') }}
        </router-link>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useInviteDetail } from '@/composables/useInviteDetail'
import { useInviteAccept } from '@/composables/useInviteAccept'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { getDefaultRouteForRole } from '@/config/routes'

const route = useRoute()
const token = route.params.token as string
const auth = useAuthStore()

const { isLoading, invite, error, fetch } = useInviteDetail(token)
const { isAccepting, result: acceptResult, accept } = useInviteAccept(token)

const dashboardRoute = computed(() => {
  return auth.user?.role ? getDefaultRouteForRole(auth.user.role) : '/student'
})

async function handleAccept() {
  await accept()
}

onMounted(() => {
  fetch()
})
</script>
