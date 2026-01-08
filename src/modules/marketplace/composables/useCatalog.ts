import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import type { TagGroup, SpecialtyTagCatalog, SubjectCatalog } from '../api/marketplace'

export function useCatalog() {
  const store = useMarketplaceStore()
  const { locale } = useI18n()
  
  const subjects = computed(() => store.catalogSubjects)
  const tags = computed(() => store.catalogTags)
  const loading = computed(() => store.catalogLoading)
  const error = computed(() => store.catalogError)
  
  async function loadSubjects() {
    await store.loadCatalogSubjects(locale.value)
  }
  
  async function loadTags(group?: TagGroup) {
    await store.loadCatalogTags(locale.value, group)
  }
  
  function getTagsByGroup(group: TagGroup): SpecialtyTagCatalog[] {
    return store.getTagsByGroup(group)
  }
  
  function getSubjectByCode(code: string): SubjectCatalog | undefined {
    return store.getSubjectByCode(code)
  }
  
  function getTagLabel(code: string): string {
    const tag = tags.value.find((t) => t.code === code)
    return tag?.label || code
  }
  
  function getSubjectTitle(code: string): string {
    const subject = subjects.value.find((s) => s.code === code)
    return subject?.title || code
  }
  
  return {
    subjects,
    tags,
    loading,
    error,
    loadSubjects,
    loadTags,
    getTagsByGroup,
    getSubjectByCode,
    getTagLabel,
    getSubjectTitle,
  }
}
