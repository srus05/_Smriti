/**
 * SMRITI AUDIO FEEDBACK ENGINE (Web Audio API)
 * Synthesizes gentle, warm acoustic chimes and harmonic feedback
 * for multisensory cognitive comfort. Completely offline, zero external assets.
 */

class SmritiAudio {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.initUserInteractionListener();
  }

  // Lazy-initialize AudioContext upon first user gesture
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  initUserInteractionListener() {
    const unlockAudio = () => {
      this.getAudioContext();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Plays a warm, soft harmonic bell chime
   * @param {number} freq - Base frequency (Hz)
   * @param {number} duration - Duration in seconds
   * @param {string} type - 'sine' | 'triangle'
   */
  playChime(freq = 528, duration = 0.8, type = 'sine') {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      // Subtle harmonic overtone
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio feedback fallback:', e);
    }
  }

  /**
   * Plays gentle success celebration chord
   */
  playSuccessChord() {
    if (this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 - E5 - G5 - C6 (Warm Major)
    notes.forEach((note, index) => {
      setTimeout(() => {
        this.playChime(note, 1.2, 'sine');
      }, index * 100);
    });
  }

  /**
   * Plays gentle tactile tap feedback
   */
  playSoftTap() {
    this.playChime(440, 0.25, 'triangle');
  }

  /**
   * Plays synthesized vintage melody snippet (e.g. nostalgic retro intro)
   */
  playMelodySnippet() {
    if (this.isMuted) return;
    // Nostalgic ascending phrase in Pentatonic
    const notes = [
      { f: 392.00, d: 0.3 }, // G4
      { f: 440.00, d: 0.3 }, // A4
      { f: 523.25, d: 0.4 }, // C5
      { f: 587.33, d: 0.4 }, // D5
      { f: 659.25, d: 0.6 }, // E5
      { f: 587.33, d: 0.4 }, // D5
      { f: 523.25, d: 0.8 }  // C5
    ];

    let delay = 0;
    notes.forEach(note => {
      setTimeout(() => {
        this.playChime(note.f, note.d, 'sine');
      }, delay * 1000);
      delay += note.d * 0.75;
    });
  }

  /**
   * Plays spoken greeting using centralized VoiceService (OpenAI Neural TTS)
   * @param {string} text 
   * @param {string} [lang='as']
   */
  speakText(text = "Good morning Maa. Welcome to your memory space.", lang = 'as') {
    if (this.isMuted) return;
    if (typeof window !== 'undefined' && window.VoiceService && typeof window.VoiceService.speak === 'function') {
      window.VoiceService.speak(text, lang);
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.88; // Gentle, slower tempo for seniors
      utterance.pitch = 1.05; // Warm, friendly pitch
      utterance.lang = 'en-IN'; // Indian English cadence if available
      window.speechSynthesis.speak(utterance);
    }
  }
}

// Global instance
window.smritiAudio = new SmritiAudio();
