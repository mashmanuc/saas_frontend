<template>
  <span class="inline-flex items-center gap-1 text-xs font-medium text-muted">
    <span
      class="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
      :class="online ? 'bg-presence-online' : 'bg-presence-offline'"
    ></span>
    <slot>{{ online ? onlineLabel : offlineLabel }}</slot>
  </span>
</template>

<script setup>
const props = defineProps({
  online: {
    type: Boolean,
    default: false,
  },
  showLabel: {
    type: Boolean,
    default: true,
  },
  onlineLabel: {
    type: String,
    default: 'Online',
  },
  offlineLabel: {
    type: String,
    default: 'Offline',
  },
})
</script>

<style scoped>
.text-muted {
  color: rgba(7, 15, 30, 0.55);
}
.bg-presence-online {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}
.bg-presence-offline {
  background: rgba(7, 15, 30, 0.2);
}
</style>
