/**
 * WebRTC diagnostics integration.
 */
import { diagnosticsApi } from '../api/diagnostics'

export function useWebRTCDiagnostics(sessionId: string) {
  /**
   * Setup diagnostics for PeerConnection.
   */
  function setupPeerConnectionDiagnostics(pc: RTCPeerConnection): void {
    // ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState

      if (state === 'failed' || state === 'disconnected') {
        diagnosticsApi.queueError({
          severity: state === 'failed' ? 'error' : 'warning',
          message: `WebRTC ICE connection ${state}`,
          url: window.location.href,
          sessionId,
          appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
          context: {
            service: 'classroom.webrtc',
            iceConnectionState: state,
            connectionState: pc.connectionState,
            signalingState: pc.signalingState,
          },
        })
      }
    }

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState

      if (state === 'failed') {
        diagnosticsApi.queueError({
          severity: 'error',
          message: 'WebRTC connection failed',
          url: window.location.href,
          sessionId,
          appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
          context: {
            service: 'classroom.webrtc',
            connectionState: state,
            iceConnectionState: pc.iceConnectionState,
            signalingState: pc.signalingState,
          },
        })
      }
    }
  }

  /**
   * Log WebRTC operation error.
   */
  function logWebRTCError(
    operation: string,
    error: Error,
    context?: Record<string, unknown>
  ): void {
    diagnosticsApi.queueError({
      severity: 'error',
      message: `WebRTC ${operation} failed: ${error.message}`,
      stack: error.stack,
      url: window.location.href,
      sessionId,
      appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      context: {
        service: 'classroom.webrtc',
        operation,
        errorName: error.name,
        ...context,
      },
    })
  }

  /**
   * Wrap async WebRTC operation with error logging.
   */
  async function withDiagnostics<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      logWebRTCError(operation, error as Error, context)
      throw error
    }
  }

  /**
   * Log ICE candidate error.
   */
  function logIceCandidateError(error: Error, candidate?: RTCIceCandidate): void {
    diagnosticsApi.queueError({
      severity: 'warning',
      message: `ICE candidate error: ${error.message}`,
      stack: error.stack,
      url: window.location.href,
      sessionId,
      appVersion: (import.meta.env.VITE_APP_VERSION as string) || 'unknown',
      context: {
        service: 'classroom.webrtc',
        operation: 'addIceCandidate',
        candidateType: candidate?.type,
        candidateProtocol: candidate?.protocol,
      },
    })
  }

  return {
    setupPeerConnectionDiagnostics,
    logWebRTCError,
    withDiagnostics,
    logIceCandidateError,
  }
}
