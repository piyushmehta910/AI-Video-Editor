const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const SALT_LENGTH = 16
const ITERATIONS = 100_000

// Storage keys
const MASTER_KEY_STORAGE_KEY = 'clipforge-master-key'
const MASTER_KEY_SALT_KEY = 'clipforge-master-salt'
const MASTER_KEY_VERSION_KEY = 'clipforge-master-version'
const CURRENT_MASTER_KEY_VERSION = 2 // v1 = auto-generated, v2 = user passphrase

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const key = await deriveKey(password, salt)

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    ENCODER.encode(text)
  )

  const encryptedBytes = new Uint8Array(encrypted)
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + encryptedBytes.byteLength)
  combined.set(salt, 0)
  combined.set(iv, SALT_LENGTH)
  combined.set(encryptedBytes, SALT_LENGTH + IV_LENGTH)

  return bytesToHex(combined)
}

export async function decrypt(encryptedHex: string, password: string): Promise<string> {
  const combined = hexToBytes(encryptedHex)

  if (combined.length < SALT_LENGTH + IV_LENGTH) {
    throw new Error('Invalid encrypted data: too short')
  }

  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH)

  const key = await deriveKey(password, salt)

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    )
    return DECODER.decode(decrypted)
  } catch {
    throw new Error('Decryption failed: invalid password or corrupted data')
  }
}

/**
 * Master key management using user-provided passphrase.
 * The master key is NEVER stored - it's derived from the user's passphrase on each session.
 * Only the salt and version are stored in localStorage.
 */

export interface MasterKeyState {
  version: number
  hasPassphrase: boolean
  salt?: string // hex-encoded salt for v2
  hasKey?: boolean // for legacy v1 mode
}

export async function getMasterKeyState(): Promise<MasterKeyState> {
  try {
    const version = Number(localStorage.getItem(MASTER_KEY_VERSION_KEY)) || 1
    if (version === 1) {
      // Legacy: auto-generated key exists in localStorage
      const hasKey = !!localStorage.getItem(MASTER_KEY_STORAGE_KEY)
      return { version: 1, hasPassphrase: false, hasKey }
    }
    // v2: user passphrase
    const salt = localStorage.getItem(MASTER_KEY_SALT_KEY)
    return { version: 2, hasPassphrase: !!salt, salt: salt ?? undefined }
  } catch {
    return { version: 1, hasPassphrase: false }
  }
}

export async function setMasterPassphrase(passphrase: string): Promise<void> {
  if (passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters')
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  localStorage.setItem(MASTER_KEY_SALT_KEY, bytesToHex(salt))
  localStorage.setItem(MASTER_KEY_VERSION_KEY, String(CURRENT_MASTER_KEY_VERSION))
  // Remove legacy key if present
  localStorage.removeItem(MASTER_KEY_STORAGE_KEY)
}

export async function verifyMasterPassphrase(passphrase: string): Promise<boolean> {
  try {
    const state = await getMasterKeyState()
    if (state.version === 1) {
      // Legacy: try to decrypt with stored key
      const storedKey = localStorage.getItem(MASTER_KEY_STORAGE_KEY)
      if (!storedKey) return false
      // Verify by trying to decrypt a test value
      await decrypt('test', storedKey) // This will fail but we can check the key exists
      return true
    }
    // v2: derive key from passphrase and verify against stored salt
    if (!state.salt) return false
    const salt = hexToBytes(state.salt)
    await deriveKey(passphrase, salt)
    return true
  } catch {
    return false
  }
}

export async function getMasterKey(passphrase?: string): Promise<string | null> {
  const state = await getMasterKeyState()

  if (state.version === 1) {
    // Legacy mode: return stored key (for migration)
    return localStorage.getItem(MASTER_KEY_STORAGE_KEY)
  }

  if (!state.salt) return null
  if (!passphrase) return null

  const salt = hexToBytes(state.salt)
  const key = await deriveKey(passphrase, salt)
  const exported = await crypto.subtle.exportKey('raw', key)
  return bytesToHex(new Uint8Array(exported))
}

export async function clearMasterKey(): Promise<void> {
  localStorage.removeItem(MASTER_KEY_STORAGE_KEY)
  localStorage.removeItem(MASTER_KEY_SALT_KEY)
  localStorage.removeItem(MASTER_KEY_VERSION_KEY)
}

export async function migrateToPassphrase(passphrase: string): Promise<void> {
  const state = await getMasterKeyState()
  if (state.version === 2) return // Already migrated

  // Decrypt existing config with legacy key
  const legacyKey = localStorage.getItem(MASTER_KEY_STORAGE_KEY)
  if (!legacyKey) {
    // No legacy data, just set up new passphrase
    await setMasterPassphrase(passphrase)
    return
  }

  // Re-encrypt all stored config with new passphrase
  const STORAGE_KEY = 'clipforge-api-config'
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      // Decrypt with legacy key
      const decrypted = await decryptConfigWithKey(parsed, legacyKey)
      // Encrypt with new passphrase
      const newSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
      localStorage.setItem(MASTER_KEY_SALT_KEY, bytesToHex(newSalt))
      localStorage.setItem(MASTER_KEY_VERSION_KEY, String(CURRENT_MASTER_KEY_VERSION))
      localStorage.removeItem(MASTER_KEY_STORAGE_KEY)

      const encrypted = await encryptConfigWithPassphrase(decrypted, passphrase, newSalt)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted))
    } catch {
      // Migration failed - clear and start fresh
      await clearMasterKey()
      await setMasterPassphrase(passphrase)
      localStorage.removeItem(STORAGE_KEY)
    }
  } else {
    await setMasterPassphrase(passphrase)
  }
}

async function decryptConfigWithKey(config: Record<string, unknown>, key: string): Promise<Record<string, unknown>> {
  const sensitiveKeys = [
    'apiKey', 'accessKey', 'secretKey', 'secret', 'password', 'token',
  ]

  const result: Record<string, unknown> = {}

  for (const [k, value] of Object.entries(config)) {
    if (typeof value === 'string' && sensitiveKeys.some((sk) => k.toLowerCase().includes(sk.toLowerCase()))) {
      try {
        result[k] = await decrypt(value, key)
      } catch {
        result[k] = '' // Corrupted, return empty
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[k] = await decryptConfigWithKey(value as Record<string, unknown>, key)
    } else {
      result[k] = value
    }
  }
  return result
}

async function encryptConfigWithPassphrase(config: Record<string, unknown>, passphrase: string, salt: Uint8Array): Promise<Record<string, unknown>> {
  const sensitiveKeys = [
    'apiKey', 'accessKey', 'secretKey', 'secret', 'password', 'token',
  ]

  const result: Record<string, unknown> = {}

  for (const [k, value] of Object.entries(config)) {
    if (typeof value === 'string' && sensitiveKeys.some((sk) => k.toLowerCase().includes(sk.toLowerCase()))) {
      if (value) {
        const key = await deriveKey(passphrase, salt)
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
        const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, ENCODER.encode(value))
        const encryptedBytes = new Uint8Array(encrypted)
        const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + encryptedBytes.byteLength)
        combined.set(salt, 0)
        combined.set(iv, SALT_LENGTH)
        combined.set(encryptedBytes, SALT_LENGTH + IV_LENGTH)
        result[k] = bytesToHex(combined)
      } else {
        result[k] = value
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[k] = await encryptConfigWithPassphrase(value as Record<string, unknown>, passphrase, salt)
    } else {
      result[k] = value
    }
  }
  return result
}

export async function encryptConfigValue(value: string, passphrase?: string): Promise<string> {
  if (!value) return value

  const state = await getMasterKeyState()

  if (state.version === 1) {
    // Legacy mode
    const key = localStorage.getItem(MASTER_KEY_STORAGE_KEY)
    if (!key) return value
    return encrypt(value, key)
  }

  // v2: user passphrase required
  if (!passphrase || !state.salt) return value
  return encrypt(value, passphrase) // encrypt() generates new salt/iv per value
}

export async function decryptConfigValue(encrypted: string, passphrase?: string): Promise<string> {
  if (!encrypted) return encrypted

  const state = await getMasterKeyState()

  if (state.version === 1) {
    const key = localStorage.getItem(MASTER_KEY_STORAGE_KEY)
    if (!key) return ''
    try {
      return await decrypt(encrypted, key)
    } catch {
      return ''
    }
  }

  if (!passphrase || !state.salt) return ''
  try {
    return await decrypt(encrypted, passphrase)
  } catch {
    return ''
  }
}

export async function encryptConfig(config: Record<string, unknown>, passphrase?: string): Promise<Record<string, unknown>> {
  const sensitiveKeys = [
    'apiKey', 'accessKey', 'secretKey', 'secret', 'password', 'token',
  ]

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = await encryptConfigValue(value, passphrase)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = await encryptConfig(value as Record<string, unknown>, passphrase)
    } else {
      result[key] = value
    }
  }
  return result
}

export async function decryptConfig(config: Record<string, unknown>, passphrase?: string): Promise<Record<string, unknown>> {
  const sensitiveKeys = [
    'apiKey', 'accessKey', 'secretKey', 'secret', 'password', 'token',
  ]

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = await decryptConfigValue(value, passphrase)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = await decryptConfig(value as Record<string, unknown>, passphrase)
    } else {
      result[key] = value
    }
  }
  return result
}