/**
 * SMRITI LIGHTWEIGHT INDEXEDDB SERVICE
 * Production-ready, native Promise-based IndexedDB storage for offline activities,
 * personalized memories, routines, family data, sessions, and synchronization queues.
 */

const DB_NAME = 'smriti_offline_db';
const DB_VERSION = 1;

class OfflineDB {
  constructor() {
    this.db = null;
    this._initPromise = null;
  }

  async getDB() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported in this browser'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Cognitive activities
        if (!db.objectStoreNames.contains('activities')) {
          const actStore = db.createObjectStore('activities', { keyPath: 'activityId' });
          actStore.createIndex('category', 'category', { unique: false });
          actStore.createIndex('subType', 'subType', { unique: false });
        }

        // 2. Bundled activity packs
        if (!db.objectStoreNames.contains('activityPacks')) {
          db.createObjectStore('activityPacks', { keyPath: 'id' });
        }

        // 3. Game progress & streaks
        if (!db.objectStoreNames.contains('gameProgress')) {
          db.createObjectStore('gameProgress', { keyPath: 'id' });
        }

        // 4. Completed cognitive sessions
        if (!db.objectStoreNames.contains('sessions')) {
          const sessStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessStore.createIndex('elderlyUserId', 'elderlyUserId', { unique: false });
          sessStore.createIndex('completedAt', 'completedAt', { unique: false });
          sessStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // 5. Personalized memories (photos, audios)
        if (!db.objectStoreNames.contains('memories')) {
          const memStore = db.createObjectStore('memories', { keyPath: 'id' });
          memStore.createIndex('elderlyUserId', 'elderlyUserId', { unique: false });
        }

        // 6. Family members & face associations
        if (!db.objectStoreNames.contains('family')) {
          const famStore = db.createObjectStore('family', { keyPath: 'id' });
          famStore.createIndex('elderlyUserId', 'elderlyUserId', { unique: false });
        }

        // 7. Daily routines
        if (!db.objectStoreNames.contains('routines')) {
          const routStore = db.createObjectStore('routines', { keyPath: 'id' });
          routStore.createIndex('elderlyUserId', 'elderlyUserId', { unique: false });
        }

        // 8. Application settings & offline profile
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // 9. Offline synchronization queue
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        // Auto-migrate any legacy localStorage items
        await this._migrateLegacyLocalStorage();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[OfflineDB] Failed to open IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });

    return this._initPromise;
  }

  /**
   * Generic get by key
   */
  async get(storeName, key) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Generic put/set item
   */
  async set(storeName, value) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Generic getAll items
   */
  async getAll(storeName) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Generic delete item by key
   */
  async delete(storeName, key) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Generic clear store
   */
  async clear(storeName) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Migrates legacy localStorage queues and cached activity packs to IndexedDB
   */
  async _migrateLegacyLocalStorage() {
    try {
      if (typeof localStorage === 'undefined') return;

      // 1. Migrate session queue
      const rawQueue = localStorage.getItem('smriti_offline_session_queue');
      if (rawQueue) {
        const queue = JSON.parse(rawQueue);
        if (Array.isArray(queue) && queue.length > 0) {
          for (const item of queue) {
            await this.set('syncQueue', {
              id: item.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              session: item,
              status: 'pending',
              retryCount: 0,
              createdAt: item.queuedAt || new Date().toISOString()
            });
          }
          localStorage.removeItem('smriti_offline_session_queue');
          console.log(`[OfflineDB] Migrated ${queue.length} legacy sessions to IndexedDB syncQueue.`);
        }
      }

      // 2. Migrate cached activity packs
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('smriti_cached_activity_pack_')) {
          const elderlyId = k.replace('smriti_cached_activity_pack_', '');
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.pack) {
              await this.set('activityPacks', {
                id: `pack_${elderlyId}`,
                elderlyUserId: elderlyId,
                pack: parsed.pack,
                cachedAt: parsed.cachedAt || new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[OfflineDB] Legacy localStorage migration notice:', e);
    }
  }
}

export const offlineDb = new OfflineDB();
if (typeof window !== 'undefined') {
  window.offlineDb = offlineDb;
}
