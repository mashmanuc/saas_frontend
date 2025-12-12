<script setup lang="ts">
interface Props {
  amount: number
  currency: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

function formatPrice(): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: props.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return formatter.format(props.amount)
}
</script>

<template>
  <span class="price-tag" :class="`price-tag--${size}`">
    {{ formatPrice() }}
  </span>
</template>

<style scoped>
.price-tag {
  font-weight: 600;
  color: #111827;
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
