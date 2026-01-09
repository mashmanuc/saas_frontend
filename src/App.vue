<template>
  <PageThemeProvider>
    <router-view />
    <DiagnosticsPanel v-if="isDev" />
  </PageThemeProvider>
</template>

<script setup>
import { onMounted } from 'vue'
import { PageThemeProvider } from './modules/ui/theme'
import { DiagnosticsPanel } from './modules/diagnostics'
import { useEntitlementsStore } from '@/stores/entitlementsStore'
import { useBillingStore } from '@/stores/billingStore'

const isDev = import.meta.env.DEV

// Refetch entitlements and billing on app mount
// This ensures that after returning from checkout, the plan is updated
onMounted(async () => {
  const entitlementsStore = useEntitlementsStore()
  const billingStore = useBillingStore()
  
  try {
    await Promise.all([
      entitlementsStore.loadEntitlements(),
      billingStore.loadBillingMe()
    ])
  } catch (err) {
    // Silently fail - stores will handle errors
    console.debug('Failed to load entitlements/billing on app mount:', err)
  }
})
</script>
