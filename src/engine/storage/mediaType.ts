export type MediaType = 'video' | 'audio' | 'image'

const VIDEO_EXT = new Set(['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'mpg', 'mpeg', 'ts', 'ogv', 'ogm', '3gp', '3g2'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba', 'wma', 'aiff', 'aif', 'amr'])
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico', 'tif', 'tiff', 'jfif'])

/**
 * Detect the media type of a file from its MIME type first, then falling back
 * to its file extension. Handles files with empty or generic MIME types
 * (e.g. application/octet-stream) so more formats are supported on import.
 */
export const MAX_FILE_SIZES: Record<MediaType, number> = {
  video: 2 * 1024 * 1024 * 1024, // 2GB
  audio: 500 * 1024 * 1024, // 500MB
  image: 100 * 1024 * 1024, // 100MB
}

export const ALLOWED_MIME_TYPES: Record<MediaType, string[]> = {
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'video/mpeg', 'video/ogg', 'video/3gpp', 'video/3gpp2'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/opus', 'audio/webm', 'audio/x-wav', 'audio/x-aiff', 'audio/amr'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp', 'image/svg+xml', 'image/tiff', 'image/x-icon'],
}

export interface FileValidationResult {
  valid: boolean
  type: MediaType | null
  error?: string
}

export function validateFile(file: File): FileValidationResult {
  // Check file size
  const maxSize = MAX_FILE_SIZES.video // Default to video (largest)
  if (file.size > maxSize) {
    return { valid: false, type: null, error: `File size exceeds maximum allowed (${Math.round(maxSize / 1024 / 1024)}MB)` }
  }

  // Detect media type
  const type = detectMediaType({ name: file.name, type: file.type })
  if (!type) {
    return { valid: false, type: null, error: 'Unsupported file type' }
  }

  // Check file size against type-specific limit
  const typeMaxSize = MAX_FILE_SIZES[type]
  if (file.size > typeMaxSize) {
    return { valid: false, type, error: `File size exceeds maximum for ${type} (${Math.round(typeMaxSize / 1024 / 1024)}MB)` }
  }

  // Validate MIME type against allowed list
  const allowedMimes = ALLOWED_MIME_TYPES[type]
  if (!allowedMimes.some((allowed) => file.type.toLowerCase().startsWith(allowed.toLowerCase()))) {
    return { valid: false, type, error: `MIME type ${file.type} not allowed for ${type}` }
  }

  // Validate file extension matches type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const extSets: Record<MediaType, Set<string>> = {
    video: VIDEO_EXT,
    audio: AUDIO_EXT,
    image: IMAGE_EXT,
  }
  if (!extSets[type].has(ext)) {
    return { valid: false, type, error: `File extension .${ext} not allowed for ${type}` }
  }

  return { valid: true, type }
}

export function detectMediaType(file: { name: string; type: string }): MediaType | null {
  const mime = file.type.toLowerCase()
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/octet-stream' || mime === '' || mime === 'application/x-msdownload') {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (VIDEO_EXT.has(ext)) return 'video'
    if (AUDIO_EXT.has(ext)) return 'audio'
    if (IMAGE_EXT.has(ext)) return 'image'
  }
  return null
}