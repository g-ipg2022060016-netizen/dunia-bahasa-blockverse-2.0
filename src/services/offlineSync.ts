import { WorldData } from '../types/blockverse';
import { recordStudentProgress } from './api';

const DB_NAME = 'blockverse_offline_db';
const DB_VERSION = 1;
const WORLDS_STORE = 'cached_worlds';
const QUEUE_STORE = 'pending_progress';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WORLDS_STORE)) {
        db.createObjectStore(WORLDS_STORE, { keyPath: 'worldCode' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'queueId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheWorldForOffline(world: WorldData): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORLDS_STORE, 'readwrite');
    tx.objectStore(WORLDS_STORE).put({
      ...world,
      worldCode: world.worldCode.toUpperCase(),
      cachedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineCachedWorld(worldCode: string): Promise<WorldData | null> {
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(WORLDS_STORE, 'readonly');
      const req = tx.objectStore(WORLDS_STORE).get(worldCode.toUpperCase());
      req.onsuccess = () => resolve((req.result as WorldData) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function listOfflineCachedWorlds(): Promise<(WorldData & { cachedAt?: string })[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(WORLDS_STORE, 'readonly');
      const req = tx.objectStore(WORLDS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as (WorldData & { cachedAt?: string })[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function queueOfflineProgress(
  payload: Parameters<typeof recordStudentProgress>[0]
): Promise<void> {
  const db = await openOfflineDb();
  const item = {
    queueId: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    payload,
    queuedAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(item);
    tx.oncomplete = () => resolve();
    reqErrorGuard(tx, reject);
  });
}

function reqErrorGuard(tx: IDBTransaction, reject: (reason?: unknown) => void) {
  tx.onerror = () => reject(tx.error);
}

export async function countPendingOfflineProgress(): Promise<number> {
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

export async function flushOfflineProgressQueue(): Promise<number> {
  if (!navigator.onLine) return 0;
  try {
    const db = await openOfflineDb();
    const items = await new Promise<{ queueId: string; payload: Parameters<typeof recordStudentProgress>[0] }[]>(
      (resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const req = tx.objectStore(QUEUE_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }
    );

    let synced = 0;
    for (const item of items) {
      try {
        await recordStudentProgress(item.payload);
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(QUEUE_STORE, 'readwrite');
          tx.objectStore(QUEUE_STORE).delete(item.queueId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        synced++;
      } catch {
        // Stop on network/auth failure and keep remaining items
        break;
      }
    }
    return synced;
  } catch {
    return 0;
  }
}
