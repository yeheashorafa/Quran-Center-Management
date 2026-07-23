"use client";

const DB_NAME = "qcm_offline_db";
const DB_VERSION = 3;

export const STORES = {
  SESSION_DRAFTS: "session_drafts",
  SYNC_QUEUE: "sync_queue",
  OFFLINE_PROFILE: "offline_user_profile",
  TEACHER_CACHE: "teacher_cache",
  EXAMINER_CACHE: "examiner_cache",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getOfflineDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB غير مدعوم في هذا المتصفح."));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.SESSION_DRAFTS)) {
        const store = db.createObjectStore(STORES.SESSION_DRAFTS, { keyPath: "id" });
        store.createIndex("by_teacher_halaqa", ["teacherId", "halaqaId", "sessionDate"], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: "queueId" });
        queueStore.createIndex("by_status", "status", { unique: false });
        queueStore.createIndex("by_created", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.OFFLINE_PROFILE)) {
        db.createObjectStore(STORES.OFFLINE_PROFILE, { keyPath: "role" });
      }

      if (!db.objectStoreNames.contains(STORES.TEACHER_CACHE)) {
        db.createObjectStore(STORES.TEACHER_CACHE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.EXAMINER_CACHE)) {
        db.createObjectStore(STORES.EXAMINER_CACHE, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(new Error("تعذر فتح قاعدة البيانات المحلية IndexedDB."));
    };
  });

  return dbPromise;
}

export async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB idbGet error:", err);
    return null;
  }
}

export async function idbPut<T>(storeName: string, value: T): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB idbPut error:", err);
  }
}

export async function idbDelete(storeName: string, key: string): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB idbDelete error:", err);
  }
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB idbGetAll error:", err);
    return [];
  }
}

export async function idbClear(storeName: string): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB idbClear error:", err);
  }
}
