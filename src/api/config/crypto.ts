const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const SALT_LENGTH = 16
const ITERATIONS = 100_000

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

async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
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
      salt: salt instanceof Uint8Array ? new Uint8Array(salt.buffer, salt.byteOffset, salt.byteLength) : salt,
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

async function getOrCreateMasterPassword(): Promise<string> {
  const STORAGE_KEY = 'clipforge-master-key'
  let password = localStorage.getItem(STORAGE_KEY)

  if (!password) {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    password = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(STORAGE_KEY, password)
  }

  return password
}

export async function encryptConfigValue(value: string): Promise<string> {
  if (!value) return value
  const password = await getOrCreateMasterPassword()
  return encrypt(value, password)
}

export async function decryptConfigValue(encrypted: string): Promise<string> {
  if (!encrypted) return encrypted
  const password = await getOrCreateMasterPassword()
  try {
    return await decrypt(encrypted, password)
  } catch {
    return ''
  }
}

export async function encryptConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sensitiveKeys = [
    'apiKey',
    'accessKey',
    'secretKey',
    'secret',
    'password',
    'token',
  ]

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = await encryptConfigValue(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = await encryptConfig(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}

export async function decryptConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sensitiveKeys = [
    'apiKey',
    'accessKey',
    'secretKey',
    'secret',
    'password',
    'token',
  ]

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string' && sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      result[key] = await decryptConfigValue(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = await decryptConfig(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}