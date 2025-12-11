<template>
  <div class="space-y-3 rounded-2xl border border-border-subtle bg-surface-soft/40 p-4 text-sm">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-muted">{{ $t('board.participantsList.title') }}</p>
        <p class="text-[13px] text-muted">{{ $t('board.participantsList.subtitle') }}</p>
      </div>
      <span class="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-body shadow-theme">
        {{ participants.length }}
      </span>
    </div>

    <ul class="space-y-2">
      <li
        v-for="participant in participantRows"
        :key="participant.id"
        class="rounded-xl border border-border-subtle bg-white/80 p-3 shadow-sm"
      >
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex-1">
            <p class="font-semibold text-body">{{ participant.name }}</p>
            <p class="text-xs text-muted">
              {{ $t(`lessons.detail.roles.${participant.role}`) }}
            </p>
          </div>
          <div class="inline-flex items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-semibold">
            <span class="h-2 w-2 rounded-full" :class="participant.online ? 'bg-success' : 'bg-muted'"></span>
            {{ participant.online ? $t('presence.online') : $t('presence.offline') }}
          </div>
        </div>
        <p v-if="participant.cursor" class="mt-2 text-xs font-semibold text-accent">
          {{
            $t('board.participantsList.cursorActive', {
              name: participant.shortName,
            })
          }}
        </p>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  participants: {
    type: Array,
    default: () => [],
  },
  isOnline: {
    type: Function,
    default: () => false,
  },
  cursors: {
    type: Array,
    default: () => [],
  },
})

const participantRows = computed(() =>
  props.participants.map((participant) => {
    const cursor = props.cursors.find((entry) => String(entry.userId) === String(participant.id))
    return {
      ...participant,
      online: Boolean(props.isOnline?.(participant.id)),
      cursor,
      shortName: participant.name?.split?.(' ')?.[0] || participant.name || '—',
    }
  }),
)
</script>

<style scoped>
.text-muted {
  color: rgba(7, 15, 30, 0.55);
}
.text-body {
  color: rgba(7, 15, 30, 0.9);
}
.bg-surface-soft {
  background-color: rgba(7, 15, 30, 0.04);
}
.border-border-subtle {
  border-color: rgba(7, 15, 30, 0.08);
}
.bg-success {
  background: #16a34a;
}
.bg-muted {
  background: rgba(7, 15, 30, 0.35);
}
.text-accent {
  color: #4f46e5;
}
.shadow-theme {
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
}
</style>
