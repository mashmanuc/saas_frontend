<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 p-4 bg-warning-light border-t-2 border-warning shadow-lg">
    <div class="max-w-4xl mx-auto flex items-center justify-between gap-4">
      <div class="flex items-start gap-3">
        <AlertCircle :size="24" class="text-warning flex-shrink-0 mt-0.5" />
        <div>
          <p class="font-semibold text-warning-dark">
            {{ $t('billing.subscriptionRequired.title') }}
          </p>
          <p class="text-sm text-warning-dark mt-1">
            {{ $t('billing.subscriptionRequired.message') }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="primary" size="sm" @click="goToPlans">
          {{ $t('billing.upgrade') }}
        </Button>
        <button
          class="p-2 hover:bg-warning/10 rounded-lg transition-colors"
          @click="$emit('close')"
        >
          <X :size="20" class="text-warning-dark" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Subscription Required Banner (v0.72.0)
 * 
 * Shows when user hits a limit or tries to access a feature that requires subscription.
 * 
 * CRITICAL UX:
 * - NOT just a toast
 * - Prominent banner with clear CTA
 * - Direct link to upgrade
 */

import { useRouter } from 'vue-router'
import { AlertCircle, X } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

defineEmits<{
  close: []
}>()

const router = useRouter()

function goToPlans() {
  router.push('/billing/plans')
}
</script>
