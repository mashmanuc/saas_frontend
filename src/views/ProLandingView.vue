<!--
  Phase 3 — мінімальна міжнародна продажна поверхня (/pro).
  ТЗ: saas_docs/domains/billing/Gogo/WINTERBOARD_REPLAY_LAUNCH_PHASES.md §PHASE 3.

  Дві причини існування сторінки:
  1) іноземець має зрозуміти, що продається, кому і за скільки, і купити;
  2) Paddle як Merchant of Record ПЕРЕВІРЯЄ сайт продавця перед тим, як
     увімкнути live-платежі: потрібна публічна сторінка продукту з ціною та
     посиланнями на Terms / Privacy / Refund. Без неї live-акаунта немає.

  ⚠️ Текст СВІДОМО англійською в коді, а не через i18n. Це не недогляд:
  сторінка адресована одному ринку, її мова — частина її призначення (як
  українська оферта є українською). Виносити 40 рядків у три локалі означало б
  тримати переклади, яких ніхто не читатиме. Не «виправляти» на i18n.
-->
<template>
  <div class="pro">
    <header class="pro-nav">
      <a class="pro-logo" href="/start">M4SH</a>
      <a class="pro-nav-login" href="/auth/login">Sign in</a>
    </header>

    <main>
      <section class="pro-hero">
        <p class="pro-eyebrow">Interactive whiteboard + full lesson replay</p>
        <h1 class="pro-title">The lesson that doesn&rsquo;t disappear</h1>
        <p class="pro-lede">
          Teach on a live interactive board, and let every lesson save itself &mdash;
          stroke by stroke. Your students reopen the exact lesson later, not a video of it.
        </p>
        <div class="pro-cta-row">
          <button type="button" class="pro-cta" data-testid="pro-cta-top" @click="goToCheckout">
            {{ ctaLabel }}
          </button>
          <!-- Демо-дошка `/workspace` — публічна, без реєстрації. `?lang=en`
               перекриває мову на час перегляду (applyLocaleOverride, без
               запису в localStorage). Звичайний <a>, а не router-push:
               повне перезавантаження дає демо чистий стан, і працює
               «відкрити в новій вкладці» середнім кліком. -->
          <a class="pro-cta-secondary" href="/workspace?lang=en" data-testid="pro-try-board">
            Try the board
          </a>
        </div>
        <p class="pro-cta-note">
          $19.99 / month &middot; cancel anytime. The demo board opens right away &mdash;
          no sign-up, nothing to install.
        </p>
      </section>

      <section class="pro-block">
        <h2 class="pro-h2">Who it&rsquo;s for</h2>
        <p class="pro-text">
          Online tutors and school teachers who run their own lessons and invite their
          own students. There is no marketplace and no commission on your teaching &mdash;
          you bring your students, we give you the room.
        </p>
      </section>

      <section class="pro-block">
        <h2 class="pro-h2">What you get</h2>
        <ul class="pro-list">
          <li v-for="item in features" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="pro-price" aria-labelledby="pro-price-title">
        <h2 id="pro-price-title" class="pro-h2">Pro</h2>
        <p class="pro-amount"><strong>$19.99</strong> <span>/ month</span></p>
        <p class="pro-text">
          Billed monthly in US dollars. Cancel at any time &mdash; access continues to the
          end of the period you already paid for.
        </p>
        <button type="button" class="pro-cta" data-testid="pro-cta-price" @click="goToCheckout">
          {{ ctaLabel }}
        </button>
        <p class="pro-fine">
          Orders are processed by our reseller and Merchant of Record, Paddle.com,
          which also handles order-related enquiries, taxes and returns.
        </p>
      </section>

      <section class="pro-block">
        <h2 class="pro-h2">Cancellation and refunds</h2>
        <p class="pro-text">
          You can cancel your subscription yourself at any time from
          <em>Billing</em> in your account &mdash; no email required. Cancellation stops the
          next payment; your access stays until the end of the paid period.
          Refunds are available within 30 days of your first payment under the terms of
          our <a href="/legal/refund?lang=en">Refund Policy</a>.
        </p>
      </section>
    </main>

    <footer class="pro-footer">
      <nav class="pro-links" aria-label="Legal">
        <!-- ?lang=en: легалка рендериться мовою відвідувача, а рев'ювер Paddle
             (і покупець) мусить побачити її англійською. Перекриття не
             персистується — див. applyLocaleOverride у src/i18n/index.js. -->
        <a href="/legal/terms?lang=en">Terms of Service</a>
        <a href="/legal/privacy?lang=en">Privacy Policy</a>
        <a href="/legal/refund?lang=en">Refund Policy</a>
        <a href="/legal/payment?lang=en">Payment Terms</a>
      </nav>
      <!-- Email + телефон разом: Paddle вимагає від продавця «buyer support
           details (email and phone number) clearly on their website». -->
      <p class="pro-fine">
        Support: <a href="mailto:support@m4sh.org">support@m4sh.org</a>
        &middot; <a href="tel:+380950838191">+380 95 083 8191</a>
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/store/authStore'

const router = useRouter()
const auth = useAuthStore()

/**
 * `index.html` тримає український <title> — на англійській продажній сторінці
 * він читався б як невідповідність (і рев'юверу Paddle, і покупцеві).
 * SPA не має per-route мета, тож ставимо вручну й повертаємо при виході.
 */
const PAGE_TITLE = 'M4SH Pro — interactive whiteboard with full lesson replay'
let previousTitle = ''

onMounted(() => {
  previousTitle = document.title
  document.title = PAGE_TITLE
})

onBeforeUnmount(() => {
  if (previousTitle) document.title = previousTitle
})

const features = [
  'A live board both of you draw on — formulas, graphs, 3D figures, ready-made tasks.',
  'Replay: every lesson is saved as it happened and can be reopened, not re-recorded.',
  'Invite your own students by link — they need no separate sign-up.',
  'Import your materials (PDF, slides, images) straight onto the board.',
  'Unlimited lessons, boards and exports.',
]

const ctaLabel = computed(() => (auth.isAuthenticated ? 'Go to billing' : 'Get started'))

/**
 * Новий іноземний користувач не має акаунта, тому CTA веде на реєстрацію
 * вчителя і ПРОНОСИТЬ redirect на сторінку тарифів — інакше після реєстрації
 * людина опиняється в кабінеті й мусить сама шукати, де платити.
 * Авторизований іде на тарифи напряму.
 */
function goToCheckout(): void {
  if (auth.isAuthenticated) {
    router.push('/tutor/billing/plans')
    return
  }
  router.push({ path: '/auth/register/tutor', query: { redirect: '/tutor/billing/plans' } })
}
</script>

<style scoped>
.pro {
  min-height: 100vh;
  background: var(--bg-gradient, #fff);
  color: var(--text-primary, #14231c);
  font-size: 1rem;
  line-height: 1.6;
}

.pro-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.pro-logo {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--accent, #0f7b5f);
  text-decoration: none;
  letter-spacing: -0.5px;
}

.pro-nav-login {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 0.75rem;
  color: var(--text-primary, #14231c);
  text-decoration: none;
  font-weight: 500;
  white-space: nowrap;
}

.pro-nav-login:hover { color: var(--accent, #0f7b5f); }

main {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.25rem 1rem;
}

.pro-eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent, #0f7b5f);
}

.pro-title {
  margin: 0 0 0.75rem;
  font-size: clamp(1.9rem, 7vw, 2.75rem);
  line-height: 1.15;
  font-weight: 700;
}

.pro-lede {
  margin: 0 0 1.5rem;
  font-size: 1.0625rem;
  color: var(--text-secondary, #4b5b53);
}

.pro-cta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.pro-cta {
  min-height: 48px;
  padding: 0.75rem 1.75rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--accent, #0f7b5f);
  color: var(--accent-contrast, #fff);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.pro-cta:hover { background: var(--accent-hover, #0c6a52); }

.pro-cta-secondary {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  border: 1px solid var(--border-color, #cbd5e1);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--text-primary, #14231c);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.pro-cta-secondary:hover {
  border-color: var(--accent, #0f7b5f);
  color: var(--accent, #0f7b5f);
}

.pro-cta-note {
  margin: 0.75rem 0 0;
  font-size: 0.9375rem;
  color: var(--text-secondary, #4b5b53);
}

.pro-block { margin-top: 2.5rem; }

.pro-h2 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.pro-text {
  margin: 0 0 0.75rem;
  color: var(--text-secondary, #4b5b53);
}

.pro-text a { color: var(--accent, #0f7b5f); }

.pro-list {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--text-secondary, #4b5b53);
}

.pro-list li { margin-bottom: 0.4rem; }

.pro-price {
  margin-top: 2.5rem;
  padding: 1.5rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.75rem;
  background: var(--surface, #fff);
}

.pro-amount {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: var(--text-secondary, #4b5b53);
}

.pro-amount strong {
  font-size: 2rem;
  color: var(--text-primary, #14231c);
}

.pro-fine {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, #4b5b53);
}

.pro-fine a { color: var(--accent, #0f7b5f); }

.pro-footer {
  max-width: 720px;
  margin: 3rem auto 0;
  padding: 1.5rem 1.25rem 2.5rem;
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.pro-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}

.pro-links a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  color: var(--text-secondary, #4b5b53);
  font-size: 0.9375rem;
}
</style>
