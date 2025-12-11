/**
 * WebRTC Media Manager — v0.16.0
 * getUserMedia wrapper, video/audio toggle, quality control
 */

import { MEDIA_TYPE, ERROR_CODE } from './events'

/**
 * Video quality presets
 */
export const VIDEO_QUALITY = {
  LOW: {
    width: 320,
    height: 240,
    frameRate: 15,
  },
  MEDIUM: {
    width: 640,
    height: 480,
    frameRate: 24,
  },
  HIGH: {
    width: 1280,
    height: 720,
    frameRate: 30,
  },
  HD: {
    width: 1920,
    height: 1080,
    frameRate: 30,
  },
}

/**
 * Audio quality presets
 */
export const AUDIO_QUALITY = {
  LOW: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000,
  },
  MEDIUM: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
  },
  HIGH: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
  },
}

/**
 * Check if media devices are supported
 */
export function isMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}

/**
 * Check if screen sharing is supported
 */
export function isScreenShareSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
}

/**
 * Get available media devices
 */
export async function getMediaDevices() {
  if (!isMediaSupported()) {
    throw new Error('Media devices not supported')
  }
  
  const devices = await navigator.mediaDevices.enumerateDevices()
  
  return {
    audioInputs: devices.filter(d => d.kind === 'audioinput'),
    audioOutputs: devices.filter(d => d.kind === 'audiooutput'),
    videoInputs: devices.filter(d => d.kind === 'videoinput'),
  }
}

/**
 * WebRTC Media Manager
 */
export class MediaManager {
  constructor(options = {}) {
    this.localStream = null
    this.screenStream = null
    this.videoQuality = options.videoQuality || VIDEO_QUALITY.MEDIUM
    this.audioQuality = options.audioQuality || AUDIO_QUALITY.MEDIUM
    
    // Track states
    this.isAudioEnabled = true
    this.isVideoEnabled = true
    this.isScreenSharing = false
    
    // Device IDs
    this.audioDeviceId = options.audioDeviceId || null
    this.videoDeviceId = options.videoDeviceId || null
    
    // Callbacks
    this.onStreamChange = options.onStreamChange || (() => {})
    this.onError = options.onError || (() => {})
  }

  /**
   * Get user media (camera + microphone)
   */
  async getUserMedia(options = {}) {
    if (!isMediaSupported()) {
      const error = { code: ERROR_CODE.NOT_SUPPORTED, message: 'Media devices not supported' }
      this.onError(error)
      throw error
    }
    
    const constraints = {
      audio: this.buildAudioConstraints(options.audio),
      video: options.video !== false ? this.buildVideoConstraints(options.video) : false,
    }
    
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Set initial track states
      this.setAudioEnabled(this.isAudioEnabled)
      this.setVideoEnabled(this.isVideoEnabled)
      
      this.onStreamChange(this.localStream, MEDIA_TYPE.VIDEO)
      
      return this.localStream
    } catch (error) {
      const wrappedError = this.wrapMediaError(error)
      this.onError(wrappedError)
      throw wrappedError
    }
  }

  /**
   * Get screen share stream
   */
  async getScreenShare(options = {}) {
    if (!isScreenShareSupported()) {
      const error = { code: ERROR_CODE.NOT_SUPPORTED, message: 'Screen sharing not supported' }
      this.onError(error)
      throw error
    }
    
    const constraints = {
      video: {
        cursor: 'always',
        displaySurface: options.displaySurface || 'monitor',
        ...options.video,
      },
      audio: options.audio || false,
    }
    
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints)
      this.isScreenSharing = true
      
      // Listen for screen share end (user clicks "Stop sharing")
      const videoTrack = this.screenStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenShare()
        }
      }
      
      this.onStreamChange(this.screenStream, MEDIA_TYPE.SCREEN)
      
      return this.screenStream
    } catch (error) {
      const wrappedError = this.wrapMediaError(error)
      this.onError(wrappedError)
      throw wrappedError
    }
  }

  /**
   * Stop screen sharing
   */
  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop())
      this.screenStream = null
    }
    this.isScreenSharing = false
    this.onStreamChange(null, MEDIA_TYPE.SCREEN)
  }

  /**
   * Toggle audio
   */
  toggleAudio() {
    this.isAudioEnabled = !this.isAudioEnabled
    this.setAudioEnabled(this.isAudioEnabled)
    return this.isAudioEnabled
  }

  /**
   * Set audio enabled state
   */
  setAudioEnabled(enabled) {
    this.isAudioEnabled = enabled
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled
      })
    }
  }

  /**
   * Toggle video
   */
  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled
    this.setVideoEnabled(this.isVideoEnabled)
    return this.isVideoEnabled
  }

  /**
   * Set video enabled state
   */
  setVideoEnabled(enabled) {
    this.isVideoEnabled = enabled
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled
      })
    }
  }

  /**
   * Set video quality
   */
  async setVideoQuality(quality) {
    this.videoQuality = VIDEO_QUALITY[quality] || quality
    
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        try {
          await videoTrack.applyConstraints({
            width: { ideal: this.videoQuality.width },
            height: { ideal: this.videoQuality.height },
            frameRate: { ideal: this.videoQuality.frameRate },
          })
        } catch (error) {
          console.warn('[media] failed to apply video constraints:', error)
        }
      }
    }
  }

  /**
   * Switch audio device
   */
  async switchAudioDevice(deviceId) {
    this.audioDeviceId = deviceId
    
    if (this.localStream) {
      // Stop current audio track
      this.localStream.getAudioTracks().forEach(track => track.stop())
      
      // Get new audio track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: this.buildAudioConstraints({ deviceId }),
        })
        
        const newAudioTrack = newStream.getAudioTracks()[0]
        if (newAudioTrack) {
          // Remove old audio tracks
          this.localStream.getAudioTracks().forEach(track => {
            this.localStream.removeTrack(track)
          })
          
          // Add new audio track
          this.localStream.addTrack(newAudioTrack)
          newAudioTrack.enabled = this.isAudioEnabled
        }
        
        this.onStreamChange(this.localStream, MEDIA_TYPE.AUDIO)
      } catch (error) {
        const wrappedError = this.wrapMediaError(error)
        this.onError(wrappedError)
        throw wrappedError
      }
    }
  }

  /**
   * Switch video device
   */
  async switchVideoDevice(deviceId) {
    this.videoDeviceId = deviceId
    
    if (this.localStream) {
      // Stop current video track
      this.localStream.getVideoTracks().forEach(track => track.stop())
      
      // Get new video track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: this.buildVideoConstraints({ deviceId }),
        })
        
        const newVideoTrack = newStream.getVideoTracks()[0]
        if (newVideoTrack) {
          // Remove old video tracks
          this.localStream.getVideoTracks().forEach(track => {
            this.localStream.removeTrack(track)
          })
          
          // Add new video track
          this.localStream.addTrack(newVideoTrack)
          newVideoTrack.enabled = this.isVideoEnabled
        }
        
        this.onStreamChange(this.localStream, MEDIA_TYPE.VIDEO)
      } catch (error) {
        const wrappedError = this.wrapMediaError(error)
        this.onError(wrappedError)
        throw wrappedError
      }
    }
  }

  /**
   * Build audio constraints
   */
  buildAudioConstraints(options = {}) {
    if (options === false) return false
    
    return {
      deviceId: options.deviceId || this.audioDeviceId || undefined,
      ...this.audioQuality,
      ...options,
    }
  }

  /**
   * Build video constraints
   */
  buildVideoConstraints(options = {}) {
    if (options === false) return false
    
    return {
      deviceId: options.deviceId || this.videoDeviceId || undefined,
      width: { ideal: this.videoQuality.width },
      height: { ideal: this.videoQuality.height },
      frameRate: { ideal: this.videoQuality.frameRate },
      facingMode: options.facingMode || 'user',
      ...options,
    }
  }

  /**
   * Wrap media error with code
   */
  wrapMediaError(error) {
    let code = ERROR_CODE.UNKNOWN
    let message = error.message || 'Unknown error'
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      code = ERROR_CODE.PERMISSION_DENIED
      message = 'Permission denied to access media devices'
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      code = ERROR_CODE.NOT_SUPPORTED
      message = 'No media devices found'
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      code = ERROR_CODE.UNKNOWN
      message = 'Media device is already in use'
    } else if (error.name === 'OverconstrainedError') {
      code = ERROR_CODE.NOT_SUPPORTED
      message = 'Media constraints cannot be satisfied'
    }
    
    return { code, message, originalError: error }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      hasLocalStream: !!this.localStream,
      hasScreenStream: !!this.screenStream,
      isAudioEnabled: this.isAudioEnabled,
      isVideoEnabled: this.isVideoEnabled,
      isScreenSharing: this.isScreenSharing,
      videoQuality: this.videoQuality,
    }
  }

  /**
   * Stop all streams
   */
  stopAllStreams() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }
    
    this.stopScreenShare()
  }

  /**
   * Destroy manager
   */
  destroy() {
    this.stopAllStreams()
    this.onStreamChange = () => {}
    this.onError = () => {}
  }
}

/**
 * Create media manager
 */
export function createMediaManager(options = {}) {
  return new MediaManager(options)
}

export default {
  MediaManager,
  createMediaManager,
  VIDEO_QUALITY,
  AUDIO_QUALITY,
  isMediaSupported,
  isScreenShareSupported,
  getMediaDevices,
}
