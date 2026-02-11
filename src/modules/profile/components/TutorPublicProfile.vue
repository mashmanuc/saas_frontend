<template>
  <div class="space-y-6">
    <Card class="space-y-6">
      <div class="flex flex-col items-center gap-4 md:flex-row md:items-start">
        <div class="relative">
          <img
            v-if="user.avatar_url"
            :src="user.avatar_url"
            :alt="fullName"
            class="h-32 w-32 rounded-full object-cover"
          />
          <div
            v-else
            class="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 text-3xl font-semibold text-primary"
          >
            {{ initials }}
          </div>
        </div>

        <div class="flex-1 text-center md:text-left">
          <h1 class="text-2xl font-bold text-foreground">
            {{ fullName }}
          </h1>
          <p v-if="profile.headline" class="mt-1 text-lg text-muted-foreground">
            {{ profile.headline }}
          </p>
          <div class="mt-3 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <div v-if="profile.experience" class="flex items-center gap-1 text-sm text-muted-foreground">
              <span>{{ $t('users.profile.experienceYears', { years: profile.experience }) }}</span>
            </div>
            <div v-if="profile.hourly_rate" class="flex items-center gap-1 text-sm font-medium text-foreground">
              <span>{{ profile.hourly_rate }} {{ profile.currency || 'UAH' }}/{{ $t('users.profile.hour') }}</span>
            </div>
            <div v-if="rating" class="flex items-center gap-1 text-sm text-foreground">
              <span class="text-yellow-500">★</span>
              <span>{{ rating.toFixed(1) }}</span>
              <span class="text-muted-foreground">({{ reviewsCount }})</span>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <Button
            variant="primary"
            @click="$emit('contact')"
          >
            {{ $t('users.profile.contactTutor') }}
          </Button>
          <Button
            variant="outline"
            @click="handleShare"
          >
            {{ $t('users.profile.share') }}
          </Button>
        </div>
      </div>
    </Card>

    <Card v-if="profile.bio" class="space-y-3">
      <h2 class="text-lg font-semibold text-foreground">
        {{ $t('users.profile.about') }}
      </h2>
      <p class="whitespace-pre-wrap text-muted-foreground">
        {{ profile.bio }}
      </p>
    </Card>

    <Card v-if="profile.subjects && profile.subjects.length > 0" class="space-y-3">
      <h2 class="text-lg font-semibold text-foreground">
        {{ $t('users.profile.subjects') }}
      </h2>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="subject in profile.subjects"
          :key="subject"
          class="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
        >
          {{ subject }}
        </span>
      </div>
    </Card>

    <Card v-if="profile.certifications && profile.certifications.length > 0" class="space-y-3">
      <h2 class="text-lg font-semibold text-foreground">
        {{ $t('users.profile.certifications') }}
      </h2>
      <div class="space-y-2">
        <div
          v-for="cert in profile.certifications"
          :key="cert.id"
          class="flex items-start gap-3 rounded-lg border border-border p-3"
        >
          <div class="flex-1">
            <p class="font-medium text-foreground">{{ cert.title }}</p>
            <p v-if="cert.issuer" class="text-sm text-muted-foreground">{{ cert.issuer }}</p>
            <p v-if="cert.year" class="text-xs text-muted-foreground">{{ cert.year }}</p>
          </div>
        </div>
      </div>
    </Card>

    <slot name="reviews" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import type { TutorProfile, UserProfile } from '@/api/users'

const props = defineProps<{
  profile: TutorProfile
  user: UserProfile
  rating?: number
  reviewsCount?: number
}>()

const emit = defineEmits<{
  'contact': []
  'share': []
}>()

const fullName = computed(() => {
  // P0.1: Use display_name from API - no local name construction
  return props.user.display_name || props.user.full_name || props.user.email
})

const initials = computed(() => {
  const name = fullName.value
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

function handleShare() {
  const url = window.location.href
  if (navigator.share) {
    navigator.share({
      title: fullName.value,
      text: props.profile.headline || '',
      url: url
    }).catch(() => {
      copyToClipboard(url)
    })
  } else {
    copyToClipboard(url)
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    emit('share')
  })
}
</script>
