<template>
  <div class="help-page" data-testid="help-page">
    <header class="help-head">
      <h1 class="help-title">{{ t('help.page.title') }}</h1>
      <p class="help-subtitle">{{ t('help.page.subtitle') }}</p>
    </header>

    <div class="help-layout">
      <!-- Навігація за сценаріями -->
      <aside class="help-nav" :aria-label="t('help.page.navLabel')">
        <nav v-for="section in sections" :key="section.key" class="help-nav__section">
          <div class="help-nav__section-title">
            <span class="help-nav__icon" aria-hidden="true">{{ section.icon }}</span>
            {{ section.title }}
          </div>
          <ul class="help-nav__list">
            <li v-for="article in section.articles" :key="article.slug">
              <button
                type="button"
                class="help-nav__link"
                :class="{ 'help-nav__link--active': article.slug === currentSlug }"
                @click="select(article.slug)"
              >
                {{ article.title }}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- Контент статті -->
      <main class="help-content" data-testid="help-content">
        <template v-if="current">
          <h2 class="help-article__title">{{ current.article.title }}</h2>
          <p class="help-article__summary">{{ current.article.summary }}</p>
          <!-- eslint-disable-next-line vue/no-v-html -- довірений статичний контент (не user-input) -->
          <div class="help-article__body" v-html="current.article.body" />
        </template>
        <p v-else class="help-empty">{{ t('help.page.notFound') }}</p>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { HELP_SECTIONS, DEFAULT_HELP_SLUG } from '../data/helpArticles'
import { HELP_SECTIONS_EN } from '../data/helpArticles.en'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

// slug/key/icon ідентичні в обох локалях — перемикаємо лише контент.
const sections = computed(() => (locale.value === 'en' ? HELP_SECTIONS_EN : HELP_SECTIONS))

const currentSlug = computed(() => (route.params.slug as string) || DEFAULT_HELP_SLUG)

const current = computed(() => {
  const find = (slug: string) => {
    for (const section of sections.value) {
      const article = section.articles.find((a) => a.slug === slug)
      if (article) return { section, article }
    }
    return null
  }
  return find(currentSlug.value) ?? find(DEFAULT_HELP_SLUG)
})

function select(slug: string): void {
  if (slug === currentSlug.value) return
  router.push({ name: 'help', params: { slug } })
}
</script>

<style scoped>
.help-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-md, 16px);
}

.help-head {
  margin-bottom: var(--space-lg, 24px);
}
.help-title {
  font-size: var(--text-xl, 1.5rem);
  font-weight: 700;
  color: var(--text-primary, #111827);
  margin: 0 0 4px;
}
.help-subtitle {
  color: var(--text-secondary, #6b7280);
  font-size: var(--text-sm, 0.875rem);
  margin: 0;
}

.help-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--space-lg, 24px);
  align-items: start;
}

/* ── Навігація ── */
.help-nav {
  position: sticky;
  top: var(--space-md, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 16px);
}
.help-nav__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 4px;
}
.help-nav__icon {
  font-size: 0.95rem;
}
.help-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.help-nav__link {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md, 8px);
  color: var(--text-primary, #111827);
  font-size: var(--text-sm, 0.875rem);
  line-height: 1.35;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.help-nav__link:hover {
  background: var(--hover-bg, #f3f4f6);
}
.help-nav__link--active {
  background: var(--accent, #10b981);
  color: #fff;
  font-weight: 600;
}

/* ── Контент ── */
.help-content {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-lg, 24px);
  min-width: 0;
}
.help-article__title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
  margin: 0 0 4px;
}
.help-article__summary {
  color: var(--text-secondary, #6b7280);
  font-size: var(--text-sm, 0.875rem);
  margin: 0 0 var(--space-md, 16px);
  padding-bottom: var(--space-md, 16px);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}
.help-empty {
  color: var(--text-secondary, #6b7280);
}

/* Тіло статті (v-html) — :deep бо контент рендериться поза scoped-деревом */
.help-article__body :deep(h3) {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
  margin: var(--space-md, 16px) 0 6px;
}
.help-article__body :deep(p) {
  color: var(--text-primary, #374151);
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 0 0 10px;
}
.help-article__body :deep(ul),
.help-article__body :deep(ol) {
  margin: 0 0 10px;
  padding-left: 22px;
}
.help-article__body :deep(li) {
  color: var(--text-primary, #374151);
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 4px;
}
.help-article__body :deep(strong) {
  color: var(--text-primary, #111827);
  font-weight: 600;
}

/* ── Mobile ── */
@media (max-width: 720px) {
  .help-layout {
    grid-template-columns: 1fr;
  }
  .help-nav {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-md, 16px);
    padding-bottom: var(--space-sm, 8px);
  }
  .help-nav__section {
    flex: 1 1 140px;
  }
}
</style>
