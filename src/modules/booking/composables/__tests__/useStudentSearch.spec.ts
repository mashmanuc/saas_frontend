import { describe, it, expect } from 'vitest'
import { useStudentSearch } from '../useStudentSearch'
import type { Order } from '../../types/calendarWeek'

describe('useStudentSearch', () => {
  const mockOrders: Order[] = [
    {
      id: 1,
      clientName: 'Іван Петренко',
      status: 6,
      durations: [30, 60],
      studentId: 101,
      lessonsBalance: 5,
      studentPhone: '+380501234567',
      studentEmail: 'ivan@example.com',
    },
    {
      id: 2,
      clientName: 'Марія Коваленко',
      status: 6,
      durations: [60, 90],
      studentId: 102,
      lessonsBalance: 3,
      studentPhone: '+380509876543',
      studentEmail: 'maria@example.com',
    },
    {
      id: 3,
      clientName: 'Олександр Шевченко',
      status: 6,
      durations: [30, 60, 90],
      studentId: 103,
      lessonsBalance: 0,
      studentPhone: '+380671112233',
      studentEmail: 'alex@example.com',
    },
  ]

  it('should return all orders when search query is empty', () => {
    const { filteredOrders, searchQuery } = useStudentSearch(mockOrders)
    
    expect(filteredOrders.value).toEqual(mockOrders)
    expect(searchQuery.value).toBe('')
  })

  it('should filter orders by client name', () => {
    const { filteredOrders, searchQuery } = useStudentSearch(mockOrders)
    
    searchQuery.value = 'Іван'
    
    expect(filteredOrders.value).toHaveLength(1)
    expect(filteredOrders.value[0].clientName).toBe('Іван Петренко')
  })

  it('should filter orders by phone number', () => {
    const { filteredOrders, searchQuery } = useStudentSearch(mockOrders)
    
    searchQuery.value = '+380509876543'
    
    expect(filteredOrders.value).toHaveLength(1)
    expect(filteredOrders.value[0].clientName).toBe('Марія Коваленко')
  })

  it('should filter orders by email', () => {
    const { filteredOrders, searchQuery } = useStudentSearch(mockOrders)
    
    searchQuery.value = 'alex@example.com'
    
    expect(filteredOrders.value).toHaveLength(1)
    expect(filteredOrders.value[0].clientName).toBe('Олександр Шевченко')
  })

  it('should be case-insensitive', () => {
    const { filteredOrders, searchQuery } = useStudentSearch(mockOrders)
    
    searchQuery.value = 'МАРІЯ'
    
    expect(filteredOrders.value).toHaveLength(1)
    expect(filteredOrders.value[0].clientName).toBe('Марія Коваленко')
  })

  it('should return empty array when no matches found', () => {
    const { filteredOrders, searchQuery } = useStudentSearch(mockOrders)
    
    searchQuery.value = 'NonExistentName'
    
    expect(filteredOrders.value).toHaveLength(0)
  })

  it('should select order and update search query', () => {
    const { selectedOrderId, searchQuery, selectOrder } = useStudentSearch(mockOrders)
    
    selectOrder(2)
    
    expect(selectedOrderId.value).toBe(2)
    expect(searchQuery.value).toBe('Марія Коваленко')
  })

  it('should return selected order', () => {
    const { selectedOrder, selectOrder } = useStudentSearch(mockOrders)
    
    selectOrder(1)
    
    expect(selectedOrder.value).toEqual(mockOrders[0])
  })

  it('should return lessons balance for selected order', () => {
    const { lessonsBalance, selectOrder } = useStudentSearch(mockOrders)
    
    selectOrder(1)
    
    expect(lessonsBalance.value).toBe(5)
  })

  it('should return null balance when no order selected', () => {
    const { lessonsBalance } = useStudentSearch(mockOrders)
    
    expect(lessonsBalance.value).toBeNull()
  })

  it('should clear selection', () => {
    const { selectedOrderId, searchQuery, selectOrder, clearSelection } = useStudentSearch(mockOrders)
    
    selectOrder(1)
    expect(selectedOrderId.value).toBe(1)
    
    clearSelection()
    
    expect(selectedOrderId.value).toBeNull()
    expect(searchQuery.value).toBe('')
  })

  it('should handle partial phone number search', () => {
    const { filteredOrders, searchQuery } = useStudentSearch(mockOrders)
    
    searchQuery.value = '0501234'
    
    expect(filteredOrders.value).toHaveLength(1)
    expect(filteredOrders.value[0].studentPhone).toContain('0501234')
  })

  it('should handle partial email search', () => {
    const { filteredOrders, searchQuery } = useStudentSearch(mockOrders)
    
    searchQuery.value = 'example.com'
    
    expect(filteredOrders.value).toHaveLength(3)
  })
})
