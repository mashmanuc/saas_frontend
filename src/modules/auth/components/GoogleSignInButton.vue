<template>
  <div class="google-signin-wrapper">
    <!-- Б-58: вбудований браузер застосунку (Telegram…) — Google там вхід блокує;
         пояснюємо ДО натискання. Кнопку не ховаємо: хибне розпізнавання не відбере вхід. -->
    <div v-if="embedded" class="google-embedded-note" role="note" data-testid="google-embedded-note">
      <p class="google-embedded-note__text">{{ $t('auth.oauth.embedded.text') }}</p>
      <div class="google-embedded-note__actions">
        <a
          v-if="android"
          :href="chromeIntent"
          class="google-embedded-note__btn"
          data-testid="google-embedded-open-chrome"
        >{{ $t('auth.oauth.embedded.openChrome') }}</a>
        <button
          type="button"
          class="google-embedded-note__btn"
          data-testid="google-embedded-copy"
          @click="copyLink"
        >{{ copied ? $t('auth.oauth.embedded.copied') : $t('auth.oauth.embedded.copy') }}</button>
      </div>
      <label v-if="copyFailed" class="google-embedded-note__manual">
        {{ $t('auth.oauth.embedded.copyManual') }}
        <input type="text" readonly :value="pageHref" data-testid="google-embedded-address" @focus="$event.target.select()">
      </label>
    </div>

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
import { chromeIntentUrl, isAndroid, isEmbeddedBrowser } from '../utils/embeddedBrowser'

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

// Б-58: вбудований браузер застосунку — див. utils/embeddedBrowser.ts.
const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const embedded = isEmbeddedBrowser(userAgent)
const android = isAndroid(userAgent)
const pageHref = typeof window !== 'undefined' ? window.location.href : ''
const chromeIntent = pageHref ? chromeIntentUrl(pageHref) : ''
const copied = ref(false)
const copyFailed = ref(false)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(pageHref)
    copied.value = true
  } catch (err) {
    // Буфер обміну у WebView буває недоступний — показуємо адресу для ручного копіювання.
    console.warn('[GoogleSignInButton] буфер обміну недоступний:', err)
    copyFailed.value = true
  }
}

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
.google-embedded-note {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--surface-muted, #f8fafc);
}
.google-embedded-note__text {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-primary, #0f172a);
}
.google-embedded-note__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.google-embedded-note__btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #cbd5e1);
  background: var(--surface, #fff);
  color: var(--accent, #047857);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.google-embedded-note__manual {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary, #475569);
}
.google-embedded-note__manual input {
  width: 100%;
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #cbd5e1);
  font-size: 13px;
}
</style>
