/**
 * Accept availability response from backend.
 * 
 * SSOT Section 7: UI показує тільки числа, не причини.
 */
export interface AcceptAvailability {
  /**
   * Whether tutor can accept inquiry right now.
   */
  can_accept: boolean
  
  /**
   * Number of remaining accepts.
   * 
   * SSOT: This is the ONLY number shown to tutor.
   * Backend decides source (onboarding/billing), frontend doesn't know.
   */
  remaining_accepts: number
  
  /**
   * Grace token for UX guarantee (SSOT F.2).
   * 
   * Present only if can_accept=true.
   * TTL: 45 seconds.
   */
  grace_token?: string
  
  /**
   * Grace token expiry timestamp.
   * 
   * ISO 8601 format.
   */
  expires_at?: string
}

/**
 * Accept inquiry response.
 */
export interface AcceptInquiryResponse {
  inquiry_id: string
  status: 'accepted'
  accepted_at: string
}

/**
 * Accept inquiry request payload.
 */
export interface AcceptInquiryRequest {
  /**
   * Grace token (optional).
   * 
   * If present, backend will validate and use onboarding allowance.
   * If not present, backend will fallback to billing.
   */
  grace_token?: string
}
