const DB_NAME = 'luckytodo-v1';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('entities')) {
        const store = db.createObjectStore('entities', { keyPath: 'id' });
        store.createIndex('byType', 'entityType', { unique: false });
        store.createIndex('bySync', 'syncStatus', { unique: false });
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'opId' });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeNames, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    const stores = storeNames.map((n) => t.objectStore(n));
    const result = fn(...stores);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

export async function kvGet(key, fallback = null) {
  return tx(['kv'], 'readonly', (kv) => {
    return new Promise((resolve) => {
      const r = kv.get(key);
      r.onsuccess = () => resolve(r.result === undefined ? fallback : r.result);
    });
  });
}

export async function kvSet(key, value) {
  return tx(['kv'], 'readwrite', (kv) => kv.put(value, key));
}

export async function kvDel(key) {
  return tx(['kv'], 'readwrite', (kv) => kv.delete(key));
}

export async function putEntity(entity) {
  return tx(['entities'], 'readwrite', (s) => s.put(entity));
}

export async function getEntity(id) {
  return tx(['entities'], 'readonly', (s) => {
    return new Promise((resolve) => {
      const r = s.get(id);
      r.onsuccess = () => resolve(r.result || null);
    });
  });
}

export async function allEntities() {
  return tx(['entities'], 'readonly', (s) => {
    return new Promise((resolve) => {
      const r = s.getAll();
      r.onsuccess = () => resolve(r.result || []);
    });
  });
}

export async function entitiesByType(type) {
  const all = await allEntities();
  return all.filter((e) => e.entityType === type && !e.deletedAt);
}

export async function enqueue(op) {
  return tx(['queue'], 'readwrite', (q) => q.put(op));
}

export async function listQueue() {
  return tx(['queue'], 'readonly', (q) => {
    return new Promise((resolve) => {
      const r = q.getAll();
      r.onsuccess = () => resolve(r.result || []);
    });
  });
}

export async function dequeue(opId) {
  return tx(['queue'], 'readwrite', (q) => q.delete(opId));
}

export async function putBlob(id, blob, meta = {}) {
  return tx(['blobs'], 'readwrite', (b) => b.put({ id, blob, ...meta }));
}

export async function getBlob(id) {
  return tx(['blobs'], 'readonly', (b) => {
    return new Promise((resolve) => {
      const r = b.get(id);
      r.onsuccess = () => resolve(r.result || null);
    });
  });
}

export function uuid() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}
