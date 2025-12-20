<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  amount?: number | null
  currency?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  amount: 0,
  currency: 'USD',
  size: 'md',
})

const displayPrice = computed(() => {
  const amount = typeof props.amount === 'number' ? props.amount : Number(props.amount)
  const currency = typeof props.currency === 'string' ? props.currency : ''

  if (!Number.isFinite(amount) || currency.trim().length === 0) return '—'

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return formatter.format(amount)
  } catch (_err) {
    return '—'
  }
})
</script>

<template>
  <span class="price-tag" :class="`price-tag--${size}`">
    {{ displayPrice }}
  </span>
</template>

<style scoped>
.price-tag {
  font-weight: 600;
  color: var(--text-primary);
}

.price-tag--sm {
  font-size: 0.875rem;
}

.price-tag--md {
  font-size: 1.125rem;
}

.price-tag--lg {
  font-size: 1.5rem;
}
</style>
