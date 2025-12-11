interface PeerConnectionOptions {
  iceServers: RTCIceServer[]
  onIceCandidate: (candidate: RTCIceCandidate) => void
  onTrack: (stream: MediaStream) => void
  onStateChange: (state: RTCPeerConnectionState) => void
  maxReconnectAttempts?: number
  backoffBaseMs?: number
}

export class PeerConnection {
  private pc: RTCPeerConnection | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts: number
  private readonly backoffBaseMs: number

  constructor(private options: PeerConnectionOptions) {
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
    this.backoffBaseMs = options.backoffBaseMs ?? 1000
  }

  async create(): Promise<void> {
    this.pc = new RTCPeerConnection({
      iceServers: this.options.iceServers,
    })

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.onIceCandidate(event.candidate)
      }
    }

    this.pc.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) {
        this.options.onTrack(stream)
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.options.onStateChange(this.pc.connectionState)
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc && this.pc.iceConnectionState === 'failed') {
        this.options.onStateChange('failed')
      }
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('Peer connection not initialized')
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    await this.pc.setLocalDescription(offer)
    return offer
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('Peer connection not initialized')
    await this.pc.setRemoteDescription(offer)
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not initialized')
    await this.pc.setRemoteDescription(desc)
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) throw new Error('Peer connection not initialized')
    await this.pc.addIceCandidate(candidate)
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream): void {
    if (!this.pc) throw new Error('Peer connection not initialized')
    this.pc.addTrack(track, stream)
  }

  async reconnect(): Promise<boolean> {
    if (!this.pc) return false
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return false
    }

    this.reconnectAttempts += 1
    try {
      if (typeof this.pc.restartIce === 'function') {
        this.pc.restartIce()
        await new Promise((resolve) =>
          setTimeout(resolve, this.backoffBaseMs * Math.pow(2, this.reconnectAttempts - 1))
        )
        return true
      }
      return false
    } catch {
      return false
    }
  }

  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0
  }

  close(): void {
    this.pc?.close()
    this.pc = null
  }

  getStats(): Promise<RTCStatsReport> {
    if (!this.pc) {
      return Promise.reject(new Error('Peer connection not initialized'))
    }
    return this.pc.getStats()
  }
}

export default PeerConnection
