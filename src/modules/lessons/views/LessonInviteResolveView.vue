<template>
  <div class="mx-auto w-full max-w-lg space-y-4 px-4 py-8">
    <Card class="space-y-4 p-6">
      <div class="space-y-1">
        <p class="text-xs uppercase tracking-wide text-muted">{{ $t('lessons.inviteResolve.title') }}</p>
        <h1 class="text-xl font-semibold text-foreground">{{ headline }}</h1>
        <p class="text-sm text-muted">{{ description }}</p>
      </div>

      <div v-if="status === 'error'" class="rounded-lg border border-border-subtle bg-surface-soft p-4 text-sm">
        <p class="font-semibold text-foreground">{{ errorTitle }}</p>
        <p class="mt-1 text-muted">{{ errorDetail }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button
          v-if="status === 'error'"
          variant="secondary"
          size="sm"
          data-test="invite-back-to-lessons"
          @click="goToLessons"
        >
          {{ $t('lessons.inviteResolve.actions.backToLessons') }}
        </Button>

        <Button
          v-if="status === 'error'"
          variant="ghost"
          size="sm"
          data-test="invite-retry"
          @click="resolve"
        >
          {{ $t('common.retry') }}
        </Button>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import lessonsApi from '../../../api/lessons'
import Card from '../../../ui/Card.vue'
import Button from '../../../ui/Button.vue'
import { notifyError } from '../../../utils/notify'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const token = computed(() => route.params.token)

const status = ref('loading') // loading | redirecting | error
const errorCode = ref(null)
const errorMessage = ref(null)

const headline = computed(() => {
  if (status.value === 'loading') return t('lessons.inviteResolve.loading')
  if (status.value === 'redirecting') return t('lessons.inviteResolve.redirecting')
  return t('lessons.inviteResolve.failed')
})

const description = computed(() => {
  if (status.value === 'loading') return t('lessons.inviteResolve.loadingDescription')
  if (status.value === 'redirecting') return t('lessons.inviteResolve.redirectingDescription')
  return t('lessons.inviteResolve.failedDescription')
})

const errorTitle = computed(() => {
  if (errorCode.value === 'invite_expired') return t('lessons.inviteResolve.errors.expired.title')
  if (errorCode.value === 'invite_invalid') return t('lessons.inviteResolve.errors.invalid.title')
  if (errorCode.value === 'forbidden') return t('lessons.inviteResolve.errors.forbidden.title')
  if (errorCode.value === 'lesson_not_found') return t('lessons.inviteResolve.errors.notFound.title')
  return t('lessons.inviteResolve.errors.generic.title')
})

const errorDetail = computed(() => {
  if (errorMessage.value) return errorMessage.value
  if (errorCode.value === 'invite_expired') return t('lessons.inviteResolve.errors.expired.description')
  if (errorCode.value === 'invite_invalid') return t('lessons.inviteResolve.errors.invalid.description')
  if (errorCode.value === 'forbidden') return t('lessons.inviteResolve.errors.forbidden.description')
  if (errorCode.value === 'lesson_not_found') return t('lessons.inviteResolve.errors.notFound.description')
  return t('lessons.inviteResolve.errors.generic.description')
})

function normalizeErrorCode(err) {
  const raw = err?.response?.data?.error?.code ?? err?.response?.data?.code
  if (!raw) return null
  return String(raw).toLowerCase().replace(/-/g, '_')
}

async function resolve() {
  status.value = 'loading'
  errorCode.value = null
  errorMessage.value = null

  const inviteToken = token.value
  if (!inviteToken || typeof inviteToken !== 'string') {
    status.value = 'error'
    errorCode.value = 'invite_invalid'
    return
  }

  try {
    const data = await lessonsApi.resolveInvite(inviteToken)
    const sessionUuid = data?.session_uuid || data?.sessionId || data?.session_id

    if (!sessionUuid) {
      status.value = 'error'
      errorCode.value = 'invite_invalid'
      errorMessage.value = t('lessons.inviteResolve.errors.generic.description')
      return
    }

    status.value = 'redirecting'
    await router.replace({ name: 'lesson-room', params: { sessionId: sessionUuid } })
  } catch (err) {
    status.value = 'error'
    errorCode.value = normalizeErrorCode(err)
    errorMessage.value = err?.response?.data?.detail
    notifyError(errorDetail.value)
  }
}

function goToLessons() {
  router.push('/calendar').catch(() => {})
}

onMounted(() => {
  resolve()
})
</script>
