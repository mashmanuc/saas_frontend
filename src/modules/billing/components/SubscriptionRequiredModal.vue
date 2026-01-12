<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="$emit('update:modelValue', false)"
    >
      <div class="bg-card rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <!-- Icon -->
        <div class="flex justify-center">
          <div class="w-16 h-16 rounded-full bg-warning-light flex items-center justify-center">
            <Lock :size="32" class="text-warning" />
          </div>
        </div>

        <!-- Content -->
        <div class="text-center space-y-2">
          <h2 class="text-2xl font-bold">
            {{ $t('billing.subscriptionRequired.title') }}
          </h2>
          <p class="text-muted">
            {{ message || $t('billing.subscriptionRequired.defaultMessage') }}
          </p>
        </div>

        <!-- Features Preview -->
        <div v-if="requiredFeatures.length > 0" class="space-y-2">
          <p class="text-sm font-medium text-muted">
            {{ $t('billing.subscriptionRequired.unlockFeatures') }}
          </p>
          <ul class="space-y-1">
            <li
              v-for="feature in requiredFeatures"
              :key="feature"
              class="flex items-center gap-2 text-sm"
            >
              <Check :size="16" class="text-accent" />
              <span>{{ $t(`billing.features.${feature}`) }}</span>
            </li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <Button
            variant="ghost"
            class="flex-1"
            @click="$emit('update:modelValue', false)"
          >
            {{ $t('common.cancel') }}
          </Button>
          <Button
            variant="primary"
            class="flex-1"
            @click="handleUpgrade"
          >
            {{ $t('billing.viewPlans') }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Subscription Required Modal (v0.72.0)
 * 
 * Modal version of subscription required error.
 * Shows when user tries to access a premium feature.
 * 
 * CRITICAL UX:
 * - Clear explanation of what's locked
 * - Show which features they'll unlock
 * - Direct CTA to upgrade
 */

import { useRouter } from 'vue-router'
import { Lock, Check } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

interface Props {
  modelValue: boolean
  message?: string
  requiredFeatures?: string[]
}

withDefaults(defineProps<Props>(), {
  message: '',
  requiredFeatures: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const router = useRouter()

function handleUpgrade() {
  emit('update:modelValue', false)
  router.push('/billing/plans')
}
</script>
