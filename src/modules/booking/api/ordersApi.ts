import apiClient from '@/utils/apiClient'

export interface OrderStudent {
  id: number
  firstName: string
  lastName: string
  fullName: string
  email: string
  avatar?: string
}

export interface Order {
  id: number
  tutorId: number
  student: OrderStudent
  status: number
  source: 'PAID' | 'TRIAL' | 'LOYALTY' | 'GRACE' | 'SYSTEM'
  allowedDurations: number[]
  hourlyRate: number
  totalHoursPurchased: number
  createdAt: string
  updatedAt: string
}

export interface OrdersListResponse {
  results: Order[]
}

const ORDERS_PATH = '/api/v1/orders/my/'

function getData<T>(request: Promise<any>): Promise<T> {
  return request.then((res: any) => (res?.data ?? res) as T)
}

/**
 * API for Orders (Order Domain)
 * SSOT: Orders are the "passport" for creating lessons
 */
export const ordersApi = {
  /**
   * Get all Orders for the current tutor
   * CONTRACT: GET /api/v1/orders/my/
   */
  listOrders(): Promise<OrdersListResponse> {
    return getData<OrdersListResponse>(
      apiClient.get(ORDERS_PATH)
    )
  },

  /**
   * Get a single Order by ID
   * CONTRACT: GET /api/v1/orders/:id/
   */
  getOrder(id: number): Promise<Order> {
    return getData<Order>(
      apiClient.get(`${ORDERS_PATH}${id}/`)
    )
  },
}
