import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Security Fixes', () => {
  describe('VectorClock', () => {
    it('creates with initial values', async () => {
      const { VectorClock } = await import('../../src/core/board/VectorClock')
      const clock = new VectorClock('node1', { node1: 5, node2: 3 })

      expect(clock.getTime('node1')).toBe(5n)
      expect(clock.getTime('node2')).toBe(3n)
    })

    it('increments local time', async () => {
      const { VectorClock } = await import('../../src/core/board/VectorClock')
      const clock = new VectorClock('node1')

      clock.increment()
      expect(clock.getLocalTime()).toBe(1n)

      clock.increment()
      expect(clock.getLocalTime()).toBe(2n)
    })

    it('merges clocks correctly', async () => {
      const { VectorClock } = await import('../../src/core/board/VectorClock')
      const clock1 = new VectorClock('node1', { node1: 5, node2: 3 })
      const clock2 = new VectorClock('node2', { node1: 3, node2: 7 })

      clock1.merge(clock2)

      expect(clock1.getTime('node1')).toBe(5n)
      expect(clock1.getTime('node2')).toBe(7n)
    })

    it('detects happens-before relationship', async () => {
      const { VectorClock } = await import('../../src/core/board/VectorClock')
      const clock1 = new VectorClock('node1', { node1: 3, node2: 2 })
      const clock2 = new VectorClock('node2', { node1: 5, node2: 4 })

      expect(clock1.happensBefore(clock2)).toBe(true)
      expect(clock2.happensBefore(clock1)).toBe(false)
    })

    it('detects concurrent clocks', async () => {
      const { VectorClock } = await import('../../src/core/board/VectorClock')
      const clock1 = new VectorClock('node1', { node1: 5, node2: 2 })
      const clock2 = new VectorClock('node2', { node1: 3, node2: 4 })

      expect(clock1.isConcurrent(clock2)).toBe(true)
    })

    it('serializes to JSON with string values', async () => {
      const { VectorClock } = await import('../../src/core/board/VectorClock')
      const clock = new VectorClock('node1', { node1: 9007199254740993n })

      const json = clock.toJSON()
      expect(json.node1).toBe('9007199254740993')
    })

    it('deserializes from JSON', async () => {
      const { VectorClock } = await import('../../src/core/board/VectorClock')
      const clock = VectorClock.fromJSON('node1', { node1: '9007199254740993', node2: '5' })

      expect(clock.getTime('node1')).toBe(9007199254740993n)
      expect(clock.getTime('node2')).toBe(5n)
    })

    it('handles BigInt overflow prevention', async () => {
      const { VectorClock } = await import('../../src/core/board/VectorClock')
      const largeValue = BigInt(Number.MAX_SAFE_INTEGER) + 1000n
      const clock = new VectorClock('node1', { node1: largeValue })

      clock.increment()
      expect(clock.getLocalTime()).toBe(largeValue + 1n)
    })
  })

  describe('Input Sanitization', () => {
    it('sanitizes text content', async () => {
      const { sanitizeText } = await import('../../src/core/board/utils/sanitize')

      expect(sanitizeText('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      )
    })

    it('sanitizes HTML entities', async () => {
      const { sanitizeText } = await import('../../src/core/board/utils/sanitize')

      expect(sanitizeText('Hello & "World"')).toBe('Hello &amp; &quot;World&quot;')
    })

    it('validates HTTPS URLs', async () => {
      const { validateImageUrl } = await import('../../src/core/board/utils/sanitize')

      expect(validateImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png')
      expect(validateImageUrl('http://example.com/image.png')).toBe('')
    })

    it('allows internal paths', async () => {
      const { validateImageUrl } = await import('../../src/core/board/utils/sanitize')

      expect(validateImageUrl('/media/images/photo.jpg')).toBe('/media/images/photo.jpg')
      expect(validateImageUrl('/static/assets/logo.png')).toBe('/static/assets/logo.png')
    })

    it('blocks internal IPs', async () => {
      const { validateImageUrl } = await import('../../src/core/board/utils/sanitize')

      expect(validateImageUrl('https://localhost/image.png')).toBe('')
      expect(validateImageUrl('https://127.0.0.1/image.png')).toBe('')
      expect(validateImageUrl('https://192.168.1.1/image.png')).toBe('')
      expect(validateImageUrl('https://10.0.0.1/image.png')).toBe('')
    })

    it('allows data URLs for images', async () => {
      const { validateImageUrl } = await import('../../src/core/board/utils/sanitize')

      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      expect(validateImageUrl(dataUrl)).toBe(dataUrl)
    })

    it('sanitizes component data based on type', async () => {
      const { sanitizeComponentData } = await import('../../src/core/board/utils/sanitize')

      const textData = sanitizeComponentData('text', {
        content: '<script>alert("xss")</script>',
      })
      expect(textData.content).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')

      const imageData = sanitizeComponentData('image', {
        url: 'http://evil.com/image.png',
      })
      expect(imageData.url).toBe('')
    })

    it('validates file types', async () => {
      const { validateFileType } = await import('../../src/core/board/utils/sanitize')

      const pngFile = new File([''], 'test.png', { type: 'image/png' })
      const jsFile = new File([''], 'test.js', { type: 'application/javascript' })

      expect(validateFileType(pngFile, ['image/png', 'image/jpeg'])).toBe(true)
      expect(validateFileType(jsFile, ['image/png', 'image/jpeg'])).toBe(false)
    })

    it('validates file size', async () => {
      const { validateFileSize } = await import('../../src/core/board/utils/sanitize')

      const smallFile = new File(['x'.repeat(100)], 'small.txt')
      const largeFile = new File(['x'.repeat(1000000)], 'large.txt')

      expect(validateFileSize(smallFile, 1000)).toBe(true)
      expect(validateFileSize(largeFile, 1000)).toBe(false)
    })
  })

  describe('OfflineManager Overflow', () => {
    it('handles queue overflow', async () => {
      const { OfflineManager } = await import('../../src/core/board/OfflineManager')
      const manager = new OfflineManager('test-session')

      // Fill queue to max
      for (let i = 0; i < 1000; i++) {
        manager.queueOperation({ type: 'create', componentId: `comp${i}` })
      }

      // Next operation should trigger overflow
      const overflowHandler = vi.fn()
      manager.events.on('queue-overflow', overflowHandler)

      const result = manager.queueOperation({ type: 'create', componentId: 'overflow' })

      expect(result).toBe(false)
      expect(overflowHandler).toHaveBeenCalled()
    })

    it('tracks overflow count', async () => {
      const { OfflineManager } = await import('../../src/core/board/OfflineManager')
      const manager = new OfflineManager('test-session')

      // Fill queue
      for (let i = 0; i < 1000; i++) {
        manager.queueOperation({ type: 'create', componentId: `comp${i}` })
      }

      // Trigger overflow
      manager.queueOperation({ type: 'create', componentId: 'overflow1' })
      manager.queueOperation({ type: 'create', componentId: 'overflow2' })

      const status = manager.getOverflowStatus()
      expect(status.hasOverflow).toBe(true)
      expect(status.count).toBe(2)
    })
  })
})
