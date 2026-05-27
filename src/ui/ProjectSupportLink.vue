<template>
  <a
    v-if="isEnabled"
    :href="supportUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="text-sm text-muted-foreground hover:text-foreground transition-colors"
  >
    {{ $t('footer.support') }}
  </a>
</template>

<script setup>
const supportUrl = import.meta.env.VITE_SUPPORT_URL
const isEnabled = import.meta.env.VITE_SUPPORT_ENABLED === 'true' && !!supportUrl
</script>
