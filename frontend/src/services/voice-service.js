/**
 * SMRITI VOICE ASSISTANCE SERVICE
 * Accessible multilingual speech synthesis (TTS) with natural elderly pacing,
 * plus Web Speech Recognition (STT) for interactive conversational reminiscence.
 */

const LANG_VOICE_MAP = {
  as: 'as-IN', // Assamese (often falls back to Bengali or Indian English voices gracefully)
  bn: 'bn-IN', // Bengali
  hi: 'hi-IN', // Hindi
  en: 'en-IN'  // Indian English
};

// Web Speech STT language mapping (Chrome STT server supports bn-IN, hi-IN, en-IN, but not as-IN)
const STT_LANG_MAP = {
  as: 'bn-IN', // Phonetic harmony for Eastern Indo-Aryan speech capture without triggering language-not-supported
  bn: 'bn-IN',
  hi: 'hi-IN',
  en: 'en-IN'
};

class VoiceService {
  constructor() {
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.voices = [];
    this.isSupported = Boolean(this.synth);
    this.isSpeaking = false;
    this.isListening = false;
    this.currentUtterance = null;
    this.currentAudio = null;
    this.activeAudio = null;
    this.currentAudioUrl = null;
    this.isAudioUnlocked = false;
    this.pendingUtterance = null;
    this.autoplayBanner = null;

    // Speech Recognition setup - store constructor to instantiate fresh session per listening turn
    this.SpeechRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    this.isRecognitionSupported = Boolean(this.SpeechRec);
    this.recognition = null;

    if (this.synth) {
      this.loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }

    this.initAudioUnlock();
  }

  initAudioUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.isAudioUnlocked = true;
      if (window.AudioContext || window.webkitAudioContext) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          ctx.resume().then(() => ctx.close()).catch(() => {});
        } catch (e) {}
      }
      this.hideAutoplayBanner();

      // If an utterance was queued due to autoplay policy rejection, play it now
      if (this.pendingUtterance) {
        const queued = this.pendingUtterance;
        this.pendingUtterance = null;
        console.log('[VoiceService] Audio unlocked by user gesture, playing queued utterance:', queued.text.slice(0, 30));
        this.speak(queued.text, queued.langCode, queued.options);
      }

      window.removeEventListener('click', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };

    window.addEventListener('click', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  showAutoplayBanner() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('smriti-voice-unlock-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'smriti-voice-unlock-banner';
    banner.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full bg-amber-500 text-slate-950 font-bold text-sm sm:text-base shadow-2xl flex items-center gap-3 cursor-pointer hover:bg-amber-400 transition-all border-2 border-white animate-bounce';
    banner.innerHTML = '<span>🔊</span><span>Tap anywhere to enable Smriti\'s voice</span>';
    banner.onclick = () => {
      this.hideAutoplayBanner();
      if (this.pendingUtterance) {
        const queued = this.pendingUtterance;
        this.pendingUtterance = null;
        this.speak(queued.text, queued.langCode, queued.options);
      }
    };
    document.body.appendChild(banner);
    this.autoplayBanner = banner;
  }

  hideAutoplayBanner() {
    if (typeof document === 'undefined') return;
    const banner = document.getElementById('smriti-voice-unlock-banner') || this.autoplayBanner;
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
    this.autoplayBanner = null;
  }

  get isSpeechRecognitionSupported() {
    return this.isRecognitionSupported;
  }

  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  /**
   * Find the highest quality natural voice for a given language (Used for dev fallback only)
   */
  getBestVoice(langCode = 'en') {
    if (!this.voices || this.voices.length === 0) return null;
    const targetLocale = LANG_VOICE_MAP[langCode] || 'en-IN';
    const langPrefix = targetLocale.split('-')[0];

    const premiumMatch = this.voices.find(v => (v.lang === targetLocale || v.lang.startsWith(langPrefix)) && /google|natural|online|premium|neural/i.test(v.name));
    if (premiumMatch) return premiumMatch;

    const exactMatch = this.voices.find(v => v.lang === targetLocale);
    if (exactMatch) return exactMatch;

    const prefixMatch = this.voices.find(v => v.lang.startsWith(langPrefix));
    if (prefixMatch) return prefixMatch;

    if (langCode === 'as') {
      const bnMatch = this.voices.find(v => v.lang.startsWith('bn'));
      if (bnMatch) return bnMatch;
    }

    return this.voices.find(v => v.lang.startsWith('en')) || this.voices[0] || null;
  }

  /**
   * Explicit development/debug fallback to browser SpeechSynthesis.
   * Disabled by default in production.
   */
  speakWithSpeechSynthesis(text, langCode = 'as', options = {}) {
    if (!this.isSupported || !text) {
      if (options.onEnd) options.onEnd();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      const targetLocale = LANG_VOICE_MAP[langCode] || 'en-IN';
      utterance.lang = targetLocale;
      utterance.rate = options.rate || 0.85;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      const bestVoice = this.getBestVoice(langCode);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        if (options.onStart) options.onStart();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        if (options.onEnd) options.onEnd();
      };

      utterance.onerror = (e) => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        if (options.onError) options.onError(e);
        else if (options.onEnd) options.onEnd();
      };

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('[VoiceService] SpeechSynthesis fallback failed:', e);
      this.currentUtterance = null;
      this.isSpeaking = false;
      if (options.onError) options.onError(e);
      else if (options.onEnd) options.onEnd();
    }
  }

  /**
   * Primary voice output method: uses OpenAI Neural TTS as the authoritative voice.
   * Explicitly prevents mic-speech feedback loop by stopping listening before speaking.
   * Handles user interruptions safely by cleaning up active audio elements and object URLs.
   * @param {string} text - Response text to speak aloud
   * @param {string} [langCode='as'] - 'as' | 'bn' | 'hi' | 'en'
   * @param {Object} [options] - { onStart, onEnd, onError }
   */
  async speak(text, langCode = 'as', options = {}) {
    if (!text || !text.trim()) {
      if (options.onEnd) options.onEnd();
      return;
    }

    const trimmedText = text.trim();

    // Stop any ongoing speech and microphone immediately
    this.stop();
    this.stopListening();
    this.isSpeaking = true;

    try {
      if (!window.CognitiveClient || typeof window.CognitiveClient.synthesizeSpeech !== 'function') {
        throw new Error('CognitiveClient speech synthesis service is not initialized');
      }

      console.log(`[VoiceService] TTS request started for len=${trimmedText.length}, lang=${langCode}`);
      const blob = await window.CognitiveClient.synthesizeSpeech(trimmedText, langCode);
      console.log(`[VoiceService] TTS response received, blob size=${blob.size} bytes`);

      // If user stopped or interrupted while fetching TTS audio
      if (!this.isSpeaking) {
        console.log('[VoiceService] Utterance was cancelled while fetching TTS buffer.');
        return;
      }

      const audioUrl = URL.createObjectURL(blob);
      this.currentAudioUrl = audioUrl;
      console.log('[VoiceService] audio URL created:', audioUrl);

      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 1.0;
      audio.muted = false;
      audio.src = audioUrl;

      // Keep persistent instance reference on service to prevent garbage collection during playback
      this.activeAudio = audio;
      this.currentAudio = audio;

      const cleanupAudio = () => {
        if (this.currentAudioUrl) {
          try {
            URL.revokeObjectURL(this.currentAudioUrl);
          } catch (e) {}
          this.currentAudioUrl = null;
        }
        this.activeAudio = null;
        this.currentAudio = null;
        this.isSpeaking = false;
        console.log('[VoiceService] audio resources cleaned up');
      };

      audio.onplay = () => {
        this.isSpeaking = true;
        console.log('[VoiceService] audio playback started');
        if (options.onStart) options.onStart();
      };

      audio.onended = () => {
        console.log('[VoiceService] audio playback ended');
        cleanupAudio();
        if (options.onEnd) options.onEnd();
      };

      audio.onerror = (e) => {
        cleanupAudio();
        const err = new Error('Audio playback failed: ' + (audio.error ? audio.error.message : 'Unknown error'));
        console.error('[VoiceService] Audio playback error event:', e, audio.error);
        if (options.onError) options.onError(err);
        else if (options.onEnd) options.onEnd();
      };

      console.log('[VoiceService] audio.play() called');
      await audio.play();
      console.log('[VoiceService] audio.play() resolved successfully');
    } catch (err) {
      console.error('[VoiceService] OpenAI neural TTS error:', err);
      this.stop(); // Clean any audio handles

      // Check if blocked by browser autoplay policy (NotAllowedError)
      if (err.name === 'NotAllowedError' || (err.message && err.message.toLowerCase().includes('gesture'))) {
        console.warn('[VoiceService] Playback prevented by browser autoplay policy. Queuing utterance until user interaction.');
        this.pendingUtterance = { text: trimmedText, langCode, options };
        this.showAutoplayBanner();
        return;
      }

      // Check if explicit dev fallback is enabled (disabled by default in production)
      if (typeof window !== 'undefined' && window.__SMRITI_DEV_SPEECH_FALLBACK__ === true && this.isSupported) {
        console.warn('[VoiceService] Dev fallback enabled: falling back to SpeechSynthesis');
        this.speakWithSpeechSynthesis(trimmedText, langCode, options);
        return;
      }

      // In production: surface clear error without silent fallback to browser voice
      if (options.onError) {
        options.onError(err);
      } else if (options.onEnd) {
        options.onEnd();
      }
    }
  }

  /**
   * Starts speech recognition to listen to the senior talking.
   * Creates a fresh SpeechRecognition session to prevent browser InvalidStateError.
   * Uses deduplication guard to ensure exactly one final transcript is dispatched per spoken sentence.
   * @param {Object} config - { langCode, onTranscript, onInterim, onError, onEnd }
   */
  startListening(config = {}) {
    if (!this.isRecognitionSupported || !this.SpeechRec) {
      if (config.onError) config.onError(new Error('Speech recognition is not supported in this browser.'));
      return;
    }

    try {
      this.stopListening();
      this.stop(); // Stop any active speech synthesis

      const rec = new this.SpeechRec();
      this.recognition = rec;

      const targetLocale = STT_LANG_MAP[config.langCode || 'as'] || LANG_VOICE_MAP[config.langCode || 'as'] || 'en-IN';
      rec.lang = targetLocale;
      rec.continuous = false; // Capture discrete sentence turns
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      let hasDispatchedFinal = false;

      rec.onstart = () => {
        this.isListening = true;
        if (config.onStart) config.onStart();
      };

      rec.onresult = (event) => {
        if (hasDispatchedFinal) return;

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res && res[0]) {
            if (res.isFinal) {
              finalTranscript += res[0].transcript;
            } else {
              interimTranscript += res[0].transcript;
            }
          }
        }

        if (interimTranscript && config.onInterim) {
          config.onInterim(interimTranscript);
        }

        const trimmedFinal = finalTranscript.trim();
        if (trimmedFinal && config.onTranscript && !hasDispatchedFinal) {
          hasDispatchedFinal = true;
          this.stopListening(); // Stop immediately upon capturing full final utterance
          config.onTranscript(trimmedFinal);
        }
      };

      rec.onerror = (event) => {
        this.isListening = false;
        if (config.onError) config.onError(event);
      };

      rec.onend = () => {
        this.isListening = false;
        if (config.onEnd) config.onEnd();
      };

      rec.start();
    } catch (err) {
      this.isListening = false;
      if (config.onError) config.onError(err);
    }
  }

  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch (e) {}
    }
  }

  stop() {
    if (this.currentAudio || this.activeAudio) {
      const audioToStop = this.currentAudio || this.activeAudio;
      try {
        audioToStop.pause();
        audioToStop.currentTime = 0;
        audioToStop.onplay = null;
        audioToStop.onended = null;
        audioToStop.onerror = null;
      } catch (e) {}
      this.currentAudio = null;
      this.activeAudio = null;
    }
    if (this.currentAudioUrl) {
      try {
        URL.revokeObjectURL(this.currentAudioUrl);
      } catch (e) {}
      this.currentAudioUrl = null;
    }
    this.currentUtterance = null;
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
  }

  /**
   * Diagnostic isolated greeting test helper.
   * Synthesizes and plays a test greeting through the primary VoiceService pipeline.
   * @param {string} [text="Good morning, Aryan Baba."]
   * @param {string} [lang="en"]
   * @returns {Promise<void>}
   */
  async testGreeting(text = "Good morning, Aryan Baba.", lang = "en") {
    console.log(`[VoiceService] Running isolated greeting test: "${text}" (${lang})`);
    return new Promise((resolve, reject) => {
      this.speak(text, lang, {
        onStart: () => {
          console.log('✓ Isolated greeting test started playback');
        },
        onEnd: () => {
          console.log('✓ Isolated greeting test completed playback successfully');
          resolve();
        },
        onError: (err) => {
          console.error('✗ Isolated greeting test encountered an error:', err);
          reject(err);
        }
      });
    });
  }
}

export const voiceService = new VoiceService();
if (typeof window !== 'undefined') {
  window.VoiceService = voiceService;
  window.testVoiceGreeting = (text, lang) => voiceService.testGreeting(text, lang);
}
