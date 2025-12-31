import { ref, computed } from 'vue'
import type { Order } from '../types/calendarWeek'

/**
 * Composable для пошуку студентів у модалці створення уроку
 * F2: Student search combobox
 */
export function useStudentSearch(orders: Order[]) {
  const searchQuery = ref('')
  const selectedOrderId = ref<number | null>(null)

  const filteredOrders = computed(() => {
    if (!searchQuery.value) return orders

    const query = searchQuery.value.toLowerCase()
    return orders.filter(order => {
      const nameMatch = order.clientName.toLowerCase().includes(query)
      const phoneMatch = order.studentPhone?.toLowerCase().includes(query)
      const emailMatch = order.studentEmail?.toLowerCase().includes(query)
      return nameMatch || phoneMatch || emailMatch
    })
  })

  const selectedOrder = computed(() => {
    if (!selectedOrderId.value) return null
    return orders.find(o => o.id === selectedOrderId.value) || null
  })

  const lessonsBalance = computed(() => {
    return selectedOrder.value?.lessonsBalance ?? null
  })

  function selectOrder(orderId: number) {
    selectedOrderId.value = orderId
    const order = orders.find(o => o.id === orderId)
    if (order) {
      searchQuery.value = order.clientName
    }
  }

  function clearSelection() {
    selectedOrderId.value = null
    searchQuery.value = ''
  }

  return {
    searchQuery,
    selectedOrderId,
    filteredOrders,
    selectedOrder,
    lessonsBalance,
    selectOrder,
    clearSelection,
  }
}
