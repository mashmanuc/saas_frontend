import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  PERF_MARKS,
  mark,
  measure,
  clearMarks,
  getEntries,
  startTimer,
} from '../../src/perf/marks'

describe('Performance Marks', () => {
  beforeEach(() => {
    clearMarks()
  })

  afterEach(() => {
    clearMarks()
  })

  describe('PERF_MARKS', () => {
    it('has all expected mark names', () => {
      expect(PERF_MARKS.APP_INIT).toBe('app:init')
      expect(PERF_MARKS.APP_READY).toBe('app:ready')
      expect(PERF_MARKS.ROUTE_START).toBe('route:start')
      expect(PERF_MARKS.ROUTE_END).toBe('route:end')
      expect(PERF_MARKS.CHAT_LOAD_START).toBe('chat:load:start')
      expect(PERF_MARKS.CHAT_LOAD_END).toBe('chat:load:end')
      expect(PERF_MARKS.WS_CONNECT_START).toBe('ws:connect:start')
      expect(PERF_MARKS.WS_CONNECT_END).toBe('ws:connect:end')
    })

    it('is frozen', () => {
      expect(Object.isFrozen(PERF_MARKS)).toBe(true)
    })
  })

  describe('mark', () => {
    it('creates a performance mark', () => {
      mark('test:mark')
      
      const entries = performance.getEntriesByName('test:mark', 'mark')
      expect(entries.length).toBe(1)
    })

    it('handles multiple marks with same name', () => {
      mark('test:mark')
      mark('test:mark')
      
      const entries = performance.getEntriesByName('test:mark', 'mark')
      expect(entries.length).toBe(2)
    })
  })

  describe('measure', () => {
    it('measures time between two marks', () => {
      mark('start')
      mark('end')
      
      const duration = measure('test-measure', 'start', 'end')
      
      expect(typeof duration).toBe('number')
      expect(duration).toBeGreaterThanOrEqual(0)
    })

    it('returns null when marks do not exist', () => {
      const duration = measure('test-measure', 'nonexistent-start', 'nonexistent-end')
      
      expect(duration).toBeNull()
    })
  })

  describe('clearMarks', () => {
    it('clears all marks and measures', () => {
      mark('test:mark')
      mark('test:mark2')
      
      clearMarks()
      
      const marks = performance.getEntriesByType('mark')
      const measures = performance.getEntriesByType('measure')
      
      expect(marks.length).toBe(0)
      expect(measures.length).toBe(0)
    })
  })

  describe('getEntries', () => {
    it('returns all performance entries', () => {
      mark('test:mark')
      
      const entries = getEntries()
      
      expect(Array.isArray(entries)).toBe(true)
      expect(entries.some(e => e.name === 'test:mark')).toBe(true)
    })
  })

  describe('startTimer', () => {
    it('creates a scoped timer', () => {
      const timer = startTimer('test-timer')
      
      expect(timer).toHaveProperty('end')
      expect(typeof timer.end).toBe('function')
    })

    it('measures duration when ended', () => {
      const timer = startTimer('test-timer')
      
      // Simulate some work
      const duration = timer.end()
      
      expect(typeof duration).toBe('number')
      expect(duration).toBeGreaterThanOrEqual(0)
    })

    it('creates start and end marks', () => {
      const timer = startTimer('test-timer')
      timer.end()
      
      const startMarks = performance.getEntriesByName('test-timer:start', 'mark')
      const endMarks = performance.getEntriesByName('test-timer:end', 'mark')
      
      expect(startMarks.length).toBe(1)
      expect(endMarks.length).toBe(1)
    })
  })
})
