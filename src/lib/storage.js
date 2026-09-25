// Persistencia local-first: IndexedDB con respaldo en localStorage.
// Nada sale del navegador.

const DB_NAME = 'balance-finanzas';
const STORE = 'kv';
const KEY = 'state-v1';
const LS_KEY = 'balance-finanzas:state-v1';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState() {
  try {
    const v = await idbGet(KEY);
    if (v) return v;
  } catch (e) {
    console.warn('[storage] IndexedDB falló, uso localStorage', e);
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveState(state) {
  const payload = { ...state, savedAt: new Date().toISOString() };
  try {
    await idbSet(KEY, payload);
    return 'indexeddb';
  } catch (e) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      return 'localstorage';
    } catch (err) {
      console.error('[storage] No se pudo guardar', err);
      return null;
    }
  }
}

export async function clearState() {
  try { await idbDelete(KEY); } catch { /* sin IndexedDB */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* sin localStorage */ }
}
