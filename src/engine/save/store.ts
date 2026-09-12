const DB_NAME = 'dead-letter-run'
const DB_VERSION = 1
const STORE = 'saves'
const KEY = 'slot-default'

export type LoadResult =
  | { status: 'ok'; raw: string }
  | { status: 'missing' }
  | { status: 'unavailable'; detail: string }

function idb(): IDBFactory | null {
  try {
    if (typeof indexedDB === 'undefined') return null
    return indexedDB
  } catch {
    return null
  }
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const request = run(transaction.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

/**
 * Versioned local-save storage. Only JSON strings are persisted — never
 * Three.js objects. Corrupt entries are left in place and reported so the UI
 * can offer an explicit recovery action (clear + start over).
 */
export const saveStore = {
  async hasSave(): Promise<boolean> {
    const factory = idb()
    if (!factory) return false
    try {
      const db = await openDb(factory)
      try {
        const raw = await tx(db, 'readonly', (s) => s.get(KEY))
        return typeof raw === 'string' && raw.length > 0
      } finally {
        db.close()
      }
    } catch {
      return false
    }
  },

  async loadRaw(): Promise<LoadResult> {
    const factory = idb()
    if (!factory) return { status: 'unavailable', detail: 'IndexedDB is not available.' }
    try {
      const db = await openDb(factory)
      try {
        const raw = await tx(db, 'readonly', (s) => s.get(KEY))
        if (typeof raw !== 'string' || raw.length === 0) return { status: 'missing' }
        return { status: 'ok', raw }
      } finally {
        db.close()
      }
    } catch (error) {
      return {
        status: 'unavailable',
        detail: error instanceof Error ? error.message : 'Load failed.',
      }
    }
  },

  async writeRaw(json: string): Promise<void> {
    const factory = idb()
    if (!factory) throw new Error('IndexedDB is not available.')
    const db = await openDb(factory)
    try {
      await tx(db, 'readwrite', (s) => s.put(json, KEY))
    } finally {
      db.close()
    }
  },

  async clear(): Promise<void> {
    const factory = idb()
    if (!factory) return
    const db = await openDb(factory)
    try {
      await tx(db, 'readwrite', (s) => s.delete(KEY))
    } finally {
      db.close()
    }
  },
}
