<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <Heading :level="1">
        {{ $t('menu.studentDashboard') }}
      </Heading>
      <p class="text-muted text-sm">
        {{ $t('student.dashboard.subtitle') }}
      </p>
    </Card>

    <Card class="space-y-4">
      <Heading :level="2">
        {{ sectionTitle }}
      </Heading>

      <div v-if="relationsLoading" class="text-sm text-muted">
        {{ $t('loader.loading') }}
      </div>

      <p v-else-if="relationsError" class="text-sm text-danger">
        {{ relationsError }}
      </p>

      <template v-else>
        <div
          v-if="stateInfo"
          class="rounded-2xl border border-dashed border-default bg-surface-soft p-4 space-y-1"
        >
          <p class="text-sm font-semibold text-body">
            {{ stateInfo.title }}
          </p>
          <p class="text-sm text-muted">
            {{ stateInfo.description }}
          </p>
        </div>

        <section v-if="hasActiveRelation" class="space-y-4">
          <div
            v-for="relation in activeRelations"
            :key="relation.relation_id"
            class="rounded-2xl border border-default bg-card p-4 flex flex-col gap-4 md:flex-row md:items-center"
          >
            <div class="flex items-start gap-4 flex-1">
              <div
                class="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-lg font-semibold text-accent shadow-theme"
              >
                {{ getTutorInitials(relation.tutor) }}
              </div>
              <div class="space-y-1">
                <p class="font-semibold text-base text-body">
                  {{ relation.tutor?.full_name || relation.tutor?.email }}
                </p>
                <p class="text-sm text-muted" v-if="relation.tutor?.email">
                  {{ relation.tutor.email }}
                </p>
                <p class="text-xs text-muted" v-if="relation.tutor?.timezone">
                  {{ $t('dashboard.tutor.timezoneLabel') }}
                  <span class="font-medium">{{ relation.tutor.timezone }}</span>
                </p>
                <p class="text-sm text-muted" v-if="relation.tutor?.subjects?.length">
                  {{ relation.tutor.subjects.join(', ') }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-3 w-full md:w-auto">
              <Button variant="secondary" size="sm" class="flex-1 md:flex-none" @click="goToChat">
                {{ $t('student.actions.messageTutor') }}
              </Button>
              <Button variant="primary" size="sm" class="flex-1 md:flex-none" @click="goToLessons">
                {{ $t('student.actions.bookLesson') }}
              </Button>
            </div>
          </div>

          <div class="bg-surface-soft rounded-2xl border border-dashed border-default p-4 space-y-3">
            <p class="font-medium text-body">
              {{ $t('student.upcomingLessons.title') }}
            </p>
            <div v-if="dashboardStore.isLoading" class="text-sm text-muted">
              {{ $t('loader.loading') }}
            </div>
            <div v-else-if="dashboardStore.upcomingLessons.length > 0" class="space-y-2">
              <UpcomingLessonCard
                v-for="lesson in dashboardStore.upcomingLessons"
                :key="lesson.id"
                :lesson="lesson"
                :is-tutor="false"
              />
            </div>
            <p v-else class="text-sm text-muted">
              {{ $t('student.upcomingLessons.placeholder') }}
            </p>
            <router-link to="/bookings" class="text-sm text-accent hover:underline">
              {{ $t('student.actions.viewAllLessons') }}
            </router-link>
          </div>
        </section>

        <section v-else-if="hasInvitedRelation" class="space-y-4">
          <div
            v-for="relation in invitedRelations"
            :key="relation.relation_id"
            class="rounded-2xl border border-accent/40 bg-card p-4 flex flex-col gap-4 md:flex-row md:items-center"
          >
            <div class="flex items-start gap-4 flex-1">
              <div
                class="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-base font-semibold text-accent shadow-theme"
              >
                {{ getTutorInitials(relation.tutor) }}
              </div>
              <div class="space-y-1">
                <p class="font-semibold text-base text-body">
                  {{ relation.tutor?.full_name || relation.tutor?.email }}
                </p>
                <p class="text-sm text-muted">
                  {{ $t('student.invited.description') }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-3 w-full md:w-auto">
              <Button
                variant="primary"
                size="sm"
                :disabled="actionLoadingId === getRelationId(relation)"
                :loading="actionLoadingId === getRelationId(relation)"
                @click="handleAccept(getRelationId(relation))"
              >
                {{ $t('common.accept') }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="actionLoadingId === getRelationId(relation)"
                @click="handleDecline(getRelationId(relation))"
              >
                {{ $t('common.decline') }}
              </Button>
            </div>
          </div>
        </section>

        <section v-else class="space-y-4">
          <p class="text-sm text-muted">
            {{ $t('student.noTutor.description') }}
          </p>
          <div class="flex flex-wrap gap-3">
            <Button variant="primary" size="sm" @click="goToMarketplace">
              {{ $t('student.actions.chooseTutor') }}
            </Button>
            <Button variant="ghost" size="sm" @click="goToMarketplace">
              {{ $t('student.actions.exploreMarketplace') }}
            </Button>
          </div>
          <TutorSearchView />
        </section>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import { useRelationsStore } from '../../../stores/relationsStore'
import { useDashboardStore } from '../store/dashboardStore'
import TutorSearchView from '../../tutor/views/TutorSearchView.vue'
import UpcomingLessonCard from '../components/UpcomingLessonCard.vue'
import { notifyError, notifySuccess } from '../../../utils/notify'

const router = useRouter()
const { t } = useI18n()
const relationsStore = useRelationsStore()
const dashboardStore = useDashboardStore()

const relationsLoading = computed(() => relationsStore.studentLoading)
const relationsError = computed(() => relationsStore.studentError)
const invitedRelations = computed(() => relationsStore.invitedStudentRelations)
const activeRelations = computed(() => relationsStore.activeStudentRelations)

const hasActiveRelation = computed(() => activeRelations.value.length > 0)
const hasInvitedRelation = computed(() => invitedRelations.value.length > 0)

const stateInfo = computed(() => {
  if (hasActiveRelation.value) {
    return {
      title: t('student.stateHints.active.title'),
      description: t('student.stateHints.active.description'),
    }
  }

  if (hasInvitedRelation.value) {
    return {
      title: t('student.stateHints.invited.title'),
      description: t('student.stateHints.invited.description'),
    }
  }

  return null
})

const sectionTitle = computed(() => {
  if (relationsLoading.value) return t('loader.loading')
  if (hasActiveRelation.value) return t('student.withTutor')
  if (hasInvitedRelation.value) return t('student.invited.header')
  return t('student.withoutTutor')
})

const actionLoadingId = ref(null)

function goToMarketplace() {
  router.push('/marketplace').catch(() => {})
}

function goToLessons() {
  router.push('/lessons').catch(() => {})
}

function goToChat() {
  router.push('/chat').catch(() => {})
}

function getTutorInitials(tutor) {
  if (!tutor) return 'T'
  const first = tutor.first_name?.[0] ?? ''
  const last = tutor.last_name?.[0] ?? ''
  return (first + last || tutor.email?.[0] || 'T').toUpperCase()
}

/**
 * Get relation ID with fallback (API may return 'id' or 'relation_id')
 */
function getRelationId(relation) {
  return relation?.id ?? relation?.relation_id
}

async function handleAccept(id) {
  actionLoadingId.value = id
  try {
    await relationsStore.acceptRelation(id)
    notifySuccess(t('student.notifications.acceptSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('student.notifications.acceptError'))
  } finally {
    actionLoadingId.value = null
  }
}

async function handleDecline(id) {
  actionLoadingId.value = id
  try {
    await relationsStore.declineRelation(id)
    notifySuccess(t('student.notifications.declineSuccess'))
  } catch (error) {
    notifyError(error?.response?.data?.detail || t('student.notifications.declineError'))
  } finally {
    actionLoadingId.value = null
  }
}

onMounted(() => {
  relationsStore.fetchStudentRelations().catch(() => {})
  dashboardStore.fetchStudentDashboard().catch(() => {})
})
</script>
