<template>
  <span :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', cls]">
    <span class="w-1.5 h-1.5 rounded-full" :class="dotCls" />
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  status: { type: String, required: true },
})

const { t } = useI18n()

const STATUS_STYLES = {
  open: 'bg-slate-100 text-slate-700',
  under_review: 'bg-amber-100 text-amber-800',
  planned: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  released: 'bg-emerald-100 text-emerald-800',
  done: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-700',
  duplicate: 'bg-slate-200 text-slate-700',
  archived: 'bg-slate-100 text-slate-500',
  needs_info: 'bg-purple-100 text-purple-700',
}
const DOT_STYLES = {
  open: 'bg-slate-400',
  under_review: 'bg-amber-500',
  planned: 'bg-amber-500',
  in_progress: 'bg-blue-500',
  released: 'bg-emerald-500',
  done: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  duplicate: 'bg-slate-500',
  archived: 'bg-slate-400',
  needs_info: 'bg-purple-500',
}

const cls = computed(() => STATUS_STYLES[props.status] || STATUS_STYLES.open)
const dotCls = computed(() => DOT_STYLES[props.status] || DOT_STYLES.open)
const label = computed(() => t(`feedback.status.${props.status}`, props.status))
</script>
