// Wrapper IndexedDB minimal — pas de dépendance externe.
// Une base, deux stores : "queue" (mutations en attente) et
// "reports-cache" (dernière copie connue d'un rapport, pour la lecture
// hors-ligne du Niveau 3).

const DB_NAME = 'extincpro-offline'
const DB_VERSION = 1
export const STORE_QUEUE = 'queue'
export const STORE_REPORTS = 'reports-cache'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB indisponible'))
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_REPORTS)) {
          db.createObjectStore(STORE_REPORTS, { keyPath: 'url' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const req = fn(tx.objectStore(storeName))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function dbGetAll<T = any>(storeName: string): Promise<T[]> {
  try {
    return await withStore<T[]>(storeName, 'readonly', (s) => s.getAll())
  } catch {
    return []
  }
}

export async function dbGet<T = any>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  try {
    return await withStore<T>(storeName, 'readonly', (s) => s.get(key))
  } catch {
    return undefined
  }
}

export async function dbPut(storeName: string, value: any): Promise<void> {
  try {
    await withStore(storeName, 'readwrite', (s) => s.put(value))
  } catch {
    // Stockage indisponible (navigation privée, quota, etc.) — on continue
    // sans persistance plutôt que de bloquer la saisie.
  }
}

export async function dbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  try {
    await withStore(storeName, 'readwrite', (s) => s.delete(key))
  } catch {
    // Idem : non bloquant.
  }
}
