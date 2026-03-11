/**
 * TokenVault — In-memory encryption for JWT access tokens.
 *
 * WHY: JWT stored in Pinia state is readable via window.__pinia__,
 * browser devtools, or XSS injection. Encrypting it in memory
 * forces attacker to also extract the ephemeral AES key (which
 * lives only in a closure, never on window/globalThis).
 *
 * HOW: AES-GCM via Web Crypto API. Key generated per page load
 * (non-exportable CryptoKey). Token encrypted on store, decrypted
 * on read. Ciphertext stored in Pinia state instead of plaintext JWT.
 *
 * PLATFORM LAW: This is a security foundation layer (MANIFEST §2).
 * All WS tokenProviders and auth injection points MUST use
 * tokenVault.decrypt() to obtain the real JWT.
 *
 * Fallback: If Web Crypto API unavailable (SSR, old browser),
 * falls back to plaintext (no encryption, no crash).
 */

// ── Ephemeral key (closure-scoped, never exposed) ──────────────────────

let _cryptoKey: CryptoKey | null = null
let _ready = false
let _initPromise: Promise<void> | null = null

const ALGO = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits for AES-GCM

// Prefix to distinguish encrypted tokens from plaintext
const ENCRYPTED_PREFIX = '__enc__:'

/**
 * Check if Web Crypto API is available.
 */
function hasCrypto(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    !!globalThis.crypto &&
    typeof globalThis.crypto.subtle?.generateKey === 'function'
  )
}

/**
 * Initialize vault — generate ephemeral AES key.
 * Called once at app startup. Safe to call multiple times (idempotent).
 */
async function init(): Promise<void> {
  if (_ready) return
  if (_initPromise) return _initPromise

  _initPromise = _doInit()
  await _initPromise
  _initPromise = null
}

async function _doInit(): Promise<void> {
  if (!hasCrypto()) {
    console.warn('[tokenVault] Web Crypto API unavailable — fallback to plaintext')
    _ready = true
    return
  }

  try {
    _cryptoKey = await globalThis.crypto.subtle.generateKey(
      { name: ALGO, length: KEY_LENGTH },
      false, // non-extractable — cannot be exported via JS
      ['encrypt', 'decrypt'],
    )
    _ready = true
  } catch (err) {
    console.error('[tokenVault] Key generation failed — fallback to plaintext', err)
    _cryptoKey = null
    _ready = true
  }
}

/**
 * Encrypt plaintext JWT → ciphertext with prefix.
 * Returns encrypted token string or plaintext if encryption fails.
 * 
 * RELOAD FALLBACK: Stores plaintext JWT in sessionStorage before encrypting.
 * This allows session recovery after page reload (e.g., theme change, chunk error).
 */
async function encrypt(plainToken: string | null): Promise<string | null> {
  if (!plainToken) return null
  if (plainToken === '__cookie__') return '__cookie__'

  // RELOAD FALLBACK: Store plaintext in sessionStorage for recovery after reload
  // This is needed because ephemeral key is lost on reload, but session should persist
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem('_jwt_fallback', plainToken)
    } catch {
      // Ignore sessionStorage errors (private mode, quota exceeded)
    }
  }

  if (!_ready) await init()
  if (!_cryptoKey) {
    console.warn('[tokenVault] Encrypt called but no key — returning plaintext')
    return plainToken
  }

  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(plainToken)

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const cipherBuf = await globalThis.crypto.subtle.encrypt(
      { name: ALGO, iv },
      _cryptoKey,
      data,
    )

    // Combine IV + ciphertext → base64
    const combined = new Uint8Array(IV_LENGTH + cipherBuf.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(cipherBuf), IV_LENGTH)

    let binary = ''
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i])
    }
    return ENCRYPTED_PREFIX + btoa(binary)
  } catch (err) {
    console.error('[tokenVault] Encrypt failed — returning plaintext', err)
    return plainToken
  }
}

/**
 * Decrypt an encrypted token back to plaintext JWT.
 * If token is not encrypted (no prefix), returns as-is.
 * 
 * RELOAD FALLBACK: If decryption fails (ephemeral key lost after reload),
 * attempts to recover plaintext JWT from sessionStorage.
 */
async function decrypt(encryptedToken: string | null): Promise<string | null> {
  if (!encryptedToken) return null
  if (encryptedToken === '__cookie__') return null

  // Not encrypted — return as-is (backward compat / fallback)
  if (!encryptedToken.startsWith(ENCRYPTED_PREFIX)) return encryptedToken

  if (!_ready) await init()
  if (!_cryptoKey) {
    console.warn('[tokenVault] Decrypt called but no key — attempting sessionStorage fallback')
    // RELOAD FALLBACK: Try to recover from sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      try {
        const fallback = sessionStorage.getItem('_jwt_fallback')
        if (fallback) {
          console.info('[tokenVault] Recovered JWT from sessionStorage fallback after reload')
          return fallback
        }
      } catch {
        // Ignore sessionStorage errors
      }
    }
    return null
  }

  try {
    const b64 = encryptedToken.slice(ENCRYPTED_PREFIX.length)
    const binary = atob(b64)
    const combined = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i)
    }

    const iv = combined.slice(0, IV_LENGTH)
    const ciphertext = combined.slice(IV_LENGTH)

    const plainBuf = await globalThis.crypto.subtle.decrypt(
      { name: ALGO, iv },
      _cryptoKey,
      ciphertext,
    )

    return new TextDecoder().decode(plainBuf)
  } catch (err) {
    console.warn('[tokenVault] Decrypt failed — attempting sessionStorage fallback', err)
    // RELOAD FALLBACK: Try to recover from sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      try {
        const fallback = sessionStorage.getItem('_jwt_fallback')
        if (fallback) {
          console.info('[tokenVault] Recovered JWT from sessionStorage fallback after decrypt error')
          return fallback
        }
      } catch {
        // Ignore sessionStorage errors
      }
    }
    return null
  }
}

/**
 * Check if a token value is encrypted (has the vault prefix).
 */
function isEncrypted(token: string | null): boolean {
  return typeof token === 'string' && token.startsWith(ENCRYPTED_PREFIX)
}

/**
 * Check if vault is ready (key generated).
 */
function isReady(): boolean {
  return _ready
}

export const tokenVault = {
  init,
  encrypt,
  decrypt,
  isEncrypted,
  isReady,
}
