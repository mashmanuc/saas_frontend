import apiClient from '@/utils/apiClient'

export interface BookingRequest {
  id: number
  tutor_id: number
  student_id: number
  start_datetime: string
  duration_minutes: number
  student_message: string
  tutor_response: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface BookingRequestListResponse {
  results: BookingRequest[]
  count: number
}

export const bookingRequestsApi = {
  async create(data: {
    tutor_id: number
    start_datetime: string
    duration_minutes: number
    student_message: string
  }): Promise<BookingRequest> {
    const response = await apiClient.post('/api/booking/requests/', data)
    return response.data
  },
  
  async list(params: { status?: string }): Promise<BookingRequestListResponse> {
    const response = await apiClient.get('/api/booking/requests/', { params })
    return response.data
  },
  
  async myRequests(params: { status?: string }): Promise<BookingRequestListResponse> {
    const response = await apiClient.get('/api/booking/my-requests/', { params })
    return response.data
  },
  
  async accept(id: number, data: { tutor_response: string }): Promise<BookingRequest> {
    const response = await apiClient.post(`/api/booking/requests/${id}/accept/`, data)
    return response.data
  },
  
  async reject(id: number, data: { tutor_response: string }): Promise<BookingRequest> {
    const response = await apiClient.post(`/api/booking/requests/${id}/reject/`, data)
    return response.data
  },
  
  async cancel(id: number): Promise<BookingRequest> {
    const response = await apiClient.post(`/api/booking/requests/${id}/cancel/`)
    return response.data
  },
}

export default bookingRequestsApi
