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

function hashName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i)
    h |= 0
  }
  return (h >>> 0).toString(36)
}

export async function writeMediaFile(id: string, file: File, fileName?: string): Promise<string> {
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
  const root = await getRoot()
  const parts = path.split('/')
  let dir = root
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i])
  }
  const handle = await dir.getFileHandle(parts[parts.length - 1])
  return handle.getFile()
}

export async function deleteMediaFile(id: string): Promise<void> {
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