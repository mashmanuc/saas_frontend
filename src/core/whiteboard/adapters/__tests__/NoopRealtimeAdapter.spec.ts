/**
 * Unit tests for NoopRealtimeAdapter
 * Coverage target: ≥90%
 */

import { describe, it, expect, vi } from 'vitest'
import { NoopRealtimeAdapter } from '../NoopRealtimeAdapter'

describe('NoopRealtimeAdapter', () => {
  it('should connect successfully', async () => {
    const adapter = new NoopRealtimeAdapter()
    
    await adapter.connect('workspace-123', 'user-456')
    
    expect(adapter.isConnected()).toBe(true)
  })
  
  it('should disconnect successfully', async () => {
    const adapter = new NoopRealtimeAdapter()
    
    await adapter.connect('workspace-123', 'user-456')
    adapter.disconnect()
    
    expect(adapter.isConnected()).toBe(false)
  })
  
  it('should return empty presence list', () => {
    const adapter = new NoopRealtimeAdapter()
    
    const presence = adapter.getPresence()
    
    expect(presence).toEqual([])
  })
  
  it('should accept presence change callback without error', () => {
    const adapter = new NoopRealtimeAdapter()
    const callback = vi.fn()
    
    adapter.onPresenceChange(callback)
    
    expect(callback).not.toHaveBeenCalled()
  })
  
  it('should accept cursor move without error', () => {
    const adapter = new NoopRealtimeAdapter()
    
    expect(() => {
      adapter.sendCursorMove(100, 200, 'pen', '#000000')
    }).not.toThrow()
  })
  
  it('should accept cursor move callback without error', () => {
    const adapter = new NoopRealtimeAdapter()
    const callback = vi.fn()
    
    adapter.onCursorMove(callback)
    
    expect(callback).not.toHaveBeenCalled()
  })
  
  it('should accept operation without error', async () => {
    const adapter = new NoopRealtimeAdapter()
    
    await expect(
      adapter.sendOperation({
        type: 'stroke_add',
        pageId: 'page-123',
        data: { points: [[0, 0]] },
        userId: 'user-456',
        timestamp: Date.now(),
        version: 1
      })
    ).resolves.toBeUndefined()
  })
  
  it('should accept operation callback without error', () => {
    const adapter = new NoopRealtimeAdapter()
    const callback = vi.fn()
    
    adapter.onOperation(callback)
    
    expect(callback).not.toHaveBeenCalled()
  })
  
  it('should accept page switch without error', () => {
    const adapter = new NoopRealtimeAdapter()
    
    expect(() => {
      adapter.broadcastPageSwitch('page-123')
    }).not.toThrow()
  })
  
  it('should accept page switch callback without error', () => {
    const adapter = new NoopRealtimeAdapter()
    const callback = vi.fn()
    
    adapter.onPageSwitch(callback)
    
    expect(callback).not.toHaveBeenCalled()
  })
  
  it('should clear presence on disconnect', async () => {
    const adapter = new NoopRealtimeAdapter()
    
    await adapter.connect('workspace-123', 'user-456')
    adapter.disconnect()
    
    expect(adapter.getPresence()).toEqual([])
  })
  
  it('should be disconnected initially', () => {
    const adapter = new NoopRealtimeAdapter()
    
    expect(adapter.isConnected()).toBe(false)
  })
})
