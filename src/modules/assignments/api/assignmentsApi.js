// Тонкий API-клієнт Assignment (Vertical Slice). apiClient повертає тіло відповіді.
import apiClient from '@/utils/apiClient'

const BASE = '/v1/assignments'

export const assignmentsApi = {
  list() {
    return apiClient.get(`${BASE}/`)
  },
  get(id) {
    return apiClient.get(`${BASE}/${id}/`)
  },
  createDraft(payload) {
    // { assignee_id, title, instructions?, source_kind?, source_ref? }
    return apiClient.post(`${BASE}/`, payload)
  },
  addItem(id, payload) {
    // { item_type, content, order?, source_ref?, topic? }
    return apiClient.post(`${BASE}/${id}/items/`, payload)
  },
  assign(id) {
    return apiClient.post(`${BASE}/${id}/assign/`, {})
  },
  submit(id, payload) {
    // { files?, text? }
    return apiClient.post(`${BASE}/${id}/submit/`, payload)
  },
  grade(id, payload) {
    // { submission_id?, grade, feedback }
    return apiClient.post(`${BASE}/${id}/grade/`, payload)
  },
}
