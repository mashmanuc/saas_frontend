import type { MediaConstraints, VideoQuality } from './types'

const VIDEO_CONSTRAINTS: Record<VideoQuality, MediaTrackConstraints> = {
  '240p': { width: 426, height: 240, frameRate: 15 },
  '480p': { width: 854, height: 480, frameRate: 24 },
  '720p': { width: 1280, height: 720, frameRate: 30 },
}

interface MediaManagerOptions {
  defaultQuality?: VideoQuality
  onStreamChange?: (stream: MediaStream | null) => void
  onError?: (error: Error) => void
}

export class MediaManager {
  private localStream: MediaStream | null = null
  private audioTrack: MediaStreamTrack | null = null
  private videoTrack: MediaStreamTrack | null = null
  private videoQuality: VideoQuality
  private audioEnabled = true
  private videoEnabled = true

  constructor(private options: MediaManagerOptions = {}) {
    this.videoQuality = options.defaultQuality ?? '480p'
  }

  async getUserMedia(constraints?: MediaConstraints): Promise<MediaStream> {
    const mediaConstraints = this.buildConstraints(constraints)
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
      this.audioTrack = this.localStream.getAudioTracks()[0] ?? null
      this.videoTrack = this.localStream.getVideoTracks()[0] ?? null

      this.setAudioEnabled(this.audioEnabled)
      this.setVideoEnabled(this.videoEnabled)

      this.options.onStreamChange?.(this.localStream)
      return this.localStream
    } catch (error) {
      this.options.onError?.(error as Error)
      throw error
    }
  }

  stopAllTracks(): void {
    this.localStream?.getTracks().forEach((track) => track.stop())
    this.localStream = null
    this.audioTrack = null
    this.videoTrack = null
    this.options.onStreamChange?.(null)
  }

  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled
    if (this.audioTrack) {
      this.audioTrack.enabled = enabled
    }
  }

  setVideoEnabled(enabled: boolean): void {
    this.videoEnabled = enabled
    if (this.videoTrack) {
      this.videoTrack.enabled = enabled
    }
  }

  toggleAudio(): boolean {
    this.setAudioEnabled(!this.audioEnabled)
    return this.audioEnabled
  }

  toggleVideo(): boolean {
    this.setVideoEnabled(!this.videoEnabled)
    return this.videoEnabled
  }

  async setVideoQuality(quality: VideoQuality): Promise<void> {
    if (!this.videoTrack) {
      this.videoQuality = quality
      return
    }

    this.videoQuality = quality
    try {
      await this.videoTrack.applyConstraints(VIDEO_CONSTRAINTS[quality])
    } catch (error) {
      this.options.onError?.(error as Error)
      throw error
    }
  }

  getCurrentConstraints(): MediaConstraints {
    return this.buildConstraints()
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  private buildConstraints(constraints?: MediaConstraints): MediaConstraints {
    return {
      audio: constraints?.audio ?? true,
      video: constraints?.video ?? {
        ...VIDEO_CONSTRAINTS[this.videoQuality],
        facingMode: 'user',
      },
    }
  }
}

export default MediaManager
