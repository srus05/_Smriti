/**
 * SMRITI COGNITIVE CLIENT SERVICE
 * Frontend client for fetching personalized cognitive activities, recording performance,
 * querying caregiver insights, and coordinating offline/low-connectivity execution.
 */

import { offlineSyncService } from './offline-sync-service.js';
import { offlineDb } from './offline-db.js';

class CognitiveClient {
  constructor() {
    this.apiBase = '/api/cognitive';
  }

  getAuthHeader() {
    const token = localStorage.getItem('smriti_session_token') || sessionStorage.getItem('smriti_session_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * Fetches a personalized activity pack with Fast Local Response + Background Network Update
   */
  async fetchActivityPack(elderlyUserId, options = {}) {
    // 1. Check local IndexedDB cache first
    const cached = await offlineSyncService.getCachedActivityPack(elderlyUserId);

    // If completely offline, return local cache immediately
    if (!navigator.onLine || !offlineSyncService.isOnline) {
      if (cached) return cached;
    }

    // 2. Try network with a 2800ms abort timeout (protecting against weak / slow connections)
    try {
      const query = new URLSearchParams();
      if (options.language) query.append('language', options.language);
      if (options.difficulty) query.append('difficulty', options.difficulty);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2800);

      const res = await fetch(`${this.apiBase}/activities/${elderlyUserId}?${query.toString()}`, {
        headers: { ...this.getAuthHeader() },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      // Persist fresh pack to IndexedDB for offline resilience
      await offlineSyncService.cacheActivityPack(elderlyUserId, data);
      return data;
    } catch (err) {
      console.warn('[CognitiveClient] Network fetch unavailable or slow, falling back to local pack:', err.message);
      if (cached) return cached;
      throw err;
    }
  }

  /**
   * Records a completed session, persisting locally and queueing if offline
   */
  async recordSession(sessionData) {
    // Standardize session record
    const record = {
      ...sessionData,
      id: sessionData.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      completedAt: sessionData.completedAt || new Date().toISOString()
    };

    // If offline or degraded network, save locally without waiting
    if (!navigator.onLine || !offlineSyncService.isOnline) {
      await offlineSyncService.queueOfflineSession(record);
      return {
        success: true,
        offlineQueued: true,
        session: record,
        message: 'Session saved locally on your device'
      };
    }

    // Attempt online submit with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.apiBase}/session/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify(record),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      // Also persist to local IndexedDB sessions store as synced
      await offlineDb.set('sessions', {
        ...record,
        syncStatus: 'synced',
        syncedAt: new Date().toISOString()
      });

      return data;
    } catch (err) {
      console.warn('[CognitiveClient] Online submit failed or timed out, queueing for background sync...', err.message);
      await offlineSyncService.queueOfflineSession(record);
      return {
        success: true,
        offlineQueued: true,
        session: record,
        message: 'Saved locally — will sync automatically when connection improves'
      };
    }
  }

  /**
   * Fetches real performance insights for Caretaker / Healthcare monitoring
   */
  async fetchInsights(elderlyUserId) {
    try {
      const res = await fetch(`${this.apiBase}/insights/${elderlyUserId}`, {
        headers: { ...this.getAuthHeader() }
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      // Local fallback calculation from stored sessions in IndexedDB
      const localSessions = await offlineDb.getAll('sessions');
      const elderlySessions = localSessions.filter(s => s.elderlyUserId === elderlyUserId);
      return {
        success: true,
        insights: {
          totalSessions: elderlySessions.length,
          offlineSessions: elderlySessions.filter(s => s.offlineRecorded).length,
          averageScore: elderlySessions.length ? Math.round(elderlySessions.reduce((sum, s) => sum + (s.score || 0), 0) / elderlySessions.length) : 0,
          categoryBreakdown: { memory: { attempts: elderlySessions.length } }
        }
      };
    }
  }

  /**
   * Fetches active caregiver support alerts
   */
  async fetchAlerts(elderlyUserId) {
    const res = await fetch(`${this.apiBase}/alerts/${elderlyUserId}`, {
      headers: { ...this.getAuthHeader() }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  }

  /**
   * Acknowledges an alert
   */
  async acknowledgeAlert(alertId) {
    const res = await fetch(`${this.apiBase}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { ...this.getAuthHeader() }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  }

  /**
   * Talk & Recall: Generates opening conversation prompt
   * Supports online AI endpoint with offline personalized heuristic fallback
   */
  async fetchConversationPrompt(elderlyUserId, language = 'as') {
    if (navigator.onLine && offlineSyncService.isOnline) {
      try {
        const query = new URLSearchParams({ language });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(`${this.apiBase}/conversation/prompt/${elderlyUserId}?${query.toString()}`, {
          headers: { ...this.getAuthHeader() },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        // Fallback to offline prompt generator below
      }
    }

    return this.getOfflineConversationPrompt(elderlyUserId, language);
  }

  /**
   * Talk & Recall: Offline personalized prompt generator
   */
  async getOfflineConversationPrompt(elderlyUserId, language = 'as') {
    let family = [];
    let routines = [];
    let profile = null;

    try {
      family = await offlineDb.getAll('family');
      routines = await offlineDb.getAll('routines');
      const settings = await offlineDb.get('settings', `profile_${elderlyUserId}`);
      profile = settings?.profile || null;
    } catch (e) {}

    const seniorName = profile?.displayName || 'Senior';
    const topFamily = family.find(f => f.isFavorite) || family[0];
    const topRoutine = routines[0];

    let promptText = '';
    let suggestedReplies = [];

    if (language === 'as') {
      if (topFamily) {
        promptText = `নমস্কাৰ ${seniorName}! অফলাইন স্মৃতি সংগীৰ সৈতে আড্ডা মাৰোঁ আহক। ${topFamily.name} (${topFamily.relationship || 'পৰিয়াল'}) ৰ লগত কটোৱা কোনো মৰমৰ কথা মনত আছেনে?`;
        suggestedReplies = [`${topFamily.name}ৰ কথা কওঁ`, `মই আজি ভাল অনুভৱ কৰিছোঁ`];
      } else {
        promptText = `নমস্কাৰ ${seniorName}! আজিৰ দিনটো কেনে লাগিছে? চাহ খাই ভাল লাগিলনে নাইবা পুৰণি স্মৃতি মনত পৰিছে নেকি?`;
        suggestedReplies = [`মই চাহ খালোঁ`, `পুৰণি কথা কওঁ`];
      }
    } else if (language === 'hi') {
      if (topFamily) {
        promptText = `नमस्ते ${seniorName} जी! ऑफ़लाइन संस्मरण मोड में आपका स्वागत है। क्या आपको ${topFamily.name} (${topFamily.relationship || 'परिवार'}) की कोई मीठी बात याद आ रही है?`;
        suggestedReplies = [`${topFamily.name} की यादें`, `आज का दिन अच्छा है`];
      } else {
        promptText = `नमस्ते ${seniorName} जी! आज आपका मन कैसा है? क्या आपने सुबह की चाय पी? अपनी कोई प्यारी याद साझा करें।`;
        suggestedReplies = [`सुबह की चाय पी ली`, `पुरानी बातें करें`];
      }
    } else {
      if (topFamily) {
        promptText = `Hello ${seniorName}! Welcome to your offline reminiscence space. Would you like to talk about ${topFamily.name} (${topFamily.relationship || 'family'})?`;
        suggestedReplies = [`Tell about ${topFamily.name}`, `I feel good today`];
      } else {
        promptText = `Hello ${seniorName}! How are you feeling today? Would you like to reminisce about morning tea or a cherished memory?`;
        suggestedReplies = [`Enjoyed morning tea`, `Share a memory`];
      }
    }

    return {
      success: true,
      promptText,
      suggestedReplies,
      isOfflineFallback: true
    };
  }

  /**
   * Talk & Recall: Sends user message / speech transcript
   * Supports online AI endpoint with offline empathetic response fallback
   */
  async sendConversationMessage(payload) {
    if (navigator.onLine && offlineSyncService.isOnline) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`${this.apiBase}/conversation/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeader()
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        // Fallback to offline message processor below
      }
    }

    return this.processOfflineConversationMessage(payload);
  }

  /**
   * Talk & Recall: Offline conversational response engine
   */
  async processOfflineConversationMessage(payload) {
    const { elderlyUserId, userMessage, language = 'as' } = payload;

    let replyText = '';
    let suggestedReplies = [];

    if (language === 'as') {
      replyText = `আপোনাৰ কথা শুনি বৰ আনন্দ লাগিল। আপুনি কোৱা "${userMessage}" স্মৃতিবোৰ সদায় মূল্যৱান। আপোনাৰ মনত এনেকুৱা আৰু কিবা আছে নেকি?`;
      suggestedReplies = [`আৰু মনত পৰিছে`, `মনটো শান্ত লাগিছে`];
    } else if (language === 'hi') {
      replyText = `आपकी बात सुनकर बहुत खुशी हुई। आपने जो "${userMessage}" साझा किया, वह बहुत अनमोल है। क्या आप कुछ और याद करना चाहेंगे?`;
      suggestedReplies = [`और याद आ रहा है`, `मन बहुत शांत है`];
    } else {
      replyText = `It is wonderful hearing your thoughts. Your memories about "${userMessage}" are truly special. Is there another memory that comes to mind?`;
      suggestedReplies = [`Another memory`, `Feeling peaceful`];
    }

    // Queue talk conversation session into IndexedDB sync queue
    const sessionRecord = {
      id: `talk_sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      elderlyUserId,
      category: 'emotional_engagement',
      subType: 'talk_and_recall',
      accuracy: 1.0,
      score: 100,
      totalQuestions: 1,
      correctAnswers: 1,
      completed: true,
      userSpeechSample: userMessage,
      completedAt: new Date().toISOString()
    };

    await offlineSyncService.queueOfflineSession(sessionRecord);

    return {
      success: true,
      replyText,
      suggestedReplies,
      isOfflineFallback: true
    };
  }
}

export const cognitiveClient = new CognitiveClient();
if (typeof window !== 'undefined') {
  window.CognitiveClient = cognitiveClient;
}
