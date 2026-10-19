/**
 * Robust IndexedDB-backed persistent storage with localStorage fallback & auto-migration.
 * Prevents QuotaExceededError when storing large custom card and sleeve graphics.
 */

const DB_NAME = 'battle_swipes_db';
const DB_VERSION = 1;
const STORE_NAME = 'game_records';

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in current environment'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        console.warn('IndexedDB database open blocked');
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Synchronous read from localStorage for instant initial component render.
 */
export function getStorageItemSync<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    if (item !== null) {
      return JSON.parse(item) as T;
    }
  } catch {
    // Suppress parse or access errors
  }
  return fallback;
}

/**
 * Asynchronous read prioritizing IndexedDB, with transparent fallback & migration from localStorage.
 */
export async function getStorageItem<T>(key: string, fallback: T): Promise<T> {
  // 1. Try IndexedDB
  try {
    const db = await getIDB();
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (result !== undefined && result !== null) {
      return result;
    }
  } catch {
    // IndexedDB failed or empty, proceed to localStorage check
  }

  // 2. Check localStorage fallback & migrate
  if (typeof window !== 'undefined') {
    try {
      const localItem = localStorage.getItem(key);
      if (localItem !== null) {
        const parsed = JSON.parse(localItem) as T;
        // Transparently migrate into IndexedDB
        setStorageItem(key, parsed).catch(() => {});
        return parsed;
      }
    } catch {
      // LocalStorage access issue
    }
  }

  return fallback;
}

/**
 * Asynchronous write to IndexedDB, with safe, bounded mirror to localStorage.
 * Handles QuotaExceededError automatically without throwing or corrupting storage.
 */
export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  let savedToIdb = false;

  // 1. Persist to IndexedDB (virtually unlimited quota for large base64 sleeves & cards)
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    savedToIdb = true;
  } catch (idbErr) {
    console.warn('IndexedDB persistence error:', idbErr);
  }

  // 2. Attempt lightweight localStorage mirror for synchronous boot if small enough (< 250KB)
  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length < 250000) {
        localStorage.setItem(key, serialized);
      } else if (savedToIdb) {
        // If data is large and already safely secured in IndexedDB, remove the oversized copy
        // from localStorage to immediately free quota for other keys!
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    } catch (localErr: any) {
      // QuotaExceededError or security restriction
      if (savedToIdb) {
        // Clean up from localStorage so other essential small keys don't fail
        try {
          localStorage.removeItem(key);
        } catch {}
      } else {
        console.warn('Storage quota reached in both stores:', localErr);
      }
    }
  }
}

/**
 * Remove an item from both IndexedDB and localStorage
 */
export async function removeStorageItem(key: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}
