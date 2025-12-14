<template>
  <PageThemeProvider>
    <router-view />
    <DiagnosticsPanel v-if="isDev" />
  </PageThemeProvider>
</template>

<script setup>
import { PageThemeProvider } from './modules/ui/theme'
import { DiagnosticsPanel } from './modules/diagnostics'

const isDev = import.meta.env.DEV
</script>
