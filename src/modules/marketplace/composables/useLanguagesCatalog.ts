/**
 * Composable for languages catalog (v0.84.0)
 * Singleton pattern to share state across components
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Language, LanguageTag, LanguagesCatalog } from '../api/languages'
import { getLanguagesCatalog } from '../api/languages'

// Shared state (singleton)
const catalog = ref<LanguagesCatalog | null>(null)
const loading = ref(false)
const error = ref<Error | null>(null)

export function useLanguagesCatalog() {
  const { locale } = useI18n()

  const languages = computed(() => catalog.value?.languages || [])
  const popularLanguages = computed(() => 
    languages.value.filter(l => l.is_popular)
  )
  const otherLanguages = computed(() => 
    languages.value.filter(l => !l.is_popular)
  )

  const levelTags = computed(() => catalog.value?.tags.level || [])
  const formatTags = computed(() => catalog.value?.tags.format || [])
  const goalTags = computed(() => catalog.value?.tags.goal || [])
  const audienceTags = computed(() => catalog.value?.tags.audience || [])

  async function loadCatalog() {
    // Skip if already loading
    if (loading.value) return
    
    loading.value = true
    error.value = null
    
    try {
      catalog.value = await getLanguagesCatalog({ locale: locale.value })
    } catch (e) {
      error.value = e as Error
      console.error('[useLanguagesCatalog] Failed to load catalog:', e)
    } finally {
      loading.value = false
    }
  }

  function getLanguageTitle(code: string): string {
    const lang = languages.value.find(l => l.code === code)
    return lang?.title || code
  }

  function getTagTitle(code: string): string {
    const allTags = [
      ...levelTags.value,
      ...formatTags.value,
      ...goalTags.value,
      ...audienceTags.value,
    ]
    const tag = allTags.find(t => t.code === code)
    return tag?.title || code
  }

  return {
    catalog,
    loading,
    error,
    languages,
    popularLanguages,
    otherLanguages,
    levelTags,
    formatTags,
    goalTags,
    audienceTags,
    loadCatalog,
    getLanguageTitle,
    getTagTitle,
  }
}
