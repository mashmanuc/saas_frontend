<template>
  <router-view />
  <DiagnosticsPanel v-if="isDev" />
</template>

<script setup>
import { DiagnosticsPanel } from './modules/diagnostics'

const isDev = import.meta.env.DEV
</script>
