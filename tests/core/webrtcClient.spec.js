import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = 1
    this.onopen = null
    this.onclose = null
    this.onmessage = null
    this.onerror = null
    setTimeout(() => this.onopen?.(), 0)
  }
  send(data) {}
  close() {
    this.readyState = 3
    this.onclose?.({ wasClean: true })
  }
}

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  constructor() {
    this.connectionState = 'new'
    this.iceConnectionState = 'new'
    this.onicecandidate = null
    this.ontrack = null
    this.onconnectionstatechange = null
    this.oniceconnectionstatechange = null
  }
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'mock-sdp' })
  }
  createAnswer() {
    return Promise.resolve({ type: 'answer', sdp: 'mock-sdp' })
  }
  setLocalDescription(desc) {
    return Promise.resolve()
  }
  setRemoteDescription(desc) {
    return Promise.resolve()
  }
  addIceCandidate(candidate) {
    return Promise.resolve()
  }
  addTrack(track, stream) {}
  getStats() {
    return Promise.resolve(new Map())
  }
  restartIce() {}
  close() {
    this.connectionState = 'closed'
  }
}

// Mock navigator.mediaDevices
const mockMediaStream = {
  getTracks: () => [
    { kind: 'audio', enabled: true, stop: vi.fn() },
    { kind: 'video', enabled: true, stop: vi.fn() },
  ],
  getAudioTracks: () => [{ kind: 'audio', enabled: true, stop: vi.fn() }],
  getVideoTracks: () => [{ kind: 'video', enabled: true, stop: vi.fn(), applyConstraints: vi.fn() }],
}

vi.stubGlobal('WebSocket', MockWebSocket)
vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection)
vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
  },
})

describe('WebRTC SDK', () => {
  describe('PeerConnection', () => {
    it('creates RTCPeerConnection with ICE servers', async () => {
      const { PeerConnection } = await import('../../src/core/webrtc/PeerConnection')
      
      const onIceCandidate = vi.fn()
      const onTrack = vi.fn()
      const onStateChange = vi.fn()
      
      const pc = new PeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        onIceCandidate,
        onTrack,
        onStateChange,
      })
      
      await pc.create()
      expect(pc).toBeDefined()
    })

    it('creates offer', async () => {
      const { PeerConnection } = await import('../../src/core/webrtc/PeerConnection')
      
      const pc = new PeerConnection({
        iceServers: [],
        onIceCandidate: vi.fn(),
        onTrack: vi.fn(),
        onStateChange: vi.fn(),
      })
      
      await pc.create()
      const offer = await pc.createOffer()
      
      expect(offer.type).toBe('offer')
      expect(offer.sdp).toBe('mock-sdp')
    })

    it('creates answer from offer', async () => {
      const { PeerConnection } = await import('../../src/core/webrtc/PeerConnection')
      
      const pc = new PeerConnection({
        iceServers: [],
        onIceCandidate: vi.fn(),
        onTrack: vi.fn(),
        onStateChange: vi.fn(),
      })
      
      await pc.create()
      const answer = await pc.createAnswer({ type: 'offer', sdp: 'remote-sdp' })
      
      expect(answer.type).toBe('answer')
    })

    it('closes connection', async () => {
      const { PeerConnection } = await import('../../src/core/webrtc/PeerConnection')
      
      const pc = new PeerConnection({
        iceServers: [],
        onIceCandidate: vi.fn(),
        onTrack: vi.fn(),
        onStateChange: vi.fn(),
      })
      
      await pc.create()
      pc.close()
      
      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('MediaManager', () => {
    it('gets user media', async () => {
      const { MediaManager } = await import('../../src/core/webrtc/MediaManager')
      
      const manager = new MediaManager({ defaultQuality: '480p' })
      const stream = await manager.getUserMedia()
      
      expect(stream).toBeDefined()
      expect(stream.getTracks().length).toBeGreaterThan(0)
    })

    it('toggles audio', async () => {
      const { MediaManager } = await import('../../src/core/webrtc/MediaManager')
      
      const manager = new MediaManager()
      await manager.getUserMedia()
      
      const enabled = manager.toggleAudio()
      expect(typeof enabled).toBe('boolean')
    })

    it('toggles video', async () => {
      const { MediaManager } = await import('../../src/core/webrtc/MediaManager')
      
      const manager = new MediaManager()
      await manager.getUserMedia()
      
      const enabled = manager.toggleVideo()
      expect(typeof enabled).toBe('boolean')
    })

    it('stops all tracks', async () => {
      const { MediaManager } = await import('../../src/core/webrtc/MediaManager')
      
      const manager = new MediaManager()
      await manager.getUserMedia()
      
      manager.stopAllTracks()
      expect(manager.getLocalStream()).toBeNull()
    })
  })

  describe('SignalingChannel', () => {
    it('connects to signaling server', async () => {
      const { SignalingChannel } = await import('../../src/core/webrtc/SignalingChannel')
      
      const handlers = {
        onOffer: vi.fn(),
        onAnswer: vi.fn(),
        onIceCandidate: vi.fn(),
        onPeerJoined: vi.fn(),
        onPeerLeft: vi.fn(),
        onPeerMuted: vi.fn(),
        onError: vi.fn(),
      }
      
      const channel = new SignalingChannel('ws://localhost:8080', 'token', handlers)
      await channel.connect('session-123')
      
      // Should not throw
      expect(true).toBe(true)
    })

    it('sends offer', async () => {
      const { SignalingChannel } = await import('../../src/core/webrtc/SignalingChannel')
      
      const handlers = {
        onOffer: vi.fn(),
        onAnswer: vi.fn(),
        onIceCandidate: vi.fn(),
        onPeerJoined: vi.fn(),
        onPeerLeft: vi.fn(),
        onPeerMuted: vi.fn(),
        onError: vi.fn(),
      }
      
      const channel = new SignalingChannel('ws://localhost:8080', 'token', handlers)
      await channel.connect('session-123')
      
      channel.sendOffer({ type: 'offer', sdp: 'test-sdp' })
      // Should not throw
      expect(true).toBe(true)
    })

    it('disconnects', async () => {
      const { SignalingChannel } = await import('../../src/core/webrtc/SignalingChannel')
      
      const handlers = {
        onOffer: vi.fn(),
        onAnswer: vi.fn(),
        onIceCandidate: vi.fn(),
        onPeerJoined: vi.fn(),
        onPeerLeft: vi.fn(),
        onPeerMuted: vi.fn(),
        onError: vi.fn(),
      }
      
      const channel = new SignalingChannel('ws://localhost:8080', 'token', handlers)
      await channel.connect('session-123')
      
      channel.disconnect()
      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('QualityMonitor', () => {
    it('starts and stops monitoring', async () => {
      const { QualityMonitor } = await import('../../src/core/webrtc/QualityMonitor')
      const { PeerConnection } = await import('../../src/core/webrtc/PeerConnection')
      
      const pc = new PeerConnection({
        iceServers: [],
        onIceCandidate: vi.fn(),
        onTrack: vi.fn(),
        onStateChange: vi.fn(),
      })
      await pc.create()
      
      const onMetrics = vi.fn()
      const onRecommendation = vi.fn()
      
      const monitor = new QualityMonitor(pc, onMetrics, onRecommendation)
      monitor.start(100)
      
      // Wait for at least one collection
      await new Promise(resolve => setTimeout(resolve, 150))
      
      monitor.stop()
      
      expect(onMetrics).toHaveBeenCalled()
    })

    it('returns current metrics', async () => {
      const { QualityMonitor } = await import('../../src/core/webrtc/QualityMonitor')
      const { PeerConnection } = await import('../../src/core/webrtc/PeerConnection')
      
      const pc = new PeerConnection({
        iceServers: [],
        onIceCandidate: vi.fn(),
        onTrack: vi.fn(),
        onStateChange: vi.fn(),
      })
      await pc.create()
      
      const monitor = new QualityMonitor(pc, vi.fn(), vi.fn())
      
      // Before any collection
      expect(monitor.getCurrentMetrics()).toBeNull()
    })
  })

  describe('EventEmitter', () => {
    it('emits and receives events', async () => {
      const { EventEmitter } = await import('../../src/core/webrtc/eventEmitter')
      
      const emitter = new EventEmitter()
      const handler = vi.fn()
      
      emitter.on('test', handler)
      emitter.emit('test', 'data')
      
      expect(handler).toHaveBeenCalledWith('data')
    })

    it('removes event listener', async () => {
      const { EventEmitter } = await import('../../src/core/webrtc/eventEmitter')
      
      const emitter = new EventEmitter()
      const handler = vi.fn()
      
      const unsubscribe = emitter.on('test', handler)
      unsubscribe()
      emitter.emit('test', 'data')
      
      expect(handler).not.toHaveBeenCalled()
    })

    it('removes all listeners', async () => {
      const { EventEmitter } = await import('../../src/core/webrtc/eventEmitter')
      
      const emitter = new EventEmitter()
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      emitter.on('test1', handler1)
      emitter.on('test2', handler2)
      emitter.removeAll()
      
      emitter.emit('test1', 'data')
      emitter.emit('test2', 'data')
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })
})
