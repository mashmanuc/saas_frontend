/**
 * useCalendarGrid - Composable for calendar grid calculations
 *
 * Provides utilities for absolute positioning of events on calendar grid.
 * Supports arbitrary time (not bound to 30-min slots).
 *
 * @module useCalendarGrid
 */

import { computed } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export interface GridConfig {
  pxPerMinute: number
  startHour: number
  endHour: number
  timezone: string
}

export const useCalendarGrid = (config?: Partial<GridConfig>) => {
  const defaultConfig: GridConfig = {
    pxPerMinute: 0.6, // ~36px per hour: більш щільна сітка
    startHour: 6,
    endHour: 22,
    timezone: 'UTC',
  }

  const gridConfig = { ...defaultConfig, ...config }

  /**
   * Check if datetime is in the past (in given timezone)
   */
  const isPast = (datetime: string): boolean => {
    const now = dayjs().tz(gridConfig.timezone)
    return dayjs(datetime).tz(gridConfig.timezone).isBefore(now)
  }

  /**
   * Calculate top position in pixels from day start (timezone-aware)
   */
  const calculateTopPx = (datetime: string): number => {
    const date = dayjs(datetime).tz(gridConfig.timezone)
    const minutesFromDayStart = date.hour() * 60 + date.minute()
    const minutesFromGridStart = Math.max(0, minutesFromDayStart - gridConfig.startHour * 60)
    return minutesFromGridStart * gridConfig.pxPerMinute
  }

  /**
   * Calculate height in pixels based on duration (timezone-aware)
   */
  const calculateHeightPx = (start: string, end: string): number => {
    const startDate = dayjs(start).tz(gridConfig.timezone)
    const endDate = dayjs(end).tz(gridConfig.timezone)
    const durationMinutes = endDate.diff(startDate, 'minute')
    return durationMinutes * gridConfig.pxPerMinute
  }

  /**
   * Format time for display (HH:MM) in timezone
   */
  const formatTime = (datetime: string): string => {
    return dayjs(datetime).tz(gridConfig.timezone).format('HH:mm')
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
    formatHour,
  }
}
