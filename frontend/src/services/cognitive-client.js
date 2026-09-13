/**
 * SMRITI COGNITIVE CLIENT SERVICE
 * Frontend client for fetching personalized cognitive activities, recording performance,
 * querying caregiver insights, and coordinating offline execution.
 */

import { offlineSyncService } from './offline-sync-service.js';

class CognitiveClient {
  constructor() {
    this.apiBase = '/api/cognitive';
  }

  getAuthHeader() {
    const token = localStorage.getItem('smriti_session_token') ||
      sessionStorage.getItem('smriti_session_token') ||
      (typeof window !== 'undefined' && window.ApiClient?.getToken ? window.ApiClient.getToken() : null);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * Fetches a personalized activity pack, with transparent offline cache fallback
   */
  async fetchActivityPack(elderlyUserId, options = {}) {
    if (!navigator.onLine) {
      const cached = offlineSyncService.getCachedActivityPack(elderlyUserId);
      if (cached) return cached;
    }

    try {
      const query = new URLSearchParams();
      if (options.language) query.append('language', options.language);
      if (options.difficulty) query.append('difficulty', options.difficulty);

      const res = await fetch(`${this.apiBase}/activities/${elderlyUserId}?${query.toString()}`, {
        headers: { ...this.getAuthHeader() }
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      // Cache for offline resilience
      offlineSyncService.cacheActivityPack(elderlyUserId, data);
      return data;
    } catch (err) {
      console.warn('[CognitiveClient] Network fetch failed, checking offline cache...', err);
      const cached = offlineSyncService.getCachedActivityPack(elderlyUserId);
      if (cached) return cached;
      throw err;
    }
  }

  /**
   * Records a completed session, automatically queuing locally if offline
   */
  async recordSession(sessionData) {
    if (!navigator.onLine) {
      offlineSyncService.queueOfflineSession(sessionData);
      return {
        success: true,
        offlineQueued: true,
        session: sessionData,
        message: 'Session saved locally'
      };
    }

    try {
      const res = await fetch(`${this.apiBase}/session/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify(sessionData)
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[CognitiveClient] Online submit failed, queuing offline...', err);
      offlineSyncService.queueOfflineSession(sessionData);
      return {
        success: true,
        offlineQueued: true,
        session: sessionData
      };
    }
  }

  /**
   * Fetches real performance insights for Caretaker / Healthcare monitoring
   */
  async fetchInsights(elderlyUserId) {
    const res = await fetch(`${this.apiBase}/insights/${elderlyUserId}`, {
      headers: { ...this.getAuthHeader() }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
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
   * Generates opening conversation prompt for Talk & Recall
   */
  async fetchConversationPrompt(elderlyUserId, language = 'as') {
    const query = new URLSearchParams({ language });
    const res = await fetch(`${this.apiBase}/conversation/prompt/${elderlyUserId}?${query.toString()}`, {
      headers: { ...this.getAuthHeader() }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  }

  /**
   * Sends user message / speech transcript to Talk & Recall conversational companion
   */
  async sendConversationMessage(payload) {
    const res = await fetch(`${this.apiBase}/conversation/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  }

  /**
   * Synthesizes neural speech using server-side OpenAI TTS
   * @param {string} text - Response text to speak aloud
   * @param {string} [language='as'] - Language code
   * @returns {Promise<Blob>} Playable audio blob
   */
  async synthesizeSpeech(text, language = 'as') {
    const res = await fetch(`${this.apiBase}/conversation/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader()
      },
      body: JSON.stringify({ text, language })
    });
    if (!res.ok) {
      let errMsg = `TTS service returned HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.message || errJson?.error) {
          errMsg = errJson.message || errJson.error;
        }
      } catch (e) {}
      throw new Error(errMsg);
    }
    return await res.blob();
  }
}

export const cognitiveClient = new CognitiveClient();
if (typeof window !== 'undefined') {
  window.CognitiveClient = cognitiveClient;
}

