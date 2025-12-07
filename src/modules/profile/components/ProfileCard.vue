<template>
  <Card class="space-y-4">
    <div v-if="title || subtitle || hasActions" class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 v-if="title" class="text-lg font-semibold text-foreground">
          {{ title }}
        </h3>
        <p v-if="subtitle" class="text-sm text-muted-foreground">
          {{ subtitle }}
        </p>
      </div>

      <div v-if="hasActions">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </Card>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import Card from '../../../ui/Card.vue'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
})

const slots = useSlots()
const hasActions = computed(() => Boolean(slots?.actions))
</script>
