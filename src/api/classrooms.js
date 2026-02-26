import apiClient from '../utils/apiClient'

export async function getTutorClassrooms() {
  const data = await apiClient.get('/tutor/classrooms/')
  return Array.isArray(data) ? data : data?.results || []
}

export async function getClassroomDetails(id) {
  const data = await apiClient.get(`/tutor/classrooms/${id}/`)
  return data
}

export async function createClassroom({ name, classroom_type, max_students }) {
  const data = await apiClient.post('/tutor/classrooms/', { name, classroom_type, max_students })
  return data
}

export async function updateClassroom(id, payload) {
  const data = await apiClient.patch(`/tutor/classrooms/${id}/`, payload)
  return data
}

export async function deleteClassroom(id) {
  await apiClient.delete(`/tutor/classrooms/${id}/`)
}

export async function getAvailableStudents(classroomId, q = '') {
  const params = q ? { q } : {}
  const data = await apiClient.get(`/tutor/classrooms/${classroomId}/available-students/`, { params })
  return data
}

export async function addStudentToClassroom(classroomId, studentId) {
  const data = await apiClient.post(`/tutor/classrooms/${classroomId}/members/`, { student_id: studentId })
  return data
}

export async function removeStudentFromClassroom(classroomId, userId) {
  await apiClient.delete(`/tutor/classrooms/${classroomId}/members/${userId}/`)
}
