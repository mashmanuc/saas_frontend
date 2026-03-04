import apiClient from '@/utils/apiClient'
import type {
  Subject,
  Collection,
  Topic,
  Unit,
  ContentItemSummary,
  ContentItemDetail,
  LessonMaterial,
  SearchParams,
  SearchResult,
  CreateLessonMaterialPayload,
} from '../types/learningContent'

const BASE = '/v1/learning-content'

export const learningContentApi = {
  async getSubjects(): Promise<Subject[]> {
    return apiClient.get(`${BASE}/subjects/`)
  },

  async getCollections(subjectSlug?: string): Promise<Collection[]> {
    const params = subjectSlug ? { subject: subjectSlug } : undefined
    return apiClient.get(`${BASE}/collections/`, { params })
  },

  async getCollectionTree(collectionId: number): Promise<{ collection: Collection; topics: Topic[] }> {
    return apiClient.get(`${BASE}/collections/${collectionId}/tree/`)
  },

  async getUnitItems(unitId: number): Promise<Unit> {
    return apiClient.get(`${BASE}/units/${unitId}/items/`)
  },

  async searchItems(params: SearchParams): Promise<SearchResult> {
    const query: Record<string, string | number> = {}
    if (params.q) query.q = params.q
    if (params.subject) query.subject = params.subject
    if (params.difficulty) query.difficulty = params.difficulty
    if (params.tags) query.tags = params.tags
    if (params.collection) query.collection = params.collection
    if (params.page) query.page = params.page
    if (params.ownership_type) query.ownership_type = params.ownership_type
    if (params.owner) query.owner = params.owner
    if (params.language) query.language = params.language
    if (params.lesson_id) query.lesson_id = params.lesson_id
    return apiClient.get(`${BASE}/items/search/`, { params: query })
  },

  async getItemDetail(itemId: number): Promise<ContentItemDetail> {
    return apiClient.get(`${BASE}/items/${itemId}/`)
  },

  async createLessonMaterial(data: CreateLessonMaterialPayload): Promise<LessonMaterial> {
    return apiClient.post(`${BASE}/lesson-materials/`, data)
  },

  async getLessonMaterials(sessionUuid: string): Promise<LessonMaterial[]> {
    return apiClient.get(`${BASE}/lesson-materials/`, { params: { session: sessionUuid } })
  },

  async getLessonAllowedItems(lessonId: number): Promise<ContentItemSummary[]> {
    return apiClient.get(`${BASE}/lessons/${lessonId}/allowed-content/`)
  },

  async getLessonParticipants(lessonId: number): Promise<unknown[]> {
    return apiClient.get(`${BASE}/lessons/${lessonId}/participants/`)
  },

  async uploadFile(formData: FormData): Promise<unknown> {
    return apiClient.post(`${BASE}/content-items/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
