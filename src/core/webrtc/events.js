/**
 * WebRTC Events — v0.16.0
 * Event types and constants for WebRTC signaling
 */

/**
 * Signaling event types
 */
export const SIGNALING_EVENTS = {
  // Connection lifecycle
  CONNECTED: 'signaling:connected',
  DISCONNECTED: 'signaling:disconnected',
  RECONNECTING: 'signaling:reconnecting',
  ERROR: 'signaling:error',
  
  // Call signaling
  OFFER: 'call:offer',
  ANSWER: 'call:answer',
  ICE_CANDIDATE: 'call:ice-candidate',
  
  // Call control
  CALL_REQUEST: 'call:request',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_END: 'call:end',
  CALL_BUSY: 'call:busy',
  
  // Media control
  MEDIA_TOGGLE: 'media:toggle',
  SCREEN_SHARE_START: 'screen:start',
  SCREEN_SHARE_STOP: 'screen:stop',
  
  // Presence
  PEER_JOINED: 'peer:joined',
  PEER_LEFT: 'peer:left',
}

/**
 * Call states
 */
export const CALL_STATE = {
  IDLE: 'idle',
  CALLING: 'calling',
  RINGING: 'ringing',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ENDED: 'ended',
  FAILED: 'failed',
}

/**
 * Media types
 */
export const MEDIA_TYPE = {
  AUDIO: 'audio',
  VIDEO: 'video',
  SCREEN: 'screen',
}

/**
 * ICE connection states
 */
export const ICE_STATE = {
  NEW: 'new',
  CHECKING: 'checking',
  CONNECTED: 'connected',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected',
  CLOSED: 'closed',
}

/**
 * Signaling message types (for WS protocol)
 */
export const MESSAGE_TYPE = {
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE: 'ice',
  JOIN: 'join',
  LEAVE: 'leave',
  PING: 'ping',
  PONG: 'pong',
}

/**
 * Error codes
 */
export const ERROR_CODE = {
  PERMISSION_DENIED: 'permission_denied',
  NOT_SUPPORTED: 'not_supported',
  NETWORK_ERROR: 'network_error',
  PEER_UNAVAILABLE: 'peer_unavailable',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown',
}

export default {
  SIGNALING_EVENTS,
  CALL_STATE,
  MEDIA_TYPE,
  ICE_STATE,
  MESSAGE_TYPE,
  ERROR_CODE,
}
