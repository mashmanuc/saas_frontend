import { ref, computed, onMounted } from 'vue'
import { knowledgeApi, type KnowledgeLesson, type KnowledgeTemplate } from '../api/knowledgeApi'

export function useKnowledge() {
  const lessons = ref<KnowledgeLesson[]>([])
  const templates = ref<KnowledgeTemplate[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const activeTab = ref<'lessons' | 'templates' | 'starter_packs'>('lessons')

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      const [lessonsRes, templatesRes] = await Promise.all([
        knowledgeApi.getLessons(),
        knowledgeApi.getTemplates(),
      ])
      lessons.value = lessonsRes
      templates.value = templatesRes
    } catch (e) {
      console.warn('[useKnowledge] Load failed:', e)
      error.value = 'load_failed'
    } finally {
      isLoading.value = false
    }
  }

  const lessonCount = computed(() => lessons.value.length)
  const templateCount = computed(() => templates.value.length)

  onMounted(load)

  return {
    lessons,
    templates,
    isLoading,
    error,
    activeTab,
    lessonCount,
    templateCount,
    reload: load,
  }
}
