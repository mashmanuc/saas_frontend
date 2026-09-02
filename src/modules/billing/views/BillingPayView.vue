<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <Card class="w-full max-w-md space-y-6">
      <div class="text-center">
        <Heading :level="1" class="mb-2">
          {{ t('billing.pay.title') }}
        </Heading>
        <p class="text-sm text-muted-foreground">
          {{ message }}
        </p>
      </div>

      <div v-if="state === 'loading'" class="h-10 animate-pulse rounded bg-muted"></div>

      <div v-else class="space-y-2">
        <Button
          v-if="state === 'ready'"
          variant="primary"
          class="w-full"
          data-testid="paddle-reopen"
          @click="openCheckout"
        >
          {{ t('billing.pay.reopen') }}
        </Button>
        <Button
          variant="outline"
          class="w-full"
          @click="goToBilling"
        >
          {{ t('billing.pay.backToBilling') }}
        </Button>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { loadPaddle } from '../utils/paddleLoader'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Heading from '@/ui/Heading.vue'

/**
 * Хост overlay-чекауту Paddle. Paddle НЕ хостить сторінку оплати: backend
 * створює транзакцію з checkout.url = ця сторінка, Paddle повертає
 * `<url>?_ptxn=<txn_id>`, а Paddle.js тут сам відкриває overlay, побачивши
 * `_ptxn` у query при Initialize. Повернення після оплати — successUrl.
 */

type PayState = 'loading' | 'ready' | 'missing_txn' | 'not_configured' | 'load_failed'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const state = ref<PayState>('loading')
let paddle: any = null

const transactionId = computed<string | null>(() => {
  const raw = route.query._ptxn
  return typeof raw === 'string' && raw.length > 0 ? raw : null
})

const message = computed(() => {
  switch (state.value) {
    case 'loading':
      return t('billing.pay.opening')
    case 'ready':
      return t('billing.pay.ready')
    case 'missing_txn':
      return t('billing.pay.missingTxn')
    case 'not_configured':
      return t('billing.pay.notConfigured')
    case 'load_failed':
      return t('billing.pay.loadFailed')
  }
})

function openCheckout() {
  if (!paddle || !transactionId.value) return
  paddle.Checkout.open({ transactionId: transactionId.value })
}

function goToBilling() {
  router.push({ name: 'account-billing' })
}

onMounted(async () => {
  if (!transactionId.value) {
    state.value = 'missing_txn'
    return
  }

  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN
  if (!token) {
    console.error('[billing/pay] VITE_PADDLE_CLIENT_TOKEN не задано')
    state.value = 'not_configured'
    return
  }

  try {
    paddle = await loadPaddle()
  } catch (error) {
    console.error('[billing/pay] Paddle.js load failed', error)
    state.value = 'load_failed'
    return
  }

  // Без Environment.set Paddle.js іде на production — test_-токен там невалідний.
  if ((import.meta.env.VITE_PADDLE_ENV || 'sandbox') === 'sandbox') {
    paddle.Environment.set('sandbox')
  }
  paddle.Initialize({
    token,
    checkout: {
      settings: {
        displayMode: 'overlay',
        successUrl: `${window.location.origin}/tutor/billing/success`,
      },
    },
  })
  state.value = 'ready'
})
</script>
