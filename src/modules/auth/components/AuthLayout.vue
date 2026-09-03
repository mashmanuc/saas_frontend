<template>
  <main class="auth-shell" :aria-label="$t('auth.layout.ariaLabel')">
    <aside class="auth-banner" aria-labelledby="auth-banner-title">
      <div class="auth-banner-grid" aria-hidden="true" />

      <div class="auth-banner-content">
        <div class="auth-brand auth-brand--inverse">
          <span class="auth-brand-mark" aria-hidden="true">M4</span>
          <span>M4SH</span>
        </div>

        <div class="auth-banner-copy">
          <p class="auth-banner-kicker">{{ $t('auth.layout.bannerKicker') }}</p>
          <h2 id="auth-banner-title">{{ $t('auth.layout.bannerTitle') }}</h2>
          <p>{{ $t('auth.layout.bannerDescription') }}</p>
        </div>

        <div v-if="showLandingAnimation" class="auth-banner-animation" aria-hidden="true">
          <LandingTrigCircle v-if="!prefersReducedMotion" />
          <div v-else class="auth-banner-static" aria-hidden="true">
            <span class="auth-banner-static-axis auth-banner-static-axis--x" />
            <span class="auth-banner-static-axis auth-banner-static-axis--y" />
            <span class="auth-banner-static-curve" />
            <span class="auth-banner-static-point" />
          </div>
        </div>

        <ul class="auth-banner-points">
          <li v-for="(point, index) in bannerPoints" :key="point">
            <span>0{{ index + 1 }}</span>
            {{ point }}
          </li>
        </ul>
      </div>
    </aside>

    <section class="auth-form-side" :aria-label="$t('auth.layout.formLabel')">
      <div class="auth-form-wrap">
        <div class="auth-brand auth-brand--mobile">
          <span class="auth-brand-mark" aria-hidden="true">M4</span>
          <span>M4SH</span>
        </div>

        <p v-if="cameFromWorkspace" class="auth-return-context">
          {{ $t('auth.layout.workspaceDescription') }}
        </p>

        <router-view />
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LandingTrigCircle from '@/views/LandingTrigCircle.vue'

const route = useRoute()
const { t } = useI18n()
const showLandingAnimation = ref(false)
const prefersReducedMotion = ref(false)
let desktopMediaQuery
let reducedMotionMediaQuery

const cameFromWorkspace = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/workspace')
})

const bannerPoints = computed(() => [
  t('auth.layout.bannerPointOne'),
  t('auth.layout.bannerPointTwo'),
  t('auth.layout.bannerPointThree'),
])

function syncLandingAnimation() {
  showLandingAnimation.value = Boolean(desktopMediaQuery?.matches)
}

function syncReducedMotion() {
  prefersReducedMotion.value = Boolean(reducedMotionMediaQuery?.matches)
}

onMounted(() => {
  desktopMediaQuery = window.matchMedia('(min-width: 1024px)')
  reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncLandingAnimation()
  syncReducedMotion()
  desktopMediaQuery.addEventListener('change', syncLandingAnimation)
  reducedMotionMediaQuery.addEventListener('change', syncReducedMotion)
})

onUnmounted(() => {
  desktopMediaQuery?.removeEventListener('change', syncLandingAnimation)
  reducedMotionMediaQuery?.removeEventListener('change', syncReducedMotion)
})
</script>

<style scoped>
.auth-shell {
  display: grid;
  min-height: 100dvh;
  grid-template-columns: minmax(0, 1.05fr) minmax(460px, 1fr);
  background: var(--bg-primary);
}

.auth-banner {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  background: #0c1728;
  color: #effcf7;
}

.auth-banner::after {
  position: absolute;
  inset: 0;
  background: radial-gradient(100% 82% at 5% 0%, transparent 42%, rgb(0 0 0 / 43%) 100%);
  content: '';
  pointer-events: none;
}

.auth-banner-grid {
  position: absolute;
  inset: 0;
  opacity: 0.38;
  background-image:
    linear-gradient(rgb(232 255 245 / 8%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(232 255 245 / 8%) 1px, transparent 1px);
  background-size: 44px 44px;
}

.auth-banner-content {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  padding: clamp(42px, 5vw, 64px) clamp(38px, 5vw, 72px) 42px;
}

.auth-brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  width: fit-content;
  color: var(--text-primary);
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.auth-brand-mark {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--accent);
  border-radius: 7px;
  color: var(--accent);
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: -0.09em;
}

.auth-brand--inverse {
  color: #f3fff9;
}

.auth-brand--inverse .auth-brand-mark {
  border-color: #28d66d;
  color: #28d66d;
}

.auth-banner-copy {
  width: min(34ch, 100%);
  margin-top: clamp(68px, 10vh, 150px);
}

.auth-banner-kicker {
  margin: 0 0 17px;
  color: #2ce278;
  font-size: 0.67rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.auth-banner h2 {
  margin: 0;
  color: #f7fffb;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(2.75rem, 4.1vw, 4.25rem);
  font-weight: 400;
  letter-spacing: -0.045em;
  line-height: 1.02;
}

.auth-banner-copy > p:last-child {
  margin: 22px 0 0;
  color: rgb(230 255 245 / 72%);
  font-size: 0.98rem;
  line-height: 1.7;
}

.auth-banner-animation {
  width: min(640px, 100%);
  margin: 34px auto 0;
  opacity: 0.96;
}

.auth-banner-animation :deep(.ltc-wrap) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.auth-banner-static {
  position: relative;
  height: 210px;
  overflow: hidden;
}

.auth-banner-static-axis,
.auth-banner-static-curve,
.auth-banner-static-point {
  position: absolute;
  display: block;
}

.auth-banner-static-axis {
  background: rgb(232 255 245 / 46%);
}

.auth-banner-static-axis--x {
  right: 7%;
  bottom: 26px;
  left: 7%;
  height: 2px;
}

.auth-banner-static-axis--y {
  top: 10px;
  bottom: 12%;
  left: 21%;
  width: 2px;
}

.auth-banner-static-curve {
  bottom: 28px;
  left: 22%;
  width: 54%;
  height: 126px;
  border: 4px solid #2ce278;
  border-top: 0;
  border-radius: 0 0 50% 50%;
  transform: rotate(180deg);
}

.auth-banner-static-point {
  bottom: 20px;
  left: calc(49% - 7px);
  width: 14px;
  height: 14px;
  border: 3px solid #2ce278;
  border-radius: 50%;
  box-shadow: 0 0 0 7px rgb(44 226 120 / 13%);
}

.auth-banner-points {
  display: grid;
  gap: 12px;
  margin: auto 0 0;
  padding: 25px 0 0;
  border-top: 1px solid rgb(237 255 248 / 17%);
  list-style: none;
}

.auth-banner-points li {
  display: flex;
  gap: 14px;
  color: rgb(237 255 248 / 76%);
  font-size: 0.82rem;
  line-height: 1.4;
}

.auth-banner-points span {
  min-width: 2ch;
  color: #2ce278;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.auth-form-side {
  display: grid;
  min-width: 0;
  place-items: center;
  padding: 42px clamp(34px, 6vw, 88px);
  background:
    radial-gradient(circle at 94% 8%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 24rem),
    var(--bg-primary);
}

.auth-form-wrap {
  width: min(100%, 440px);
}

.auth-form-wrap :deep(.card) {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.auth-return-context {
  margin: 0 0 24px;
  padding: 12px 14px;
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}

.auth-brand--mobile {
  display: none;
}

@media (max-width: 1023px) {
  .auth-shell {
    display: block;
  }

  .auth-banner {
    display: none;
  }

  .auth-form-side {
    min-height: 100dvh;
    padding: 28px 20px 36px;
  }

  .auth-brand--mobile {
    display: inline-flex;
    margin: 0 0 48px;
  }
}

@media (min-width: 1024px) and (max-height: 920px) {
  .auth-banner-content {
    padding-top: 34px;
    padding-bottom: 28px;
  }

  .auth-banner-copy {
    margin-top: 52px;
  }

  .auth-banner-copy > p:last-child {
    margin-top: 16px;
    line-height: 1.55;
  }

  .auth-banner-animation {
    width: min(510px, 92%);
    margin-top: 20px;
  }

  .auth-banner-points {
    gap: 8px;
    padding-top: 16px;
  }
}

@media (max-width: 480px) {
  .auth-form-side {
    padding: 24px 16px 32px;
  }

  .auth-brand--mobile {
    margin-bottom: 36px;
  }
}

</style>
