import apiClient from '../utils/apiClient'

export async function getTutorClassrooms() {
  const data = await apiClient.get('/tutor/classrooms/')
  return Array.isArray(data) ? data : data?.results || []
}

export async function getClassroomDetails(id) {
  const data = await apiClient.get(`/tutor/classrooms/${id}/`)
  return data
}
