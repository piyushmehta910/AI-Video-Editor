const DB_NAME = 'clipforge-app'
const DB_VERSION = 3

interface StoreMap {
  assets: { keyPath: 'id' }
  projects: { keyPath: 'id' }
  settings: { keyPath: 'key' }
  history: { keyPath: 'id' }
}

const STORES: StoreMap = {
  assets: { keyPath: 'id' },
  projects: { keyPath: 'id' },
  settings: { keyPath: 'key' },
  history: { keyPath: 'id' },
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const [name, spec] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: spec.keyPath })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function tx<T>(
  store: keyof StoreMap,
  mode: IDBTransactionMode,
  run: (os: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = run(t.objectStore(store))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putRecord<T>(store: keyof StoreMap, value: T): Promise<IDBValidKey> {
  return tx(store, 'readwrite', (os) => os.put(value))
}

export async function getRecord<T>(store: keyof StoreMap, key: IDBValidKey): Promise<T | undefined> {
  return tx(store, 'readonly', (os) => os.get(key))
}

export async function getAllRecords<T>(store: keyof StoreMap): Promise<T[]> {
  return tx(store, 'readonly', (os) => os.getAll())
}

export async function deleteRecord(store: keyof StoreMap, key: IDBValidKey): Promise<undefined> {
  return tx(store, 'readwrite', (os) => os.delete(key))
}

export async function clearStore(store: keyof StoreMap): Promise<undefined> {
  return tx(store, 'readwrite', (os) => os.clear())
}