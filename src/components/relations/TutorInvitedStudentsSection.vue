<template>
  <Card>
    <h2 class="text-lg font-semibold mb-4">{{ t('tutor.invitedStudents.title') }}</h2>
    
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
    <div v-else-if="invitedRequests.length === 0" class="text-center py-8">
      <EmptyStateIcon class="w-16 h-16 mx-auto mb-4 text-muted" />
      <p class="text-muted mb-4">{{ t('tutor.invitedStudents.empty') }}</p>
    </div>
    
    <!-- Список запрошених студентів -->
    <div v-else class="space-y-4">
      <div
        v-for="relation in invitedRequests"
        :key="relation.id"
        class="border rounded-lg p-4 hover:shadow-md transition"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-4 flex-1">
            <Avatar :src="relation.student.avatar_url" :name="relation.student.name" size="lg" />
            
            <div class="flex-1">
              <h3 class="font-semibold text-lg">{{ relation.student.name }}</h3>
              
              <div class="flex items-center gap-4 mt-2 text-xs text-muted">
                <span v-if="relation.created_at">
                  {{ t('tutor.invitedStudents.requestedAt') }}: {{ formatDate(relation.created_at) }}
                </span>
                <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                  {{ t('tutor.invitedStudents.status') }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="flex gap-2">
            <!-- Accept Request -->
            <Button
              variant="primary"
              size="sm"
              :loading="isAcceptingRequest"
              @click="handleAcceptRequest(relation.id)"
            >
              {{ t('tutor.invitedStudents.accept') }}
            </Button>
            
            <!-- Message Button (якщо прийнято) -->
            <Button
              v-if="relation.active_lesson_id"
              variant="outline"
              size="sm"
              @click="handleMessageClick(relation)"
            >
              {{ getMessageButtonText(relation) }}
            </Button>
          </div>
        </div>
        
        <!-- Error для конкретного request -->
        <Alert v-if="acceptRequestError" variant="error" class="mt-3 text-sm">
          {{ acceptRequestError }}
        </Alert>
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

const invitedRequests = computed(() => relationsStore.invitedRequests)
const isLoading = computed(() => relationsStore.isFetchingRelations)
const error = computed(() => relationsStore.fetchError)
const isAcceptingRequest = computed(() => relationsStore.isAcceptingRequest)
const acceptRequestError = computed(() => relationsStore.acceptRequestError)

function retry() {
  relationsStore.fetchRelations()
}

async function handleAcceptRequest(relationId: string) {
  try {
    await relationsStore.acceptRequest(relationId)
  } catch (err) {
    // Error handled by store
  }
}

function handleMessageClick(relation: Relation) {
  const action = getMessageAction(relation)
  router.push(action.to)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA')
}
</script>
