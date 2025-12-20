<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { marketplaceApi, type WeeklyAvailabilitySlot } from '../../api/marketplace'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { useI18n } from 'vue-i18n'
import { mapMarketplaceErrorToMessage, parseMarketplaceApiError } from '../../utils/apiErrors'

const props = defineProps<{ slug: string }>()

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'select-slot', slot: WeeklyAvailabilitySlot): void
}>()

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function startOfWeek(date: Date): Date {
  // Monday-based week
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d
}

const weekStart = ref(startOfWeek(new Date()))
const isLoading = ref(false)
const error = ref<string | null>(null)
const slots = ref<WeeklyAvailabilitySlot[]>([])

const weekDays = computed(() => {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.value)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
})

const slotsByDay = computed(() => {
  const map: Record<string, WeeklyAvailabilitySlot[]> = {}
  for (const day of weekDays.value) {
    map[toIsoDate(day)] = []
  }
  for (const s of slots.value) {
    const dt = new Date(s.starts_at)
    const key = toIsoDate(dt)
    if (!map[key]) map[key] = []
    map[key].push(s)
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }
  return map
})

async function load() {
  if (!props.slug) return
  isLoading.value = true
  error.value = null
  try {
    const data = await marketplaceApi.getWeeklyAvailability(props.slug, {
      week_start: toIsoDate(weekStart.value),
      tz,
    })
    slots.value = Array.isArray(data?.slots) ? data.slots : []
  } catch (e: any) {
    error.value = mapMarketplaceErrorToMessage(parseMarketplaceApiError(e), t('marketplace.availability.loadError'))
    slots.value = []
  } finally {
    isLoading.value = false
  }
}

function prevWeek() {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() - 7)
  weekStart.value = d
}

function nextWeek() {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + 7)
  weekStart.value = d
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

onMounted(load)
watch(() => props.slug, load)
watch(weekStart, load)
</script>

<template>
  <section class="availability" data-test="marketplace-availability">
    <div class="header">
      <h2>{{ t('marketplace.availability.title') }}</h2>
      <div class="nav">
        <button type="button" class="btn btn-ghost" @click="prevWeek" :disabled="isLoading">
          <ChevronLeft :size="18" />
        </button>
        <div class="range">
          {{ formatDayLabel(weekDays[0]) }} – {{ formatDayLabel(weekDays[6]) }}
        </div>
        <button type="button" class="btn btn-ghost" @click="nextWeek" :disabled="isLoading">
          <ChevronRight :size="18" />
        </button>
      </div>
    </div>

    <LoadingSpinner v-if="isLoading" />
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="grid">
      <div v-for="day in weekDays" :key="toIsoDate(day)" class="day">
        <div class="day-title">{{ formatDayLabel(day) }}</div>
        <div class="slots">
          <button
            v-for="s in slotsByDay[toIsoDate(day)]"
            :key="s.starts_at"
            type="button"
            class="slot"
            @click="emit('select-slot', s)"
          >
            {{ formatTime(s.starts_at) }}
          </button>
          <div v-if="slotsByDay[toIsoDate(day)].length === 0" class="empty">{{ t('marketplace.availability.empty') }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.availability {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-sm);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.header h2 {
  font: var(--font-headline);
  margin: 0;
  color: var(--text-primary);
}

.nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.range {
  font-size: 0.875rem;
  color: var(--text-muted);
  min-width: 220px;
  text-align: center;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.75rem;
}

@media (max-width: 968px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.day {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.75rem;
}

.day-title {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.slots {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slot {
  border: 1px solid var(--border-color);
  background: var(--surface-card);
  border-radius: 8px;
  padding: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.slot:hover {
  border-color: var(--accent-primary);
}

.empty {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.error {
  color: color-mix(in srgb, var(--danger-bg) 72%, var(--text-primary));
  font-size: 0.875rem;
}
</style>
