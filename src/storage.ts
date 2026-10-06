import type { AppData } from './types';

export const defaultData: AppData = { version: 1, sessions: [], settings: { largeText: false, sound: true, effectsSound: true, slow: true, calm: false, voiceURI: '', speechRate: 0.85, recordedFirst: true } };
let db: IDBDatabase | null = null;
let queue: Promise<void> = Promise.resolve();

export async function loadData(key = 'snapshot'): Promise<AppData> {
  db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('readtech-local-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('app');
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database blocked'));
    req.onsuccess = () => resolve(req.result);
  });
  db.onversionchange = () => { db?.close(); db = null; };
  return new Promise((resolve, reject) => {
    const req = db!.transaction('app').objectStore('app').get(key);
    req.onsuccess = () => {
      const raw = req.result;
      if (!raw) resolve(structuredClone(defaultData));
      else if (raw.version === 1 && Array.isArray(raw.sessions) && raw.settings) resolve({ ...raw, settings: { ...defaultData.settings, speechRate: raw.settings.slow === false ? 0.95 : 0.85, ...raw.settings } });
      else reject(new Error('Unsupported saved data'));
    };
    req.onerror = () => reject(req.error);
  });
}

export function saveData(data: AppData, key = 'snapshot'): Promise<void> {
  const snapshot = structuredClone(data);
  queue = queue.catch(() => {}).then(() => new Promise<void>((resolve, reject) => {
    if (!db) { reject(new Error('Storage unavailable')); return; }
    const tx = db.transaction('app', 'readwrite');
    tx.objectStore('app').put(snapshot, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Save aborted'));
  }));
  return queue;
}

export async function clearPrivateCache(prefix: string) {
  await queue.catch(() => {});
  if (!db) await loadData();
  await new Promise<void>((resolve, reject) => {
    const tx = db!.transaction('app', 'readwrite');
    const cursor = tx.objectStore('app').openCursor();
    cursor.onsuccess = () => {
      const value = cursor.result;
      if (!value) return;
      if (typeof value.key === 'string' && value.key.startsWith(prefix)) value.delete();
      value.continue();
    };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
