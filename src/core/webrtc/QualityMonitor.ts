import type { QualityMetrics, VideoQuality } from './types'
import type { PeerConnection } from './PeerConnection'

type MetricsHandler = (metrics: QualityMetrics) => void
type RecommendationHandler = (quality: VideoQuality) => void

const QUALITY_THRESHOLDS: Record<VideoQuality, { bitrate: number; packetLoss: number }> = {
  '720p': { bitrate: 1500, packetLoss: 2 },
  '480p': { bitrate: 800, packetLoss: 4 },
  '240p': { bitrate: 300, packetLoss: 8 },
}

export class QualityMonitor {
  private intervalId: number | null = null
  private metricsHistory: QualityMetrics[] = []

  constructor(
    private peerConnection: PeerConnection,
    private onMetricsUpdate: MetricsHandler,
    private onQualityRecommendation: RecommendationHandler
  ) {}

  start(intervalMs = 5000): void {
    this.stop()
    this.intervalId = window.setInterval(() => {
      void this.collectStats()
    }, intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  getCurrentMetrics(): QualityMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] ?? null
  }

  getAverageMetrics(): QualityMetrics | null {
    if (this.metricsHistory.length === 0) return null
    const sum = this.metricsHistory.reduce(
      (acc, metric) => ({
        timestamp: metric.timestamp,
        rtt: acc.rtt + metric.rtt,
        packetLoss: acc.packetLoss + metric.packetLoss,
        jitter: acc.jitter + metric.jitter,
        audioBitrate: acc.audioBitrate + metric.audioBitrate,
        videoBitrate: acc.videoBitrate + metric.videoBitrate,
        videoResolution: metric.videoResolution,
        quality: metric.quality,
      }),
      {
        timestamp: Date.now(),
        rtt: 0,
        packetLoss: 0,
        jitter: 0,
        audioBitrate: 0,
        videoBitrate: 0,
        videoResolution: '',
        quality: 'good' as QualityMetrics['quality'],
      }
    )

    const count = this.metricsHistory.length
    return {
      ...sum,
      rtt: sum.rtt / count,
      packetLoss: sum.packetLoss / count,
      jitter: sum.jitter / count,
      audioBitrate: sum.audioBitrate / count,
      videoBitrate: sum.videoBitrate / count,
    }
  }

  private async collectStats(): Promise<void> {
    const statsReport = await this.peerConnection.getStats()
    const metrics: QualityMetrics = {
      timestamp: Date.now(),
      rtt: 0,
      packetLoss: 0,
      jitter: 0,
      audioBitrate: 0,
      videoBitrate: 0,
      videoResolution: '',
      quality: 'good',
    }

    statsReport.forEach((report) => {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        metrics.videoBitrate = report.bitrateMean ?? metrics.videoBitrate
        metrics.packetLoss = report.packetsLost ?? metrics.packetLoss
        const resolution = `${report.frameWidth ?? 0}x${report.frameHeight ?? 0}`
        metrics.videoResolution = resolution
      }
      if (report.type === 'outbound-rtp' && report.kind === 'audio') {
        metrics.audioBitrate = report.bitrateMean ?? metrics.audioBitrate
      }
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        metrics.rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : metrics.rtt
        metrics.jitter = report.availableOutgoingBitrate ?? metrics.jitter
      }
    })

    metrics.quality = this.calculateQuality(metrics)
    this.metricsHistory.push(metrics)
    if (this.metricsHistory.length > 50) {
      this.metricsHistory.shift()
    }

    this.onMetricsUpdate(metrics)

    const recommended = this.calculateRecommendedQuality(metrics)
    this.onQualityRecommendation(recommended)
  }

  private calculateQuality(metrics: QualityMetrics): QualityMetrics['quality'] {
    if (metrics.packetLoss > 10 || metrics.rtt > 400) {
      return 'poor'
    }
    if (metrics.packetLoss > 5 || metrics.rtt > 250) {
      return 'fair'
    }
    if (metrics.packetLoss > 2 || metrics.rtt > 150) {
      return 'good'
    }
    return 'excellent'
  }

  private calculateRecommendedQuality(metrics: QualityMetrics): VideoQuality {
    for (const quality of ['720p', '480p', '240p'] as VideoQuality[]) {
      const thresholds = QUALITY_THRESHOLDS[quality]
      if (metrics.videoBitrate >= thresholds.bitrate && metrics.packetLoss <= thresholds.packetLoss) {
        return quality
      }
    }
    return '240p'
  }
}

export default QualityMonitor
