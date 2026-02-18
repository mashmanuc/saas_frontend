<template>
  <RouterLink
    v-if="item?.to"
    :to="item.to"
    class="block menu-item"
    active-class="menu-item--active"
  >
    <span v-if="iconChar" class="menu-item-icon" aria-hidden="true">{{ iconChar }}</span>
    <span class="truncate">{{ $t(item.label) }}</span>
  </RouterLink>

  <div v-else class="menu-item">
    <span v-if="iconChar" class="menu-item-icon" aria-hidden="true">{{ iconChar }}</span>
    <span class="truncate">{{ $t(item.label) }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const ICONS = {
  home: '🏠',
  users: '👥',
  class: '🏫',
  book: '📘',
}

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const iconChar = computed(() => {
  if (!props.item?.icon) return null
  return ICONS[props.item.icon] || '•'
})
</script>
