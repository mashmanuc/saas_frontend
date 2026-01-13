<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <Card class="w-full max-w-md space-y-6">
      <div class="text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-light">
          <svg class="h-8 w-8 text-warning-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <Heading :level="1" class="mb-2">
          {{ $t('billing.cancel.title') }}
        </Heading>
        
        <p class="text-sm text-muted-foreground">
          {{ $t('billing.cancel.subtitle') }}
        </p>
      </div>

      <div class="space-y-4">
        <div class="rounded-lg border border-warning bg-warning/10 p-4">
          <p class="text-sm text-warning-dark">
            {{ $t('billing.cancel.message') }}
          </p>
        </div>

        <div class="space-y-2">
          <Button
            variant="primary"
            class="w-full"
            @click="goToBilling"
          >
            {{ $t('billing.cancel.viewPlans') }}
          </Button>
          
          <Button
            variant="outline"
            class="w-full"
            @click="goToDashboard"
          >
            {{ $t('billing.cancel.backToDashboard') }}
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Heading from '@/ui/Heading.vue'

const router = useRouter()

function goToBilling() {
  router.push({ name: 'account-billing' })
}

function goToDashboard() {
  router.push('/')
}
</script>
