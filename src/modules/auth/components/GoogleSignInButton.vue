<template>
  <div class="google-signin-wrapper">
    <!-- GIS рендерить кнопку у цей div через renderButton(). -->
    <div ref="btnRef" data-testid="google-signin-button" />

    <!-- Fallback message якщо GIS не завантажився -->
    <p
      v-if="loadError"
      class="text-sm mt-2"
      style="color: var(--danger, #d92d20);"
      data-testid="google-signin-error"
    >
      {{ $t('auth.oauth.error.scriptFailed') }}
      <button
        type="button"
        class="ml-2 underline"
        @click="retry"
      >
        {{ $t('auth.oauth.retry') }}
      </button>
    </p>

    <!-- Loading state -->
    <p
      v-else-if="loading"
      class="text-sm mt-2"
      style="color: var(--text-secondary);"
    >
      {{ $t('auth.oauth.loading') }}
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../store/authStore'
import { loadGIS } from '../utils/gisLoader'

const props = defineProps({
  // 'signin' | 'signup' — впливає на текст кнопки ("Sign in with Google" / "Sign up with Google")
  mode: {
    type: String,
    default: 'signin',
    validator: (v) => ['signin', 'signup'].includes(v),
  },
})

const emit = defineEmits(['success', 'error'])

const auth = useAuthStore()
const { locale } = useI18n()

const btnRef = ref(null)
const loading = ref(true)
const loadError = ref(false)

const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''

async function handleCredential(response) {
  if (!response?.credential) {
    emit('error', new Error('no_credential_in_response'))
    return
  }
  try {
    const result = await auth.loginWithGoogle(response.credential)
    emit('success', result)
  } catch (err) {
    emit('error', err)
  }
}

async function initButton() {
  loading.value = true
  loadError.value = false

  if (!clientId) {
    // Без Client ID кнопка беззмістовна. Показуємо error замість мовчазної відсутності.
    console.warn('[GoogleSignInButton] VITE_GOOGLE_OAUTH_CLIENT_ID не сконфігуровано')
    loadError.value = true
    loading.value = false
    return
  }

  try {
    const gis = await loadGIS()
    gis.initialize({
      client_id: clientId,
      callback: handleCredential,
      // Auto-select / one-tap опціонально (поки skip — uniform UX)
      auto_select: false,
      cancel_on_tap_outside: true,
    })
    if (btnRef.value) {
      gis.renderButton(btnRef.value, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: props.mode === 'signup' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        // Locale: 'uk' / 'en' тощо
        locale: locale.value === 'uk' ? 'uk' : 'en',
      })
    }
    loading.value = false
  } catch (err) {
    console.warn('[GoogleSignInButton] GIS load failed:', err)
    loadError.value = true
    loading.value = false
  }
}

function retry() {
  initButton()
}

onMounted(() => {
  initButton()
})
</script>

<style scoped>
.google-signin-wrapper {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 44px;
}
</style>
