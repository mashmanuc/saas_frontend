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
      <p class="text-sm font-medium text-red-800 dark:text-red-300">
        {{ $t(`invites.errors.${error.toLowerCase()}`, $t('invites.errors.unknown')) }}
      </p>
    </div>

    <!-- Success (existing student bond) -->
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
      <div class="flex flex-col gap-3">
        <router-link :to="dashboardRoute" class="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent/90">
          {{ $t('invites.viral.goToDashboard') }}
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
        <span v-for="subject in invite.tutor_info.subjects" :key="subject" class="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          {{ subject }}
        </span>
      </div>

      <!-- Status warnings (inactive invite) -->
      <div
        v-if="!invite.is_active"
        class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      >
        <template v-if="invite.status === 'expired'">{{ $t('invites.detail.expired') }}</template>
        <template v-else-if="invite.status === 'used'">{{ $t('invites.detail.used') }}</template>
        <template v-else-if="invite.status === 'cancelled'">{{ $t('invites.detail.cancelled') }}</template>
        <template v-else>{{ $t('invites.detail.inactive') }}</template>
      </div>

      <template v-if="invite.is_active">
        <!-- Authenticated student → bond button -->
        <button
          v-if="auth.user"
          type="button"
          class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-base font-bold text-white shadow transition hover:bg-accent/90 disabled:opacity-50"
          :disabled="isAccepting"
          @click="handleAccept"
        >
          <svg v-if="isAccepting" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ $t('invites.detail.acceptButton') }}
        </button>

        <!-- Anonymous → inline registration form -->
        <form v-else class="flex flex-col gap-3" @submit.prevent="handleRegister">
          <p class="text-center text-sm text-muted">{{ $t('invites.register.subtitle') }}</p>

          <div>
            <input
              v-model="form.email" type="email" autocomplete="email" required
              :placeholder="$t('invites.register.email')"
              class="w-full rounded-lg border border-border-subtle px-3 py-2.5 text-sm focus:border-accent focus:outline-none dark:bg-surface-dark"
            />
            <p v-if="fieldErrors?.email" class="mt-1 text-xs text-red-600">{{ fieldErrors.email[0] }}</p>
          </div>

          <div>
            <input
              v-model="form.password" type="password" autocomplete="new-password" required
              :placeholder="$t('invites.register.password')"
              class="w-full rounded-lg border border-border-subtle px-3 py-2.5 text-sm focus:border-accent focus:outline-none dark:bg-surface-dark"
            />
            <p v-if="fieldErrors?.password" class="mt-1 text-xs text-red-600">{{ fieldErrors.password[0] }}</p>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <input v-model="form.first_name" :placeholder="$t('invites.register.firstName')" autocomplete="given-name"
              class="rounded-lg border border-border-subtle px-3 py-2.5 text-sm focus:border-accent focus:outline-none dark:bg-surface-dark" />
            <input v-model="form.last_name" :placeholder="$t('invites.register.lastName')" autocomplete="family-name"
              class="rounded-lg border border-border-subtle px-3 py-2.5 text-sm focus:border-accent focus:outline-none dark:bg-surface-dark" />
          </div>

          <!-- Consents (INV-INVITE-4 — обов'язкові) -->
          <div class="flex flex-col gap-1.5 pt-1">
            <label class="flex items-start gap-2 text-xs text-muted">
              <input v-model="form.accept_privacy" type="checkbox" class="mt-0.5" />
              <span>{{ $t('invites.register.acceptPrefix') }}
                <a href="/legal/privacy" target="_blank" class="text-accent underline">{{ $t('invites.register.privacyDoc') }}</a>
              </span>
            </label>
            <label class="flex items-start gap-2 text-xs text-muted">
              <input v-model="form.accept_terms" type="checkbox" class="mt-0.5" />
              <span>{{ $t('invites.register.acceptPrefix') }}
                <a href="/legal/terms" target="_blank" class="text-accent underline">{{ $t('invites.register.termsDoc') }}</a>
              </span>
            </label>
            <label class="flex items-start gap-2 text-xs text-muted">
              <input v-model="form.accept_offer" type="checkbox" class="mt-0.5" />
              <span>{{ $t('invites.register.acceptPrefix') }}
                <a href="/legal/studentOffer" target="_blank" class="text-accent underline">{{ $t('invites.register.offerDoc') }}</a>
              </span>
            </label>
            <p v-if="consentError" class="text-xs text-red-600">{{ $t('invites.register.consentRequired') }}</p>
          </div>

          <button
            type="submit"
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-base font-bold text-white shadow transition hover:bg-accent/90 disabled:opacity-50"
            :disabled="isAccepting || !allConsents"
          >
            <svg v-if="isAccepting" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ $t('invites.register.submit') }}
          </button>

          <p class="text-center text-xs text-muted">
            {{ $t('invites.register.haveAccount') }}
            <router-link :to="{ name: 'login', query: { redirect: `/invite/${token}` } }" class="text-accent underline">
              {{ $t('invites.register.login') }}
            </router-link>
          </p>
        </form>
      </template>

      <!-- Inactive → view profile -->
      <router-link
        v-else
        :to="`/tutors/${invite.tutor_info?.id}`"
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/5"
      >
        {{ $t('invites.detail.viewProfile') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useInviteDetail } from '@/composables/useInviteDetail'
import { useInviteAccept } from '@/composables/useInviteAccept'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { getDefaultRouteForRole } from '@/config/routes'

const route = useRoute()
const token = route.params.token as string
const auth = useAuthStore()

const { isLoading, invite, error, fetch } = useInviteDetail(token)
const { isAccepting, result: acceptResult, accept, acceptWithRegistration, fieldErrors } = useInviteAccept(token)

const form = reactive({
  email: '', password: '', first_name: '', last_name: '',
  accept_privacy: false, accept_terms: false, accept_offer: false,
})
const allConsents = computed(() => form.accept_privacy && form.accept_terms && form.accept_offer)
const consentError = computed(() => Boolean(fieldErrors.value?.accept_privacy || fieldErrors.value?.accept_terms || fieldErrors.value?.accept_offer))

const dashboardRoute = computed(() =>
  auth.user?.role ? getDefaultRouteForRole(auth.user.role) : '/student'
)

async function handleAccept() {
  await accept()
}

async function handleRegister() {
  await acceptWithRegistration({ ...form })
}

onMounted(() => {
  fetch()
})
</script>
