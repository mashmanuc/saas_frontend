/**
 * WebAuthn utilities for credential management
 * v0.40.0 - Real navigator.credentials integration
 */

export interface WebAuthnChallenge {
  challenge: string
  rp_id: string
  user_handle: string
  allowCredentials: Array<{
    type: 'public-key'
    id: string
  }>
  timeout: number
}

export interface WebAuthnCredential {
  credential_id: string
  client_data_json: string
  authenticator_data: string
  signature: string
  user_handle: string
}

export interface WebAuthnRegistration {
  credential_id: string
  client_data_json: string
  attestation_object: string
  device_label: string
}

/**
 * Convert base64url to ArrayBuffer
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Convert ArrayBuffer to base64url
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Authenticate with WebAuthn credential
 */
export async function authenticateWithWebAuthn(
  challenge: WebAuthnChallenge
): Promise<WebAuthnCredential> {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn not supported in this browser')
  }

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge: base64urlToBuffer(challenge.challenge),
    rpId: challenge.rp_id,
    allowCredentials: challenge.allowCredentials.map((cred) => ({
      type: 'public-key' as const,
      id: base64urlToBuffer(cred.id),
    })),
    timeout: challenge.timeout || 60000,
    userVerification: 'preferred',
  }

  try {
    const credential = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null

    if (!credential) {
      throw new Error('No credential returned')
    }

    const response = credential.response as AuthenticatorAssertionResponse

    return {
      credential_id: bufferToBase64url(credential.rawId),
      client_data_json: bufferToBase64url(response.clientDataJSON),
      authenticator_data: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      user_handle: response.userHandle ? bufferToBase64url(response.userHandle) : challenge.user_handle,
    }
  } catch (error: any) {
    // Map WebAuthn errors to user-friendly messages
    if (error.name === 'NotAllowedError') {
      throw new Error('Authentication was cancelled or timed out')
    } else if (error.name === 'InvalidStateError') {
      throw new Error('This credential is not registered on this device')
    } else if (error.name === 'SecurityError') {
      throw new Error('Security error during authentication')
    } else {
      throw error
    }
  }
}

/**
 * Register new WebAuthn credential
 */
export async function registerWebAuthnCredential(
  challenge: string,
  rpId: string,
  rpName: string,
  userId: string,
  userName: string,
  userDisplayName: string,
  deviceLabel: string
): Promise<WebAuthnRegistration> {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn not supported in this browser')
  }

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge: base64urlToBuffer(challenge),
    rp: {
      id: rpId,
      name: rpName,
    },
    user: {
      id: base64urlToBuffer(userId),
      name: userName,
      displayName: userDisplayName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  }

  try {
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null

    if (!credential) {
      throw new Error('No credential created')
    }

    const response = credential.response as AuthenticatorAttestationResponse

    return {
      credential_id: bufferToBase64url(credential.rawId),
      client_data_json: bufferToBase64url(response.clientDataJSON),
      attestation_object: bufferToBase64url(response.attestationObject),
      device_label: deviceLabel,
    }
  } catch (error: any) {
    // Map WebAuthn errors to user-friendly messages
    if (error.name === 'NotAllowedError') {
      throw new Error('Registration was cancelled or timed out')
    } else if (error.name === 'InvalidStateError') {
      throw new Error('This credential is already registered')
    } else if (error.name === 'SecurityError') {
      throw new Error('Security error during registration')
    } else {
      throw error
    }
  }
}

/**
 * Check if WebAuthn is available
 */
export function isWebAuthnAvailable(): boolean {
  return !!(window.PublicKeyCredential && navigator.credentials)
}

/**
 * Check if platform authenticator is available (e.g., Touch ID, Face ID, Windows Hello)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}
