// db.js — tiny IndexedDB wrapper. Stores: drills, mocks, cards, settings.
// All functions return Promises. Records use `id` as key except cards (patternId) and settings (key).

const DB_NAME = 'dsa-dojo';
const DB_VERSION = 1;
const STORES = {
  drills:   { keyPath: 'id',        indexes: [['date', 'date']] },
  mocks:    { keyPath: 'id',        indexes: [['date', 'date']] },
  cards:    { keyPath: 'patternId', indexes: [['due', 'due']] },
  settings: { keyPath: 'key',       indexes: [] },
};

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, spec] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: spec.keyPath });
          for (const [idxName, path] of spec.indexes) store.createIndex(idxName, path);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    try { result = fn(s); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  get: (store, key) => tx(store, 'readonly', s => s.get(key)),
  all: (store) => tx(store, 'readonly', s => s.getAll()),
  put: (store, value) => tx(store, 'readwrite', s => s.put(value)),
  del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
  clear: (store) => tx(store, 'readwrite', s => s.clear()),
  async setting(key, fallback) {
    const r = await db.get('settings', key);
    return r ? r.value : fallback;
  },
  setSetting: (key, value) => db.put('settings', { key, value }),
  async exportAll() {
    const out = { exportedAt: new Date().toISOString(), version: DB_VERSION };
    for (const name of Object.keys(STORES)) out[name] = await db.all(name);
    return out;
  },
  async importAll(data, { merge = true } = {}) {
    for (const name of Object.keys(STORES)) {
      if (!Array.isArray(data[name])) continue;
      if (!merge) await db.clear(name);
      for (const rec of data[name]) await db.put(name, rec);
    }
  },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);
