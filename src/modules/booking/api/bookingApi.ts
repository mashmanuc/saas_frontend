import apiClient from '@/utils/apiClient'
import { useErrorRecovery } from '@/composables/useErrorRecovery'

export class BookingConflictError extends Error {
  constructor(
    message: string,
    public alternativeSlots?: any[],
    public slotId?: number
  ) {
    super(message)
    this.name = 'BookingConflictError'
  }
}

export interface TrialBookingRequest {
  slot_id: number
  subject: string
  student_notes?: string
}

export interface Booking {
  booking_id: string
  status: 'pending' | 'confirmed' | 'cancelled_student' | 'cancelled_tutor'
  time_slot: {
    id: number
    date: string
    start_time: string
    end_time: string
    start_datetime: string
    end_datetime: string
  }
  tutor: {
    id: number
    name: string
    slug: string
    avatar?: string
  }
  student: {
    id: number
    name: string
    avatar?: string
  }
  subject: string
  student_notes?: string
  tutor_notes?: string
  created_at: string
  confirmed_at?: string
  cancelled_at?: string
  cancellation_reason?: string
  request_id: string
}

export interface BookingConfirmRequest {
  tutor_notes?: string
}

export interface BookingCancelRequest {
  reason: string
}

export interface SlotEditRequest {
  start_time: string
  end_time: string
  strategy: 'override' | 'template' | 'series'
  override_reason?: string
}

export interface SlotBatchEditRequest {
  slot_ids: number[]
  start_time: string
  end_time: string
  strategy: 'override' | 'template'
  override_reason?: string
}

export interface BlockSlotRequest {
  start: string
  end: string
  reason?: string
}

export const bookingApi = {
  async createTrialBooking(
    matchId: string,
    data: TrialBookingRequest
  ): Promise<Booking> {
    const { executeWithRetry } = useErrorRecovery({
      maxRetries: 2,
      retryDelay: 200,
      exponentialBackoff: true,
      onRetry: (attempt, error) => {
        console.warn(`[bookingApi] Retry attempt ${attempt} for trial booking`, error)
      }
    })

    return executeWithRetry(async () => {
      try {
        const { data: response } = await apiClient.post(
          `/api/v1/matches/${matchId}/trial-request`,
          data
        )
        return response
      } catch (err: any) {
        if (err.response?.status === 409) {
          throw new BookingConflictError(
            err.response?.data?.detail || 'Slot unavailable',
            err.response?.data?.alternative_slots,
            data.slot_id
          )
        }
        throw err
      }
    }, 'createTrialBooking')
  },

  async confirmBooking(
    bookingId: string,
    data: BookingConfirmRequest
  ): Promise<Booking> {
    const { data: response } = await apiClient.post(
      `/booking/bookings/${bookingId}/confirm/`,
      data
    )
    return response
  },

  async cancelBooking(
    bookingId: number,
    data: BookingCancelRequest
  ): Promise<Booking> {
    const { data: response } = await apiClient.post(
      `/booking/bookings/${bookingId}/cancel/`,
      data
    )
    return response
  },

  /**
   * Edit single slot
   */
  async editSlot(slotId: string, data: SlotEditRequest): Promise<any> {
    const { data: response } = await apiClient.patch(
      `/booking/slots/${slotId}/`,
      data
    )
    return response
  },

  /**
   * Delete slot
   */
  async deleteSlot(slotId: number): Promise<void> {
    await apiClient.delete(`/booking/slots/${slotId}/`)
  },

  /**
   * Batch edit multiple slots
   */
  async batchEditSlots(data: SlotBatchEditRequest): Promise<any> {
    const { data: response } = await apiClient.post(
      `/booking/slots/batch-edit/`,
      data
    )
    return response
  },

  /**
   * Block time range
   */
  async blockSlot(data: BlockSlotRequest): Promise<any> {
    const { data: response } = await apiClient.post(
      `/booking/slots/block/`,
      data
    )
    return response
  },

  /**
   * Unblock time range
   */
  async unblockSlot(slotId: number): Promise<void> {
    await apiClient.delete(`/booking/slots/block/${slotId}/`)
  }
}

export default bookingApi
