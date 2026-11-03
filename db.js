/* IndexedDB wrapper — promise-based, minimal */

const DB_NAME = 'expense-tracker-db';
const DB_VERSION = 1;
export const STORE_TXNS = 'transactions';
export const STORE_META = 'meta';

let dbPromise = null;

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TXNS)) {
        const s = db.createObjectStore(STORE_TXNS, { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('category', 'category');
        s.createIndex('paymentMethod', 'paymentMethod');
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open database'));
    req.onblocked = () => reject(new Error('Database is blocked by another tab. Close other tabs and reload.'));
  });
  return dbPromise;
}

function store(name, mode) {
  return open().then((db) => {
    const t = db.transaction(name, mode);
    t.onabort = () => { dbPromise = null; };
    return t.objectStore(name);
  });
}

function p(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Database error'));
  });
}

export async function getAll(name) {
  return p(await store(name, 'readonly').then((s) => s.getAll()));
}

export async function get(name, key) {
  return p(await store(name, 'readonly').then((s) => s.get(key)));
}

export async function put(name, value) {
  return p(await store(name, 'readwrite').then((s) => s.put(value)));
}

export async function bulkPut(name, values) {
  const s = await store(name, 'readwrite');
  return new Promise((resolve, reject) => {
    const t = s.transaction;
    values.forEach((v) => s.put(v));
    t.oncomplete = () => resolve(true);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Bulk write aborted'));
  });
}

export async function del(name, key) {
  return p(await store(name, 'readwrite').then((s) => s.delete(key)));
}

export async function clear(name) {
  return p(await store(name, 'readwrite').then((s) => s.clear()));
}
