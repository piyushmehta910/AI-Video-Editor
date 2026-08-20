const OPFS_NAMESPACE = 'clipforge-media'

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null

function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (rootPromise) return rootPromise
  rootPromise = (async () => {
    const base = await navigator.storage.getDirectory()
    return base.getDirectoryHandle(OPFS_NAMESPACE, { create: true })
  })()
  return rootPromise
}

/**
 * Validate that a path segment is safe (no path traversal, no absolute paths, etc.)
 */
function validatePathSegment(segment: string): void {
  if (!segment || segment.length === 0) {
    throw new Error('Path segment cannot be empty')
  }
  if (segment.includes('/') || segment.includes('\\')) {
    throw new Error('Path segment cannot contain path separators')
  }
  if (segment === '.' || segment === '..') {
    throw new Error('Path segment cannot be "." or ".."')
  }
  if (segment.startsWith('.')) {
    throw new Error('Path segment cannot start with "."')
  }
  // Limit length to prevent abuse
  if (segment.length > 255) {
    throw new Error('Path segment too long (max 255 characters)')
  }
}

/**
 * Validate that a full path is safe (no path traversal)
 */
function validatePath(path: string): void {
  if (!path || path.length === 0) {
    throw new Error('Path cannot be empty')
  }
  if (path.startsWith('/') || path.startsWith('\\')) {
    throw new Error('Path cannot be absolute')
  }
  const parts = path.split('/')
  for (const part of parts) {
    validatePathSegment(part)
  }
}

function hashName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i)
    h |= 0
  }
  return (h >>> 0).toString(36)
}

export async function writeMediaFile(id: string, file: File, fileName?: string): Promise<string> {
  validatePathSegment(id)
  const root = await getRoot()
  const dir = await root.getDirectoryHandle(id, { create: true })
  const safeName = fileName
    ? fileName.replace(/[^\w.\- ]/g, '_')
    : `${hashName(file.name)}-${file.name.replace(/[^\w.\- ]/g, '_')}`
  const handle = await dir.getFileHandle(safeName, { create: true })
  const writable = await handle.createWritable()
  await writable.write(file)
  await writable.close()
  return `${id}/${safeName}`
}

export async function readMediaFile(path: string): Promise<File> {
  validatePath(path)
  const root = await getRoot()
  const parts = path.split('/')
  let dir = root
  for (let i = 0; i < parts.length - 1; i++) {
    validatePathSegment(parts[i])
    dir = await dir.getDirectoryHandle(parts[i])
  }
  validatePathSegment(parts[parts.length - 1])
  const handle = await dir.getFileHandle(parts[parts.length - 1])
  return handle.getFile()
}

export async function deleteMediaFile(id: string): Promise<void> {
  validatePathSegment(id)
  try {
    const root = await getRoot()
    await root.removeEntry(id, { recursive: true })
  } catch {
    // already gone
  }
}

export async function getMediaUrl(path: string): Promise<string> {
  const file = await readMediaFile(path)
  return URL.createObjectURL(file)
}

export async function listMediaFiles(): Promise<Array<{ id: string; name: string }>> {
  const root = await getRoot()
  const out: Array<{ id: string; name: string }> = []
  for await (const entry of (root as FileSystemDirectoryHandle).values()) {
    if (entry.kind === 'directory') {
      out.push({ id: entry.name, name: entry.name })
    }
  }
  return out
}