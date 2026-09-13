/**
 * SMRITI PROFILE & PERSONALIZATION CLIENT SERVICE
 * Frontend API client for managing Elderly Profiles, Family Datasets, Routines, Reminders, and Preview data.
 */

const ProfileClient = {
  /**
   * Profile Settings (Personal details, Language, Culture, Accessibility, Cognitive prefs)
   */
  async getProfile(elderlyUserId) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request(`/api/profile/${elderlyUserId}`);
    return res.profile;
  },

  async saveProfile(elderlyUserId, profileData) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request(`/api/profile/${elderlyUserId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
    return res.profile;
  },

  /**
   * Family & Contacts (Recognition & Personality dataset)
   */
  async getFamily(elderlyUserId) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request(`/api/family/elderly/${elderlyUserId}`);
    return res.family || [];
  },

  async addFamilyMember(data) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request('/api/family', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.member;
  },

  async updateFamilyMember(id, data) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request(`/api/family/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.member;
  },

  async deleteFamilyMember(id) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    return window.ApiClient.request(`/api/family/${id}`, {
      method: 'DELETE'
    });
  },

  /**
   * Daily Routines (Schedule anchors)
   */
  async getRoutines(elderlyUserId) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request(`/api/routine/elderly/${elderlyUserId}`);
    return res.routine || [];
  },

  async addRoutine(data) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request('/api/routine', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.item;
  },

  async updateRoutine(id, data) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request(`/api/routine/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.item;
  },

  async deleteRoutine(id) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    return window.ApiClient.request(`/api/routine/${id}`, {
      method: 'DELETE'
    });
  },

  /**
   * Health & Reminders (Care Support)
   */
  async getReminders(elderlyUserId) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request(`/api/reminders/elderly/${elderlyUserId}`);
    return res.reminders || [];
  },

  async addReminder(data) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.reminder;
  },

  async updateReminder(id, data) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    const res = await window.ApiClient.request(`/api/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.reminder;
  },

  async deleteReminder(id) {
    if (!window.ApiClient) throw new Error('ApiClient is not loaded');
    return window.ApiClient.request(`/api/reminders/${id}`, {
      method: 'DELETE'
    });
  },

  /**
   * Aggregated Experience Preview (with seamless offline IndexedDB fallback)
   */
  async getPreview(elderlyUserId) {
    if (!elderlyUserId) return null;

    // 1. Try network if online
    if (navigator.onLine && window.ApiClient) {
      try {
        const res = await window.ApiClient.request(`/api/preview/${elderlyUserId}`);
        if (res && res.experience) {
          // Cache in IndexedDB for offline resilience
          if (window.offlineDb) {
            try {
              await window.offlineDb.set('settings', {
                key: `preview_${elderlyUserId}`,
                experience: res.experience,
                cachedAt: new Date().toISOString()
              });
            } catch (e) {}
          }
          return res.experience;
        }
      } catch (err) {
        console.warn('[ProfileClient] Network preview fetch failed, checking offline cache...', err.message);
      }
    }

    // 2. Check IndexedDB cached preview
    if (window.offlineDb) {
      try {
        const cached = await window.offlineDb.get('settings', `preview_${elderlyUserId}`);
        if (cached?.experience) {
          return cached.experience;
        }

        // 3. Synthesize from individual local stores if available
        const [family, routines, memories, profileSettings] = await Promise.all([
          window.offlineDb.getAll('family').catch(() => []),
          window.offlineDb.getAll('routines').catch(() => []),
          window.offlineDb.getAll('memories').catch(() => []),
          window.offlineDb.get('settings', `profile_${elderlyUserId}`).catch(() => null)
        ]);

        const userFamily = family.filter(item => item.elderlyUserId === elderlyUserId);
        const userRoutines = routines.filter(item => item.elderlyUserId === elderlyUserId);
        const userMemories = memories.filter(item => item.elderlyUserId === elderlyUserId);
        const photos = userMemories.filter(m => m.type === 'photo');
        const audios = userMemories.filter(m => m.type === 'audio');

        return {
          elderlyUserId,
          displayName: profileSettings?.profile?.displayName || 'Senior',
          greeting: 'Welcome back to your Memory Sanctuary ❤️',
          profile: profileSettings?.profile || { preferredLanguage: 'as' },
          family: userFamily,
          memories: {
            total: userMemories.length,
            photos,
            audios
          },
          routines: userRoutines,
          reminders: [],
          accessibility: { largeText: true, highContrast: false }
        };
      } catch (idbErr) {
        console.warn('[ProfileClient] IndexedDB preview read error:', idbErr);
      }
    }

    // 4. Safe minimal fallback to prevent UI breakage
    return {
      elderlyUserId,
      displayName: 'Senior',
      greeting: 'Welcome to your Memory Sanctuary ❤️',
      profile: { preferredLanguage: 'as' },
      family: [],
      memories: { total: 0, photos: [], audios: [] },
      routines: [],
      reminders: []
    };
  }
};

window.ProfileClient = ProfileClient;
