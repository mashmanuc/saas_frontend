import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { learningContentApi } from '../api/learningContentApi'
import type {
  Subject,
  Collection,
  Topic,
  Unit,
  ContentItemSummary,
  SearchParams,
  SearchResult,
} from '../types/learningContent'

export const useContentLibraryStore = defineStore('contentLibrary', () => {
  // ── Tree state ──────────────────────────────────────────────
  const subjects = ref<Subject[]>([])
  const collections = ref<Collection[]>([])
  const selectedSubject = ref<string | null>(null)
  const selectedCollection = ref<number | null>(null)
  const collectionTree = ref<{ topics: Topic[] } | null>(null)

  const loadedUnits = ref<Map<number, Unit>>(new Map())
  const loadingUnits = ref<Set<number>>(new Set())
  const expandedTopics = ref<Set<number>>(new Set())
  const expandedUnits = ref<Set<number>>(new Set())

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Search state ────────────────────────────────────────────
  const searchQuery = ref('')
  const searchResults = ref<SearchResult | null>(null)
  const searchParams = ref<SearchParams>({})
  const isSearching = ref(false)
  const searchMode = ref(false)

  // ── Debounce (400ms) ────────────────────────────────────────
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // ── Actions: tree ───────────────────────────────────────────
  async function fetchSubjects() {
    isLoading.value = true
    error.value = null
    try {
      subjects.value = await learningContentApi.getSubjects()
    } catch {
      error.value = 'Помилка завантаження предметів'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchCollections(subjectSlug?: string) {
    isLoading.value = true
    error.value = null
    try {
      collections.value = await learningContentApi.getCollections(subjectSlug)
    } catch {
      error.value = 'Помилка завантаження збірників'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchCollectionTree(collectionId: number) {
    isLoading.value = true
    error.value = null
    try {
      const result = await learningContentApi.getCollectionTree(collectionId)
      collectionTree.value = { topics: result.topics }
      loadedUnits.value.clear()
      expandedTopics.value.clear()
      expandedUnits.value.clear()
    } catch {
      error.value = 'Помилка завантаження дерева'
    } finally {
      isLoading.value = false
    }
  }

  async function expandUnit(unitId: number) {
    if (loadedUnits.value.has(unitId)) {
      expandedUnits.value.add(unitId)
      return
    }
    if (loadingUnits.value.has(unitId)) return

    loadingUnits.value.add(unitId)
    try {
      const unit = await learningContentApi.getUnitItems(unitId)
      loadedUnits.value.set(unitId, unit)
      expandedUnits.value.add(unitId)
    } catch {
      error.value = `Помилка завантаження блоку ${unitId}`
    } finally {
      loadingUnits.value.delete(unitId)
    }
  }

  function toggleTopic(topicId: number) {
    if (expandedTopics.value.has(topicId)) {
      expandedTopics.value.delete(topicId)
    } else {
      expandedTopics.value.add(topicId)
    }
  }

  function toggleUnit(unitId: number) {
    if (expandedUnits.value.has(unitId)) {
      expandedUnits.value.delete(unitId)
    } else {
      expandUnit(unitId)
    }
  }

  async function selectSubject(slug: string) {
    selectedSubject.value = slug
    selectedCollection.value = null
    collectionTree.value = null
    await fetchCollections(slug)
  }

  async function selectCollection(id: number) {
    selectedCollection.value = id
    await fetchCollectionTree(id)
  }

  // ── Actions: search ─────────────────────────────────────────
  function setSearchQuery(q: string) {
    searchQuery.value = q
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)

    if (!q.trim()) {
      clearSearch()
      return
    }

    searchMode.value = true
    searchDebounceTimer = setTimeout(() => {
      searchItems({ ...searchParams.value, q })
    }, 400)
  }

  async function searchItems(params: SearchParams) {
    isSearching.value = true
    error.value = null
    try {
      searchResults.value = await learningContentApi.searchItems(params)
    } catch {
      error.value = 'Помилка пошуку'
    } finally {
      isSearching.value = false
    }
  }

  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = null
    searchMode.value = false
    isSearching.value = false
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  }

  function reset() {
    subjects.value = []
    collections.value = []
    selectedSubject.value = null
    selectedCollection.value = null
    collectionTree.value = null
    loadedUnits.value.clear()
    expandedTopics.value.clear()
    expandedUnits.value.clear()
    loadingUnits.value.clear()
    clearSearch()
    error.value = null
  }

  // ── Getters ─────────────────────────────────────────────────
  const isUnitLoading = computed(() => (unitId: number) => loadingUnits.value.has(unitId))
  const isUnitExpanded = computed(() => (unitId: number) => expandedUnits.value.has(unitId))
  const isTopicExpanded = computed(() => (topicId: number) => expandedTopics.value.has(topicId))
  const getUnitItems = computed(
    () => (unitId: number): ContentItemSummary[] => loadedUnits.value.get(unitId)?.items ?? [],
  )

  return {
    // State
    subjects,
    collections,
    selectedSubject,
    selectedCollection,
    collectionTree,
    loadedUnits,
    expandedTopics,
    expandedUnits,
    loadingUnits,
    isLoading,
    error,
    searchQuery,
    searchResults,
    searchParams,
    isSearching,
    searchMode,
    // Actions
    fetchSubjects,
    fetchCollections,
    fetchCollectionTree,
    expandUnit,
    toggleTopic,
    toggleUnit,
    selectSubject,
    selectCollection,
    setSearchQuery,
    searchItems,
    clearSearch,
    reset,
    // Getters
    isUnitLoading,
    isUnitExpanded,
    isTopicExpanded,
    getUnitItems,
  }
})
