<template>
  <Card>
    <h2 class="text-lg font-semibold mb-4">{{ t('student.myTutors.title') }}</h2>
    
    <!-- Loading state -->
    <div v-if="isLoading" class="text-center py-8">
      <Spinner />
      <p class="mt-2 text-muted">{{ t('loader.loading') }}</p>
    </div>
    
    <!-- Error state -->
    <Alert v-else-if="error" variant="error" class="mb-4">
      {{ error }}
      <Button variant="ghost" size="sm" @click="retry" class="ml-2">
        {{ t('common.retry') }}
      </Button>
    </Alert>
    
    <!-- Empty state -->
    <div v-else-if="activeTutors.length === 0" class="text-center py-8">
      <EmptyStateIcon class="w-16 h-16 mx-auto mb-4 text-muted" />
      <p class="text-muted mb-4">{{ t('student.myTutors.empty') }}</p>
      <Button @click="goToMarketplace" variant="primary">
        {{ t('student.myTutors.findTutor') }}
      </Button>
    </div>
    
    <!-- Список тьюторів -->
    <div v-else class="space-y-4">
      <div
        v-for="relation in activeTutors"
        :key="relation.id"
        class="border rounded-lg p-4 hover:shadow-md transition"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-4 flex-1">
            <Avatar :src="relation.tutor.avatar_url" :name="relation.tutor.name" size="lg" />
            
            <div class="flex-1">
              <h3 class="font-semibold text-lg">{{ relation.tutor.name }}</h3>
              <p class="text-sm text-muted">
                {{ relation.tutor.subjects.map(s => s.label).join(', ') }}
              </p>
              
              <div class="flex items-center gap-4 mt-2 text-xs text-muted">
                <span v-if="relation.last_activity_at">
                  {{ t('student.myTutors.lastActivity') }}: {{ formatDate(relation.last_activity_at) }}
                </span>
                <span>
                  {{ t('student.myTutors.lessonsCount') }}: {{ relation.lesson_count }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="flex gap-2">
            <!-- Smart Message Button -->
            <Button
              variant="outline"
              size="sm"
              @click="handleMessageClick(relation)"
            >
              {{ getMessageButtonText(relation) }}
            </Button>
            
            <Button
              variant="primary"
              size="sm"
              @click="bookLesson(relation.tutor.id)"
            >
              {{ t('common.bookLesson') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useRelationsStore } from '@/stores/relationsStore'
import { getMessageAction, getMessageButtonText } from '@/utils/relationsUi'
import type { Relation } from '@/types/relations'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Alert from '@/components/ui/Alert.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Spinner from '@/components/ui/Spinner.vue'
import EmptyStateIcon from '@/components/ui/icons/EmptyStateIcon.vue'

const router = useRouter()
const { t } = useI18n()
const relationsStore = useRelationsStore()

const activeTutors = computed(() => relationsStore.activeTutors)
const isLoading = computed(() => relationsStore.isFetchingRelations)
const error = computed(() => relationsStore.fetchError)

function retry() {
  relationsStore.fetchRelations()
}

function goToMarketplace() {
  router.push({ name: 'marketplace' })
}

function handleMessageClick(relation: Relation) {
  const action = getMessageAction(relation)
  router.push(action.to)
}

function bookLesson(tutorId: string) {
  router.push({ name: 'booking', query: { tutor: tutorId } })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return t('common.never')
  return new Date(dateStr).toLocaleDateString('uk-UA')
}
</script>
