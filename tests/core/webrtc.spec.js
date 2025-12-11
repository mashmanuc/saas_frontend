import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SIGNALING_EVENTS, CALL_STATE, MEDIA_TYPE, MESSAGE_TYPE, ERROR_CODE } from '../../src/core/webrtc/events'
import { VIDEO_QUALITY, AUDIO_QUALITY, isMediaSupported, isScreenShareSupported } from '../../src/core/webrtc/media'

describe('WebRTC Events', () => {
  describe('SIGNALING_EVENTS', () => {
    it('has connection events', () => {
      expect(SIGNALING_EVENTS.CONNECTED).toBe('signaling:connected')
      expect(SIGNALING_EVENTS.DISCONNECTED).toBe('signaling:disconnected')
      expect(SIGNALING_EVENTS.RECONNECTING).toBe('signaling:reconnecting')
    })

    it('has call signaling events', () => {
      expect(SIGNALING_EVENTS.OFFER).toBe('call:offer')
      expect(SIGNALING_EVENTS.ANSWER).toBe('call:answer')
      expect(SIGNALING_EVENTS.ICE_CANDIDATE).toBe('call:ice-candidate')
    })

    it('has call control events', () => {
      expect(SIGNALING_EVENTS.CALL_REQUEST).toBe('call:request')
      expect(SIGNALING_EVENTS.CALL_ACCEPT).toBe('call:accept')
      expect(SIGNALING_EVENTS.CALL_END).toBe('call:end')
    })
  })

  describe('CALL_STATE', () => {
    it('has all call states', () => {
      expect(CALL_STATE.IDLE).toBe('idle')
      expect(CALL_STATE.CALLING).toBe('calling')
      expect(CALL_STATE.CONNECTED).toBe('connected')
      expect(CALL_STATE.ENDED).toBe('ended')
    })
  })

  describe('MEDIA_TYPE', () => {
    it('has media types', () => {
      expect(MEDIA_TYPE.AUDIO).toBe('audio')
      expect(MEDIA_TYPE.VIDEO).toBe('video')
      expect(MEDIA_TYPE.SCREEN).toBe('screen')
    })
  })

  describe('MESSAGE_TYPE', () => {
    it('has message types', () => {
      expect(MESSAGE_TYPE.OFFER).toBe('offer')
      expect(MESSAGE_TYPE.ANSWER).toBe('answer')
      expect(MESSAGE_TYPE.ICE).toBe('ice')
    })
  })

  describe('ERROR_CODE', () => {
    it('has error codes', () => {
      expect(ERROR_CODE.PERMISSION_DENIED).toBe('permission_denied')
      expect(ERROR_CODE.NOT_SUPPORTED).toBe('not_supported')
      expect(ERROR_CODE.NETWORK_ERROR).toBe('network_error')
    })
  })
})

describe('WebRTC Media', () => {
  describe('VIDEO_QUALITY', () => {
    it('has quality presets', () => {
      expect(VIDEO_QUALITY.LOW.width).toBe(320)
      expect(VIDEO_QUALITY.MEDIUM.width).toBe(640)
      expect(VIDEO_QUALITY.HIGH.width).toBe(1280)
      expect(VIDEO_QUALITY.HD.width).toBe(1920)
    })

    it('has frame rates', () => {
      expect(VIDEO_QUALITY.LOW.frameRate).toBe(15)
      expect(VIDEO_QUALITY.MEDIUM.frameRate).toBe(24)
      expect(VIDEO_QUALITY.HIGH.frameRate).toBe(30)
    })
  })

  describe('AUDIO_QUALITY', () => {
    it('has quality presets', () => {
      expect(AUDIO_QUALITY.LOW.sampleRate).toBe(16000)
      expect(AUDIO_QUALITY.MEDIUM.sampleRate).toBe(44100)
      expect(AUDIO_QUALITY.HIGH.sampleRate).toBe(48000)
    })

    it('has echo cancellation enabled', () => {
      expect(AUDIO_QUALITY.LOW.echoCancellation).toBe(true)
      expect(AUDIO_QUALITY.MEDIUM.echoCancellation).toBe(true)
      expect(AUDIO_QUALITY.HIGH.echoCancellation).toBe(true)
    })
  })

  describe('isMediaSupported', () => {
    it('returns boolean', () => {
      const result = isMediaSupported()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('isScreenShareSupported', () => {
    it('returns boolean', () => {
      const result = isScreenShareSupported()
      expect(typeof result).toBe('boolean')
    })
  })
})
