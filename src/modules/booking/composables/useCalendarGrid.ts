/**
 * useCalendarGrid - Composable for calendar grid calculations
 * 
 * Provides utilities for absolute positioning of events on calendar grid.
 * Supports arbitrary time (not bound to 30-min slots).
 * 
 * @module useCalendarGrid
 */

import { computed } from 'vue'

export interface GridConfig {
  pxPerMinute: number
  startHour: number
  endHour: number
}

export const useCalendarGrid = (config?: Partial<GridConfig>) => {
  const defaultConfig: GridConfig = {
    pxPerMinute: 2, // 2px per minute = 120px per hour
    startHour: 6,
    endHour: 22
  }

  const gridConfig = { ...defaultConfig, ...config }

  /**
   * Check if datetime is in the past
   */
  const isPast = (datetime: string): boolean => {
    return new Date(datetime) < new Date()
  }

  /**
   * Calculate top position in pixels from day start
   */
  const calculateTopPx = (datetime: string): number => {
    const date = new Date(datetime)
    const minutesFromDayStart = date.getHours() * 60 + date.getMinutes()
    return minutesFromDayStart * gridConfig.pxPerMinute
  }

  /**
   * Calculate height in pixels based on duration
   */
  const calculateHeightPx = (start: string, end: string): number => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000
    return durationMinutes * gridConfig.pxPerMinute
  }

  /**
   * Format time for display (HH:MM)
   */
  const formatTime = (datetime: string): string => {
    const date = new Date(datetime)
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  }

  /**
   * Format hour label (HH:00)
   */
  const formatHour = (hour: number): string => {
    return `${hour.toString().padStart(2, '0')}:00`
  }

  /**
   * Get hours array for grid
   */
  const hours = computed(() => {
    const result = []
    for (let h = gridConfig.startHour; h <= gridConfig.endHour; h++) {
      result.push(h)
    }
    return result
  })

  /**
   * Calculate grid height
   */
  const gridHeight = computed(() => {
    const totalHours = gridConfig.endHour - gridConfig.startHour
    return totalHours * 60 * gridConfig.pxPerMinute
  })

  return {
    pxPerMinute: gridConfig.pxPerMinute,
    startHour: gridConfig.startHour,
    endHour: gridConfig.endHour,
    hours,
    gridHeight,
    isPast,
    calculateTopPx,
    calculateHeightPx,
    formatTime,
    formatHour
  }
}
