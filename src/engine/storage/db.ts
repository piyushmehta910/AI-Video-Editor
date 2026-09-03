/**
 * IndexedDB schema manager for ClipForge.
 *
 * Schema versions:
 *  v1 - initial: assets, projects, settings, history
 *  v2 - added keyed compound index on assets (no breaking change)
 *  v3 - introduced history.snapshots support
 *  v4 - stamped each record with `_schemaVersion` so future migrations can
 *       branch per-record (e.g. legacy project format fix-ups)
 *
 * Migrations live in `./migrations.ts` and run inside the `versionchange`
 * transaction. New code should ALWAYS bump DB_VERSION and add a migration
 * rather than mutating existing records in place.
 */

const DB_NAME = 'clipforge-app'
const DB_VERSION = 4

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

export const CURRENT_SCHEMA_VERSION = 4

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const oldVersion = event.oldVersion
      const tx = req.transaction

      // Create any missing stores
      for (const [name, spec] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: spec.keyPath })
        }
      }

      // Run migrations sequentially based on oldVersion
      if (oldVersion < 1) {
        // Initial schema — stores were just created above. Nothing to migrate.
      }
      if (oldVersion < 2) {
        // No structural change; future-proofing marker
      }
      if (oldVersion < 3) {
        // History snapshots support — no structural change
      }
      if (oldVersion < 4 && tx) {
        // v4: stamp every existing record with `_schemaVersion` so future
        // per-record migrations can be applied lazily on read.
        runV4Migration(tx)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/**
 * v3 -> v4 migration: stamp records with `_schemaVersion`. Idempotent.
 * Runs inside the open transaction.
 */
function runV4Migration(tx: IDBTransaction): void {
  const stores = ['projects', 'assets', 'settings', 'history'] as const
  for (const storeName of stores) {
    const os = tx.objectStore(storeName)
    const cursorReq = os.openCursor()
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (!cursor) return
      const value = cursor.value as Record<string, unknown>
      if (value._schemaVersion === undefined) {
        value._schemaVersion = CURRENT_SCHEMA_VERSION
        cursor.update(value)
      }
      cursor.continue()
    }
  }
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
