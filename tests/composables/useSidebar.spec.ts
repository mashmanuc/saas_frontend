import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSidebar } from '@/composables/useSidebar'

describe('useSidebar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to not collapsed', () => {
    const { collapsed } = useSidebar()
    expect(collapsed.value).toBe(false)
  })

  it('defaults to mobile closed', () => {
    const { mobileOpen } = useSidebar()
    expect(mobileOpen.value).toBe(false)
  })

  it('toggleCollapse flips state', () => {
    const { collapsed, toggleCollapse } = useSidebar()
    expect(collapsed.value).toBe(false)
    toggleCollapse()
    expect(collapsed.value).toBe(true)
    toggleCollapse()
    expect(collapsed.value).toBe(false)
  })

  it('saves collapsed state to localStorage', () => {
    const { toggleCollapse } = useSidebar()
    toggleCollapse()
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true')
  })

  it('restores collapsed state from localStorage', () => {
    localStorage.setItem('sidebar-collapsed', 'true')
    const { collapsed, initFromStorage } = useSidebar()
    initFromStorage()
    expect(collapsed.value).toBe(true)
  })

  it('openMobile / closeMobile', () => {
    const { mobileOpen, openMobile, closeMobile } = useSidebar()
    openMobile()
    expect(mobileOpen.value).toBe(true)
    closeMobile()
    expect(mobileOpen.value).toBe(false)
  })
})
