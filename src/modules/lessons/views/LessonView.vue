<template>
  <div class="space-y-6">
    <Card v-if="loading" class="p-6 text-sm text-muted">{{ $t('loader.loading') }}</Card>
    <Card v-else-if="error" class="p-6 text-sm text-danger space-y-3">
      <p>{{ error }}</p>
      <button class="text-accent text-sm font-semibold hover:underline" @click="reloadLesson">
        {{ $t('lessons.detail.actions.retry') }}
      </button>
    </Card>
    <div v-else class="grid gap-6 xl:grid-cols-[1.2fr,minmax(0,1fr)]">
      <Card class="space-y-6 p-6">
        <header class="space-y-1">
          <p class="text-xs uppercase tracking-wide text-muted">{{ $t('lessons.detail.title') }}</p>
          <h1 class="text-2xl font-semibold text-body">{{ lessonTitle }}</h1>
          <p class="text-sm text-muted">{{ $t('lessons.detail.subtitle', { id: lesson?.id }) }}</p>
        </header>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            :disabled="inviteLoading || !lessonId"
            data-test="lesson-copy-invite"
            @click="copyInvite"
          >
            <span v-if="inviteLoading">{{ $t('common.loading') }}</span>
            <span v-else>{{ $t('lessons.detail.actions.copyInvite') }}</span>
          </Button>
        </div>

        <section class="grid gap-4 md:grid-cols-2">
          <div class="detail-block">
            <p class="detail-label">{{ $t('lessons.detail.fields.start') }}</p>
            <p class="detail-value">{{ formattedStart }}</p>
          </div>
          <div class="detail-block">
            <p class="detail-label">{{ $t('lessons.detail.fields.end') }}</p>
            <p class="detail-value">{{ formattedEnd }}</p>
          </div>
          <div class="detail-block">
            <p class="detail-label">{{ $t('lessons.detail.fields.timezone') }}</p>
            <p class="detail-value">{{ timezoneLabel }}</p>
          </div>
          <div class="detail-block">
            <p class="detail-label">{{ $t('lessons.detail.fields.status') }}</p>
            <p class="detail-value">{{ statusLabel }}</p>
          </div>
          <div class="detail-block">
            <p class="detail-label">{{ $t('lessons.detail.fields.duration') }}</p>
            <p class="detail-value">{{ durationLabel }}</p>
          </div>
        </section>

        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-body">{{ $t('lessons.detail.participants') }}</h2>
            <span class="text-xs text-muted">{{ $t('presence.label') }}</span>
          </div>
          <ul class="space-y-3">
            <li
              v-for="participant in participants"
              :key="participant.id"
              class="rounded-2xl border border-border-subtle bg-surface-soft p-4 space-y-2"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="font-semibold text-body">{{ participant.name }}</p>
                  <p class="text-sm text-muted">{{ participant.email || '—' }}</p>
                </div>
                <PresenceDot :online="isOnline(participant.id)">
                  {{
                    isOnline(participant.id) ? $t('presence.online') : $t('presence.offline')
                  }}
                </PresenceDot>
              </div>
              <p class="text-xs text-muted">
                {{ $t(`lessons.detail.roles.${participant.role}`) }}
              </p>
            </li>
          </ul>
        </section>

        <section v-if="lesson?.notes" class="space-y-2">
          <h3 class="text-lg font-semibold text-body">{{ $t('lessons.detail.notes') }}</h3>
          <p class="text-sm text-muted whitespace-pre-wrap">{{ lesson.notes }}</p>
        </section>
      </Card>

      <div class="space-y-6">
        <Card v-if="lessonId" class="space-y-4 p-6">
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-wide text-muted">{{ $t('board.title') }}</p>
              <p class="text-lg font-semibold text-body">
                {{
                  $tc('board.participants', participantsCount, {
                    count: participantsCount,
                  })
                }}
              </p>
              <p class="text-xs text-muted">
                {{ $t('board.participantsLabel', { count: participantsCount }) }}
              </p>
            </div>
            <span class="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-muted">
              {{ boardStatusLabel }}
            </span>
          </header>

          <BoardToolbar
            :tool="boardStore.tool"
            :color="boardStore.color"
            :thickness="boardStore.thickness"
            :can-undo="boardStore.canUndo"
            :can-redo="boardStore.canRedo"
            :saving="boardStore.saving"
            @update:tool="boardStore.setTool"
            @update:color="boardStore.setColor"
            @update:thickness="boardStore.setThickness"
            @undo="boardStore.undo"
            @redo="boardStore.redo"
            @clear="boardStore.clearBoard"
          />

          <BoardCanvas :tool="boardStore.tool" :color="boardStore.color" :thickness="boardStore.thickness" />

          <BoardParticipants
            :participants="participants"
            :is-online="isOnline"
            :cursors="boardStore.activeCursors"
            class="border-t border-border-subtle pt-4"
          />

          <p v-if="boardStore.strokes.length === 0" class="text-center text-xs text-muted">
            {{ $t('board.empty') }}
          </p>
        </Card>

        <ChatPanel v-if="lessonId" :lesson-id="lessonId" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import Card from '../../../ui/Card.vue'
import Button from '../../../ui/Button.vue'
import ChatPanel from '../../chat/components/ChatPanel.vue'
import PresenceDot from '../../../ui/PresenceDot.vue'
import BoardToolbar from '../../board/components/BoardToolbar.vue'
import BoardCanvas from '../../board/components/BoardCanvas.vue'
import BoardParticipants from '../../board/components/BoardParticipants.vue'
import lessonsApi from '../../../api/lessons'
import { formatDateTime } from '../../../utils/datetime'
import { usePresenceStore } from '../../../stores/presenceStore'
import { useBoardStore } from '../../../stores/boardStore'
import { notifyError, notifySuccess } from '../../../utils/notify'

const route = useRoute()
const { t } = useI18n()

const presenceStore = usePresenceStore()
presenceStore.init()

const boardStore = useBoardStore()

const lesson = ref(null)
const loading = ref(true)
const error = ref(null)
const inviteLoading = ref(false)

const lessonId = computed(() => route.params.id)

const participants = computed(() => {
  if (!lesson.value) return []
  const entries = []
  if (lesson.value.tutor) {
    entries.push({
      id: lesson.value.tutor.id,
      name: lesson.value.tutor.full_name || lesson.value.tutor.name || lesson.value.tutor.email,
      email: lesson.value.tutor.email,
      role: 'tutor',
    })
  }
  if (lesson.value.student) {
    entries.push({
      id: lesson.value.student.id,
      name: lesson.value.student.full_name || lesson.value.student.name || lesson.value.student.email,
      email: lesson.value.student.email,
      role: 'student',
    })
  }
  return entries
})

const participantsCount = computed(() => participants.value.length)
const boardStatusLabel = computed(() => {
  if (boardStore.saving) {
    return t('board.status.saving')
  }
  if (boardStore.lastSavedAt) {
    return t('board.status.savedAt', { time: formatDateTime(boardStore.lastSavedAt) })
  }
  return t('board.status.saved')
})

const lessonTitle = computed(() => {
  if (lesson.value?.title) return lesson.value.title
  return t('lessons.detail.fallbackTitle', { id: lesson.value?.id || lessonId.value })
})

const formattedStart = computed(() => formatDateTime(lesson.value?.start || lesson.value?.start_at))
const formattedEnd = computed(() => formatDateTime(lesson.value?.end || lesson.value?.end_at))

const timezoneLabel = computed(
  () => lesson.value?.timezone || lesson.value?.tutor?.timezone || lesson.value?.student?.timezone || 'UTC',
)

const statusLabel = computed(() => {
  if (!lesson.value?.status) return '—'
  return t(`lessons.calendar.status.${lesson.value.status}`) ?? lesson.value.status
})

const durationLabel = computed(() => {
  const start = lesson.value?.start || lesson.value?.start_at
  const end = lesson.value?.end || lesson.value?.end_at
  if (!start || !end) return '—'
  const minutes = dayjs(end).diff(dayjs(start), 'minute')
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours) {
    return mins ? `${hours}h ${mins}m` : `${hours}h`
  }
  return `${minutes}m`
})

watch(
  () => participants.value.map((participant) => participant.id),
  (ids) => {
    if (ids?.length) {
      presenceStore.track(ids)
    }
  },
  { immediate: true },
)

watch(
  lessonId,
  (id) => {
    if (id) {
      loadLesson(id)
      boardStore.init(id)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  boardStore.dispose()
})

async function loadLesson(id) {
  loading.value = true
  error.value = null
  try {
    const response = await lessonsApi.getLesson(id)
    lesson.value = response?.data ?? response
  } catch (err) {
    error.value = err?.response?.data?.detail || t('lessons.detail.error')
  } finally {
    loading.value = false
  }
}

async function copyInvite() {
  if (!lessonId.value) return
  inviteLoading.value = true
  try {
    const response = await lessonsApi.createInvite(lessonId.value)
    const data = response?.data ?? response
    const inviteUrl = data?.invite_url || data?.inviteUrl
    if (!inviteUrl) {
      notifyError(t('lessons.detail.actions.copyInviteError'))
      return
    }

    await navigator.clipboard.writeText(inviteUrl)
    notifySuccess(t('lessons.detail.actions.copyInviteSuccess'))
  } catch (err) {
    notifyError(err?.response?.data?.detail || t('lessons.detail.actions.copyInviteError'))
  } finally {
    inviteLoading.value = false
  }
}

function reloadLesson() {
  if (lessonId.value) {
    loadLesson(lessonId.value)
  }
}

function isOnline(userId) {
  return presenceStore.isOnline?.(String(userId)) || false
}
</script>

<style scoped>
.text-muted {
  color: rgba(7, 15, 30, 0.55);
}
.text-body {
  color: rgba(7, 15, 30, 0.9);
}
.text-danger {
  color: #d63a3a;
}
.text-accent {
  color: #4f46e5;
}
.border-border-subtle {
  border-color: rgba(7, 15, 30, 0.05);
}
.bg-surface-soft {
  background-color: rgba(7, 15, 30, 0.04);
}
.detail-block {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(7, 15, 30, 0.05);
  background: rgba(7, 15, 30, 0.02);
}
.detail-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(7, 15, 30, 0.55);
}
.detail-value {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(7, 15, 30, 0.9);
}
</style>
