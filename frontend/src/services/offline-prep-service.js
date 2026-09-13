/**
 * SMRITI OFFLINE PREPARATION SERVICE
 * Coordinates the "Prepare for Offline Use" workflow:
 * 1. Pre-caches Application Shell & core CSS/JS.
 * 2. Downloads and stores cognitive activities into IndexedDB.
 * 3. Downloads and stores personalized family, routines, and memories.
 * 4. Caches essential media assets (photos and audio snippets) into Cache API.
 * 5. Provides live granular progress callbacks for accessible elderly-friendly UI.
 */

import { offlineDb } from './offline-db.js';
import { offlineSyncService } from './offline-sync-service.js';

class OfflinePrepService {
  /**
   * Prepares Smriti for complete offline usage
   * @param {string} elderlyUserId
   * @param {function} onProgress - Callback receiving { step, label, percent, done }
   */
  async prepareForOfflineUse(elderlyUserId, onProgress = () => {}) {
    if (!elderlyUserId) throw new Error('elderlyUserId is required for offline preparation');

    const notify = (step, label, percent, done = false) => {
      try {
        onProgress({ step, label, percent, done });
      } catch (e) {
        console.error('[OfflinePrep] Progress callback error:', e);
      }
    };

    let totalActivities = 0;
    let cachedMediaCount = 0;

    try {
      // =========================================================================
      // STEP 1: Application Shell & Critical Assets (0% -> 25%)
      // =========================================================================
      notify(1, 'Caching Application Shell & Core Styles...', 10);

      if ('caches' in window) {
        const shellCache = await caches.open('smriti-shell-v2');
        const coreUrls = [
          '/',
          '/senior-space',
          '/caretaker-studio',
          '/auth',
          '/games',
          '/src/pages/senior-space.html',
          '/src/pages/caretaker-studio.html',
          '/src/auth/auth.html',
          '/src/styles/styles.css',
          '/src/services/api-client.js',
          '/src/services/firebase-client.js',
          '/src/services/relationship-client.js',
          '/src/services/media-client.js',
          '/src/services/profile-client.js',
          '/src/services/voice-service.js',
          '/src/services/offline-db.js',
          '/src/services/offline-sync-service.js',
          '/src/services/cognitive-client.js',
          '/src/services/offline-prep-service.js',
          '/src/components/audio.js',
          '/src/auth/auth-state.js',
          '/src/utils/router.js',
          '/src/services/sw-register.js',
          '/src/components/vr/vr-ui.js',
          '/src/components/vr/vr-engine.js',
          '/src/components/vr/vr-interaction.js',
          '/src/components/vr/vr-atmosphere.js',
          '/src/components/vr/vr-memory-wall.js',
          '/src/components/vr/vr-game-session.js',
  '/src/components/vr/vr-talk-companion.js',
          '/src/components/vr/vr-talk-companion.js',
          '/manifest.json'
        ];

        for (const url of coreUrls) {
          try {
            await shellCache.add(url);
          } catch (e) {
            console.warn(`[OfflinePrep] Optional shell asset skip (${url}):`, e.message);
          }
        }

        // Cache external CDN resources
        const cdnCache = await caches.open('smriti-cdn-v1');
        const cdnUrls = [
          'https://cdn.tailwindcss.com',
          'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
          'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400;1,500&display=swap'
        ];
        for (const cdnUrl of cdnUrls) {
          try {
            await cdnCache.add(cdnUrl);
          } catch (e) {
            console.warn(`[OfflinePrep] Optional CDN asset skip (${cdnUrl}):`, e.message);
          }
        }
      }

      notify(1, '✓ Application Shell ready', 25);

      // =========================================================================
      // STEP 2: Cognitive Activity Packs (25% -> 50%)
      // =========================================================================
      notify(2, 'Downloading Cognitive Activity Packs...', 35);

      const token = localStorage.getItem('smriti_session_token') || sessionStorage.getItem('smriti_session_token');
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      // Fetch activity packs with timeout to avoid hanging indefinitely
      const fetchWithTimeout = (resource, options = {}) => {
        const { timeout = 10000 } = options; // 10 seconds default
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        return fetch(resource, {
          ...options,
          signal: controller.signal
        }).finally(() => clearTimeout(id));
      };
      try {
        const activitiesRes = await fetchWithTimeout(`/api/cognitive/activities/${elderlyUserId}`, {
          headers: { ...authHeaders }
        });
        if (activitiesRes.ok) {
          const packData = await activitiesRes.json();
          await offlineSyncService.cacheActivityPack(elderlyUserId, packData);
          totalActivities = packData?.activities?.length || 0;
        } else {
          console.warn('[OfflinePrep] Activities fetch failed with status', activitiesRes.status);
        }
      } catch (fetchErr) {
        console.warn('[OfflinePrep] Activities fetch error (likely timeout):', fetchErr.message);
      }

      notify(2, `✓ Cognitive Activities ready (${totalActivities} activities)`, 50);

      // =========================================================================
      // STEP 3: Personalized Memory, Family & Routine Datasets (50% -> 75%)
      // =========================================================================
      notify(3, 'Storing Family, Routine, and Memory Vault...', 60);

      let mediaUrlsToCache = [];

      const previewRes = await fetch(`/api/preview/${elderlyUserId}`, {
        headers: { ...authHeaders }
      });

      if (previewRes.ok) {
        const previewData = await previewRes.json();
        const exp = previewData.experience;

        if (exp) {
          // 1. Store full preview in settings
          await offlineDb.set('settings', {
            key: `preview_${elderlyUserId}`,
            experience: exp,
            cachedAt: new Date().toISOString()
          });

          // 2. Store Family members & collect avatar/photos
          if (Array.isArray(exp.family)) {
            for (const f of exp.family) {
              await offlineDb.set('family', { ...f, elderlyUserId });
              if (f.avatarUrl) mediaUrlsToCache.push(f.avatarUrl);
              if (f.photoURL) mediaUrlsToCache.push(f.photoURL);
            }
          }

          // 3. Store Routines
          if (Array.isArray(exp.routines)) {
            for (const r of exp.routines) {
              await offlineDb.set('routines', { ...r, elderlyUserId });
            }
          }

          // 4. Store Memories & collect photos/audio tracks
          if (exp.memories) {
            const photos = exp.memories.photos || [];
            const audios = exp.memories.audios || [];

            for (const p of photos) {
              await offlineDb.set('memories', { ...p, elderlyUserId, type: 'photo' });
              if (p.runtimeUrl) mediaUrlsToCache.push(p.runtimeUrl);
              if (p.url) mediaUrlsToCache.push(p.url);
            }

            for (const a of audios) {
              await offlineDb.set('memories', { ...a, elderlyUserId, type: 'audio' });
              if (a.runtimeUrl) mediaUrlsToCache.push(a.runtimeUrl);
              if (a.url) mediaUrlsToCache.push(a.url);
            }
          }

          // 5. Store Profile settings
          if (exp.profile) {
            await offlineDb.set('settings', {
              key: `profile_${elderlyUserId}`,
              profile: exp.profile
            });
          }
        }
      }

      notify(3, '✓ Family, Memories, and Daily Routine ready', 75);

      // =========================================================================
      // STEP 4: Cache Required Photos & Audio Snippets (75% -> 95%)
      // =========================================================================
      notify(4, 'Caching required memory photos and audio snippets...', 85);

      if ('caches' in window && mediaUrlsToCache.length > 0) {
        const mediaCache = await caches.open('smriti-media-v1');
        const uniqueUrls = Array.from(new Set(mediaUrlsToCache.filter(Boolean)));

        for (const mUrl of uniqueUrls) {
          try {
            const req = new Request(mUrl, { mode: 'no-cors' });
            const mRes = await fetch(req);
            if (mRes && (mRes.status === 200 || mRes.type === 'opaque')) {
              await mediaCache.put(req, mRes);
              cachedMediaCount++;
            }
          } catch (mErr) {
            console.warn('[OfflinePrep] Media item skip:', mUrl, mErr.message);
          }
        }
      }

      notify(4, `✓ Game media & sounds ready (${cachedMediaCount} media items)`, 95);

      // =========================================================================
      // STEP 5: Finalize Preparation Metadata (100%)
      // =========================================================================
      const timestamp = new Date().toISOString();
      await offlineDb.set('settings', {
        key: `offline_ready_${elderlyUserId}`,
        ready: true,
        preparedAt: timestamp,
        activitiesCount: totalActivities,
        mediaCount: cachedMediaCount
      });

      notify(5, 'Smriti is ready to use offline.', 100, true);

      return {
        success: true,
        preparedAt: timestamp,
        activitiesCount: totalActivities,
        mediaCount: cachedMediaCount
      };

    } catch (err) {
      console.error('[OfflinePrep] Preparation encountered an error:', err);
      notify(0, `Preparation paused: ${err.message}`, 0, false);
      throw err;
    }
  }

  /**
   * Checks if offline content was previously prepared for an elderly user
   */
  async getPreparationStatus(elderlyUserId) {
    if (!elderlyUserId) return null;
    try {
      return await offlineDb.get('settings', `offline_ready_${elderlyUserId}`);
    } catch (e) {
      return null;
    }
  }
}

export const offlinePrepService = new OfflinePrepService();
if (typeof window !== 'undefined') {
  window.offlinePrepService = offlinePrepService;
}
