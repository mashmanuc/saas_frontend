// Tests for useDiagnostics composable
import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagnostics } from '@/modules/diagnostics/composables/useDiagnostics'

describe('useDiagnostics', () => {
  beforeEach(() => {
    const { clearLogs } = useDiagnostics()
    clearLogs()
  })

  describe('addLocalLog', () => {
    it('should add log to buffer', () => {
      const { addLocalLog, logs } = useDiagnostics()

      addLocalLog({
        timestamp: Date.now(),
        severity: 'error',
        message: 'Test error',
      })

      expect(logs.value.length).toBe(1)
      expect(logs.value[0].message).toBe('Test error')
      expect(logs.value[0].severity).toBe('error')
    })

    it('should add logs in reverse order (newest first)', () => {
      const { addLocalLog, logs } = useDiagnostics()

      addLocalLog({
        timestamp: Date.now(),
        severity: 'info',
        message: 'First',
      })

      addLocalLog({
        timestamp: Date.now(),
        severity: 'info',
        message: 'Second',
      })

      expect(logs.value[0].message).toBe('Second')
      expect(logs.value[1].message).toBe('First')
    })

    it('should assign unique IDs', () => {
      const { addLocalLog, logs } = useDiagnostics()

      addLocalLog({
        timestamp: Date.now(),
        severity: 'info',
        message: 'First',
      })

      addLocalLog({
        timestamp: Date.now(),
        severity: 'info',
        message: 'Second',
      })

      expect(logs.value[0].id).not.toBe(logs.value[1].id)
    })
  })

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      const { addLocalLog, clearLogs, logs } = useDiagnostics()

      addLocalLog({
        timestamp: Date.now(),
        severity: 'error',
        message: 'Test',
      })

      expect(logs.value.length).toBe(1)

      clearLogs()

      expect(logs.value.length).toBe(0)
    })
  })

  describe('panel state', () => {
    it('should toggle panel', () => {
      const { togglePanel, isPanelOpen } = useDiagnostics()

      expect(isPanelOpen.value).toBe(false)

      togglePanel()
      expect(isPanelOpen.value).toBe(true)

      togglePanel()
      expect(isPanelOpen.value).toBe(false)
    })

    it('should open panel', () => {
      const { openPanel, closePanel, isPanelOpen } = useDiagnostics()

      closePanel()
      expect(isPanelOpen.value).toBe(false)

      openPanel()
      expect(isPanelOpen.value).toBe(true)
    })

    it('should close panel', () => {
      const { openPanel, closePanel, isPanelOpen } = useDiagnostics()

      openPanel()
      expect(isPanelOpen.value).toBe(true)

      closePanel()
      expect(isPanelOpen.value).toBe(false)
    })
  })

  describe('filters', () => {
    it('should filter by severity', () => {
      const { addLocalLog, setFilter, filteredLogs, clearLogs } = useDiagnostics()

      clearLogs()

      addLocalLog({
        timestamp: Date.now(),
        severity: 'error',
        message: 'Error message',
      })

      addLocalLog({
        timestamp: Date.now(),
        severity: 'warning',
        message: 'Warning message',
      })

      addLocalLog({
        timestamp: Date.now(),
        severity: 'info',
        message: 'Info message',
      })

      setFilter('severity', 'error')

      expect(filteredLogs.value.length).toBe(1)
      expect(filteredLogs.value[0].severity).toBe('error')
    })

    it('should filter by service', () => {
      const { addLocalLog, setFilter, filteredLogs, clearLogs } = useDiagnostics()

      clearLogs()

      addLocalLog({
        timestamp: Date.now(),
        severity: 'error',
        message: 'WebRTC error',
        context: { service: 'classroom.webrtc' },
      })

      addLocalLog({
        timestamp: Date.now(),
        severity: 'error',
        message: 'Board error',
        context: { service: 'classroom.board' },
      })

      setFilter('service', 'webrtc')

      expect(filteredLogs.value.length).toBe(1)
      expect(filteredLogs.value[0].message).toBe('WebRTC error')
    })

    it('should show all when filter is null', () => {
      const { addLocalLog, setFilter, filteredLogs, clearLogs } = useDiagnostics()

      clearLogs()

      addLocalLog({
        timestamp: Date.now(),
        severity: 'error',
        message: 'Error',
      })

      addLocalLog({
        timestamp: Date.now(),
        severity: 'warning',
        message: 'Warning',
      })

      setFilter('severity', null)

      expect(filteredLogs.value.length).toBe(2)
    })
  })

  describe('logCounts', () => {
    it('should count logs by severity', () => {
      const { addLocalLog, logCounts, clearLogs } = useDiagnostics()

      clearLogs()

      addLocalLog({ timestamp: Date.now(), severity: 'error', message: 'E1' })
      addLocalLog({ timestamp: Date.now(), severity: 'error', message: 'E2' })
      addLocalLog({ timestamp: Date.now(), severity: 'warning', message: 'W1' })
      addLocalLog({ timestamp: Date.now(), severity: 'info', message: 'I1' })

      expect(logCounts.value.error).toBe(2)
      expect(logCounts.value.warning).toBe(1)
      expect(logCounts.value.info).toBe(1)
      expect(logCounts.value.total).toBe(4)
    })
  })
})
