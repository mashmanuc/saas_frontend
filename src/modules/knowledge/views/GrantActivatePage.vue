<!--
  GrantActivatePage — /grant/:code — активація коду передачі паку уроків.
  Покупець-тьютор бачить превʼю паку → «Отримати» → fork-копії у «Моїх уроках».
  Не-тьютору — чесний екран. 404 (revoked/expired/вичерпано/нема) — теж чесний екран.
  BE: knowledge/grants/preview|activate · ТЗ: LESSON_GRANT_TZ_2026-07-14.md
-->
<template>
  <div class="grant-page">
    <div class="grant-page__card">
      <!-- не тьютор -->
      <template v-if="!isTutor">
        <div class="grant-page__icon">🎁</div>
        <h1 class="grant-page__title">{{ $t('knowledge.grants.pageTitle') }}</h1>
        <p class="grant-page__muted">{{ $t('knowledge.grants.tutorsOnly') }}</p>
      </template>

      <!-- завантаження -->
      <template v-else-if="loading">
        <p class="grant-page__muted">{{ $t('common.loading') }}</p>
      </template>

      <!-- код недоступний -->
      <template v-else-if="notFound">
        <div class="grant-page__icon">🚫</div>
        <h1 class="grant-page__title">{{ $t('knowledge.grants.unavailableTitle') }}</h1>
        <p class="grant-page__muted">{{ $t('knowledge.grants.unavailableHint') }}</p>
      </template>

      <!-- успіх активації -->
      <template v-else-if="activatedNow">
        <div class="grant-page__icon">✅</div>
        <h1 class="grant-page__title">{{ $t('knowledge.grants.successTitle') }}</h1>
        <p class="grant-page__muted">
          {{ $t('knowledge.grants.successHint', { n: resultLessons.length }) }}
        </p>
        <router-link class="grant-page__primary" :to="{ name: 'MyLessons' }">
          {{ $t('knowledge.grants.goToMyLessons') }}
        </router-link>
      </template>

      <!-- превʼю паку -->
      <template v-else-if="preview">
        <div class="grant-page__icon">🎁</div>
        <h1 class="grant-page__title">{{ $t('knowledge.grants.previewTitle') }}</h1>
        <p class="grant-page__seller">
          {{ $t('knowledge.grants.fromSeller', { name: preview.seller_name }) }}
        </p>

        <ul class="grant-page__lessons">
          <li v-for="l in preview.lessons" :key="l.id" class="grant-page__lesson">
            <span class="grant-page__lesson-title">{{ l.title }}</span>
            <span class="grant-page__lesson-tag">{{ l.subject_tag }}</span>
          </li>
        </ul>

        <p v-if="preview.already_activated" class="grant-page__muted">
          {{ $t('knowledge.grants.alreadyActivated') }}
        </p>
        <p v-if="error" class="grant-page__error">{{ error }}</p>

        <router-link
          v-if="preview.already_activated"
          class="grant-page__primary"
          :to="{ name: 'MyLessons' }"
        >
          {{ $t('knowledge.grants.goToMyLessons') }}
        </router-link>
        <button
          v-else
          type="button"
          class="grant-page__primary grant-page__primary--btn"
          :disabled="activating"
          @click="onActivate"
        >
          {{ activating ? $t('common.loading') : $t('knowledge.grants.activateBtn', { n: preview.lessons_count }) }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/authStore'
import { grantsApi, type GrantLessonBrief, type GrantPreview } from '../api/grantsApi'

const route = useRoute()
const auth = useAuthStore()
const { t } = useI18n()

const code = computed(() => String(route.params.code ?? ''))
const isTutor = computed(() => auth.user?.role === 'tutor' || auth.user?.role === 'admin' || auth.user?.role === 'superadmin')

const loading = ref(true)
const notFound = ref(false)
const preview = ref<GrantPreview | null>(null)
const activating = ref(false)
const activatedNow = ref(false)
const resultLessons = ref<GrantLessonBrief[]>([])
const error = ref('')

onMounted(async () => {
  if (!isTutor.value) { loading.value = false; return }
  try {
    preview.value = await grantsApi.preview(code.value)
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
})

async function onActivate() {
  if (activating.value) return
  activating.value = true
  error.value = ''
  try {
    const res = await grantsApi.activate(code.value)
    resultLessons.value = res.lessons
    activatedNow.value = true
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { detail?: string } } }
    if (err?.response?.status === 404) notFound.value = true
    else error.value = err?.response?.data?.detail || t('knowledge.grants.activateError')
  } finally {
    activating.value = false
  }
}
</script>

<style scoped>
.grant-page {
  min-height: 70vh;
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.grant-page__card {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
  padding: 32px 36px; width: 520px; max-width: 100%;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08); text-align: center;
}
.grant-page__icon { font-size: 40px; margin-bottom: 8px; }
.grant-page__title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
.grant-page__seller { font-size: 13px; color: #64748b; margin-bottom: 14px; }
.grant-page__muted { font-size: 14px; color: #64748b; margin: 8px 0; }
.grant-page__error { font-size: 13px; color: #dc2626; margin: 8px 0; }
.grant-page__lessons {
  list-style: none; margin: 0 0 16px; padding: 0;
  max-height: 300px; overflow-y: auto; text-align: left;
}
.grant-page__lesson {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 12px; border: 1px solid #f1f5f9; border-radius: 9px; margin-bottom: 6px;
}
.grant-page__lesson-title { font-size: 14px; font-weight: 500; color: #0f172a; }
.grant-page__lesson-tag { font-size: 11px; color: #94a3b8; flex-shrink: 0; }
.grant-page__primary {
  display: inline-block; padding: 11px 22px; border-radius: 10px;
  background: #047857; color: #fff; font-weight: 600; font-size: 14px;
  text-decoration: none; border: none; cursor: pointer;
}
.grant-page__primary--btn:disabled { background: #94a3b8; cursor: not-allowed; }
</style>
