export type MediaType = 'video' | 'audio' | 'image'

const VIDEO_EXT = new Set(['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'mpg', 'mpeg', 'ts', 'ogv', 'ogm', '3gp', '3g2'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba', 'wma', 'aiff', 'aif', 'amr'])
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico', 'tif', 'tiff', 'jfif'])

/**
 * Detect the media type of a file from its MIME type first, then falling back
 * to its file extension. Handles files with empty or generic MIME types
 * (e.g. application/octet-stream) so more formats are supported on import.
 */
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