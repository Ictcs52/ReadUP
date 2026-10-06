import type { AppData } from './types';

export const defaultData: AppData = { version: 1, sessions: [], settings: { largeText: false, sound: true, slow: true, calm: true } };
let db: IDBDatabase | null = null;
let queue: Promise<void> = Promise.resolve();

export async function loadData(): Promise<AppData> {
  db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('readtech-local-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('app');
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database blocked'));
    req.onsuccess = () => resolve(req.result);
  });
  db.onversionchange = () => { db?.close(); db = null; };
  return new Promise((resolve, reject) => {
    const req = db!.transaction('app').objectStore('app').get('snapshot');
    req.onsuccess = () => {
      const raw = req.result;
      if (!raw) resolve(structuredClone(defaultData));
      else if (raw.version === 1 && Array.isArray(raw.sessions) && raw.settings) resolve(raw);
      else reject(new Error('Unsupported saved data'));
    };
    req.onerror = () => reject(req.error);
  });
}

export function saveData(data: AppData): Promise<void> {
  const snapshot = structuredClone(data);
  queue = queue.catch(() => {}).then(() => new Promise<void>((resolve, reject) => {
    if (!db) { reject(new Error('Storage unavailable')); return; }
    const tx = db.transaction('app', 'readwrite');
    tx.objectStore('app').put(snapshot, 'snapshot');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Save aborted'));
  }));
  return queue;
}
