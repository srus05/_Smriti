/**
 * SMRITI OFFLINE SYNC SERVICE
 * Keeps locally recorded cognitive sessions available until the authenticated
 * elderly user can synchronize them with the existing batch sync endpoint.
 */

import { offlineDb } from './offline-db.js';

const QUEUE_KEY = 'smriti_offline_session_queue';
const CACHE_PREFIX = 'smriti_cached_activity_pack_';

class OfflineSyncService {
  constructor() {
    this.isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    this.connectivityQuality = this.isOnline ? 'online' : 'offline';
    this.listeners = new Set();
    this.isSyncing = false;
    this.retryTimer = null;
    this.retryDelayMs = 3000;
    this.maxRetryDelayMs = 30000;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  getStatusMessage(status) {
    return {
      online: 'Online',
      degraded: 'Weak connection � using saved activities',
      offline: 'Offline � using saved activities',
      syncing: 'Syncing saved sessions�',
      synced: 'Progress synchronized',
      queued: 'Activity progress saved on this device.'
    }[status] || 'Online';
  }

  onStatusChange(fn) {
    if (typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    fn({ isOnline: this.isOnline, quality: this.connectivityQuality, status: this.connectivityQuality, message: this.getStatusMessage(this.connectivityQuality) });
    return () => this.listeners.delete(fn);
  }

  notifyStatus(status, message = this.getStatusMessage(status)) {
    if (status === 'online' || status === 'degraded' || status === 'offline') this.connectivityQuality = status;
    for (const listener of this.listeners) {
      try {
        listener({ isOnline: this.isOnline, quality: this.connectivityQuality, status, message });
      } catch (error) {
        console.error('[OfflineSync] Status listener error:', error);
      }
    }
  }

  checkConnectivity() {
    const browserOnline = typeof navigator === 'undefined' || navigator.onLine;
    if (!browserOnline) {
      this.handleOffline();
      return 'offline';
    }
    if (!this.isOnline) {
      void this.handleOnline();
      return 'online';
    }
    return this.connectivityQuality;
  }

  handleOffline() {
    this.isOnline = false;
    this.connectivityQuality = 'offline';
    this.notifyStatus('offline');
  }

  async handleOnline() {
    this.isOnline = true;
    this.connectivityQuality = 'online';
    this.retryDelayMs = 3000;
    this.notifyStatus('syncing', 'Back online � syncing your progress�');
    return this.syncPendingQueue();
  }

  async cacheActivityPack(elderlyUserId, pack) {
    if (!elderlyUserId || !pack) return;
    const cachedAt = new Date().toISOString();
    try {
      await offlineDb.set('activityPacks', { id: `pack_${elderlyUserId}`, elderlyUserId, pack, cachedAt });
      if (Array.isArray(pack.activities)) {
        for (const activity of pack.activities) {
          if (activity?.activityId) await offlineDb.set('activities', { ...activity, elderlyUserId });
        }
      }
    } catch (error) {
      console.warn('[OfflineSync] IndexedDB activity cache unavailable:', error);
    }
    try {
      localStorage.setItem(`${CACHE_PREFIX}${elderlyUserId}`, JSON.stringify({ cachedAt, pack }));
    } catch (error) {
      console.warn('[OfflineSync] local activity cache unavailable:', error);
    }
  }

  async getCachedActivityPack(elderlyUserId) {
    if (!elderlyUserId) return null;
    try {
      const cached = await offlineDb.get('activityPacks', `pack_${elderlyUserId}`);
      if (cached?.pack) return cached.pack;
    } catch (error) {
      console.warn('[OfflineSync] IndexedDB activity lookup unavailable:', error);
    }
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${elderlyUserId}`);
      const cached = raw ? JSON.parse(raw) : null;
      return cached?.pack && typeof cached.pack === 'object' ? cached.pack : null;
    } catch (error) {
      console.warn('[OfflineSync] local activity lookup unavailable:', error);
      return null;
    }
  }

  async queueOfflineSession(session) {
    if (!session || typeof session !== 'object') return;
    const id = session.id || session.activityId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const queuedSession = { ...session, id, offlineRecorded: true, queuedAt: new Date().toISOString() };
    const queueItem = { id, session: queuedSession, status: 'pending', retryCount: 0, createdAt: queuedSession.queuedAt };
    try {
      await offlineDb.set('syncQueue', queueItem);
      await offlineDb.set('sessions', { ...queuedSession, syncStatus: 'pending' });
    } catch (error) {
      console.warn('[OfflineSync] IndexedDB queue unavailable; using local fallback:', error);
      const queue = this._getLegacyQueue();
      if (!queue.some((item) => item?.id === id)) {
        queue.push(queuedSession);
        try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch (_) {}
      }
    }
    this.notifyStatus('queued');
    if (this.isOnline) setTimeout(() => void this.syncPendingQueue(), 800);
  }

  _getLegacyQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  async getPendingQueue() {
    try {
      const items = await offlineDb.getAll('syncQueue');
      const queued = items.filter((item) => item.status === 'pending' || item.status === 'failed').map((item) => item.session);
      if (queued.length) return queued;
    } catch (_) {}
    return this._getLegacyQueue();
  }

  async syncPendingQueue() {
    if (!this.isOnline || this.isSyncing) return { skipped: true, reason: this.isOnline ? 'already_syncing' : 'offline' };
    this.isSyncing = true;
    try {
      const indexedItems = await offlineDb.getAll('syncQueue').catch(() => []);
      const queuedItems = indexedItems.filter((item) => item.status === 'pending' || item.status === 'failed');
      const sessionsById = new Map(queuedItems.map((item) => [item.id, item.session]));
      for (const session of this._getLegacyQueue()) if (session?.id && !sessionsById.has(session.id)) sessionsById.set(session.id, session);
      const sessions = [...sessionsById.values()];

      if (!sessions.length) {
        this.notifyStatus('online');
        return { success: true, syncedCount: 0 };
      }

      const token = localStorage.getItem('smriti_session_token') || sessionStorage.getItem('smriti_session_token');
      if (!token) return { success: false, skipped: true, reason: 'missing_authentication' };
      this.notifyStatus('syncing', `Syncing ${sessions.length} saved exercise(s)�`);
      const response = await fetch('/api/sync/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessions })
      });
      if (!response.ok) throw new Error(`Sync request failed: HTTP ${response.status}`);
      const result = await response.json();
      const successfulIds = new Set(Array.isArray(result.results) ? result.results.filter((entry) => entry?.success && entry.id).map((entry) => entry.id) : []);
      if (result.success && successfulIds.size === 0 && !result.errors) sessions.forEach((session) => successfulIds.add(session.id));

      for (const item of queuedItems) {
        if (successfulIds.has(item.id)) await offlineDb.delete('syncQueue', item.id);
        else await offlineDb.set('syncQueue', { ...item, status: 'failed', retryCount: (item.retryCount || 0) + 1 });
      }
      const remainingLegacy = this._getLegacyQueue().filter((session) => !successfulIds.has(session?.id));
      if (remainingLegacy.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingLegacy));
      else localStorage.removeItem(QUEUE_KEY);

      if (successfulIds.size === sessions.length) {
        this.retryDelayMs = 3000;
        this.notifyStatus('synced');
      } else {
        this.connectivityQuality = 'degraded';
        this.notifyStatus('degraded', `${successfulIds.size} session(s) synchronized; remaining sessions will retry.`);
        this.scheduleRetry();
      }
      return result;
    } catch (error) {
      this.connectivityQuality = 'degraded';
      this.notifyStatus('degraded', 'Connection is weak; saved sessions will retry automatically.');
      this.scheduleRetry();
      return { success: false, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  scheduleRetry() {
    if (!this.isOnline || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncPendingQueue();
    }, this.retryDelayMs);
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, this.maxRetryDelayMs);
  }
}

export const offlineSyncService = new OfflineSyncService();
if (typeof window !== 'undefined') window.offlineSyncService = offlineSyncService;
