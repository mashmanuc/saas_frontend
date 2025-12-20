<template>
  <div class="space-y-6">
    <Card class="space-y-2">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading :level="1">{{ $t('userProfile.account.title') }}</Heading>
          <p class="text-sm text-muted-foreground">{{ $t('userProfile.account.subtitle') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="goToChangeEmail">
            {{ $t('userProfile.account.changeEmail') }}
          </Button>
          <Button variant="outline" size="sm" @click="goToChangePassword">
            {{ $t('userProfile.account.changePassword') }}
          </Button>
        </div>
      </div>
    </Card>

    <Card v-if="me.error" class="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {{ me.error }}
    </Card>

    <Card class="space-y-6">
      <div class="flex flex-col gap-6 lg:flex-row">
        <div class="flex flex-1 flex-col items-center justify-center gap-4">
          <AvatarUpload
            :image-url="me.avatarUrl"
            :fallback-name="me.fullName || me.user?.email || '?'"
            :disabled="me.loading || me.saving"
            @upload="(file) => me.uploadAvatar(file)"
            @delete="() => me.deleteAvatar()"
          />
        </div>

        <div class="flex-[2] space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input :label="$t('userProfile.account.firstName')" v-model="form.first_name" :disabled="me.saving" />
            <Input :label="$t('userProfile.account.lastName')" v-model="form.last_name" :disabled="me.saving" />
          </div>

          <Input :label="$t('userProfile.account.username')" v-model="form.username" :disabled="me.saving" />

          <Input :label="$t('userProfile.account.timezone')" v-model="form.timezone" :disabled="me.saving" />

          <Button variant="primary" :loading="me.saving" :disabled="me.saving" @click="save">
            {{ $t('userProfile.account.save') }}
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import { onMounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from '../../../ui/Button.vue'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import Input from '../../../ui/Input.vue'
import AvatarUpload from '../components/AvatarUpload.vue'
import { useMeStore } from '../store/meStore'

const router = useRouter()
const me = useMeStore()

const form = reactive({
  first_name: '',
  last_name: '',
  username: '',
  timezone: 'Europe/Kyiv',
})

watch(
  () => me.user,
  (user) => {
    if (!user) return
    form.first_name = user.first_name || ''
    form.last_name = user.last_name || ''
    form.username = user.username || ''
    form.timezone = user.timezone || 'Europe/Kyiv'
  },
  { immediate: true },
)

async function save() {
  await me.save({
    first_name: form.first_name,
    last_name: form.last_name,
    username: form.username,
    timezone: form.timezone,
  })
}

function goToChangeEmail() {
  router.push({ name: 'change-email' })
}

function goToChangePassword() {
  router.push({ name: 'change-password' })
}

onMounted(() => {
  if (!me.user && !me.loading) {
    me.load().catch(() => {})
  }
})
</script>
