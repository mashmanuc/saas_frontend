<template>
  <!-- Смугу доступності («N год доступно» / «Ви ще жодного разу не позначали
       вільний час» + кнопка «Позначити вільний час») прибрано 2026-09-22 за
       рішенням власника. Підстава — візуальний огляд `UI_VISUAL_AUDIT_2026-09-22.md`
       п.2: учень не бачить вільних годин тьютора, бо єдиний такий екран
       (`StudentAvailabilityCalendar`) живе у вимкненому 2026-06-17 маркетплейсі.
       Кнопка вела в режим, результат якого нікому не показувався.
       Довідка («?») лишається — вона про весь календар, а не про доступність,
       і переїхала в рядок навігації тижнем. -->
  <div class="week-navigation">
    <Button
      variant="ghost"
      iconOnly
      @click="handleNavigate(-1)"
      :disabled="isLoading"
      :aria-label="t('calendar.weekNavigation.prevWeek')"
      data-testid="calendar-prev-week"
    >
      <ChevronLeftIcon class="w-5 h-5" />
    </Button>

    <div class="week-info">
      <span class="week-range">{{ weekRangeFormatted }}</span>
      <Button
        v-if="currentPage !== 0"
        variant="outline"
        size="sm"
        @click="handleToday"
      >
        {{ t('calendar.weekNavigation.today') }}
      </Button>
    </div>

    <Button
      variant="ghost"
      iconOnly
      @click="handleNavigate(1)"
      :disabled="isLoading"
      :aria-label="t('calendar.weekNavigation.nextWeek')"
      data-testid="calendar-next-week"
    >
      <ChevronRightIcon class="w-5 h-5" />
    </Button>

    <Button
      class="week-navigation__help"
      variant="ghost"
      iconOnly
      @click="handleShowGuide"
      :aria-label="t('calendar.weekNavigation.showGuide')"
      :title="t('calendar.weekNavigation.showGuide')"
    >
      <HelpCircleIcon class="w-5 h-5" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  HelpCircle as HelpCircleIcon,
} from 'lucide-vue-next'
import Button from '@/ui/Button.vue'

const { t, locale } = useI18n()

const props = defineProps<{
  weekStart?: string
  weekEnd?: string
  currentPage: number
  isLoading: boolean
}>()

const emit = defineEmits<{
  navigate: [direction: -1 | 1]
  today: []
  'show-guide': []
}>()

const weekRangeFormatted = computed(() => {
  if (!props.weekStart || !props.weekEnd) return ''

  const start = new Date(props.weekStart)
  const end = new Date(props.weekEnd)

  return `${start.toLocaleDateString(locale.value, { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' })}`
})

function handleNavigate(direction: -1 | 1) {
  emit('navigate', direction)
}

function handleToday() {
  emit('today')
}

function handleShowGuide() {
  emit('show-guide')
}
</script>

<style scoped>
.week-navigation {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm, 0 4px 12px rgba(0, 0, 0, 0.05));
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: none;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: var(--bg-tertiary, #e5e7eb);
  transform: translateY(-1px);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.week-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.week-range {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.today-btn {
  padding: 4px 12px;
  border-radius: 9999px;
  background: var(--accent-bg, #e0f2fe);
  color: var(--accent);
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.today-btn:hover {
  background: var(--accent-bg-hover, #bae6fd);
}

/* Довідка стоїть у куті смуги, щоб не зсувати стрілки з центру. */
.week-navigation__help {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.scroll-available-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: var(--accent-bg, #e0f2fe);
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.scroll-available-btn:hover:not(:disabled) {
  background: var(--accent-bg-hover, #bae6fd);
}

.scroll-available-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-slot-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s, transform 0.2s;
}

.create-slot-btn:hover {
  background: var(--accent-hover, #2563eb);
  transform: translateY(-1px);
}

.edit-availability-btn {
  padding: 8px 16px;
  background: var(--success);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s, transform 0.2s;
}

.edit-availability-btn:hover {
  background: var(--success-hover, #059669);
  transform: translateY(-1px);
}

.help-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.help-btn:hover {
  background: var(--bg-tertiary, #e5e7eb);
  color: var(--text-primary);
  transform: scale(1.05);
}

/* Телефон: `calendar-responsive.css` ставить смузі `flex-direction: column` —
   те правило писане під іншу розмітку (`.week-navigation__controls`, якої тут
   немає), і в нас стрілки ставали стовпчиком заввишки 162 px. Лишаємо рядок,
   праворуч тримаємо місце під довідку, дату дозволяємо переносити. */
@media (max-width: 767px) {
  .week-navigation {
    flex-direction: row;
    gap: 4px;
    padding: 8px 44px 8px 8px;
  }

  .week-range {
    font-size: 14px;
    text-align: center;
  }
}
</style>
