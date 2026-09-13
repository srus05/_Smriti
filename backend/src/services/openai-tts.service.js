/**
 * SMRITI OPENAI NEURAL TEXT-TO-SPEECH (TTS) SERVICE
 * High-quality neural speech synthesis for Smriti's conversational voice companion.
 * Isolated server-side service utilizing official OpenAI SDK.
 * 
 * Responsibilities:
 * - Converts Gemini's conversational responses into natural, warm, empathetic speech.
 * - Enforces elderly-friendly cadence (calm pitch, slightly slower pace ~0.88-0.90x).
 * - Safe server-side API key handling with zero client exposure.
 * - Robust model failover (gpt-4o-mini-tts -> tts-1).
 * - Streaming audio buffer return with zero database overhead.
 */

import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let openaiClient = null;

function getOpenAIClient() {
  const apiKey = config.openai?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server. Please configure OPENAI_API_KEY in .env.');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export const openaiTtsService = {
  /**
   * Generates playable audio buffer for given text using OpenAI Neural TTS.
   * @param {Object} params
   * @param {string} params.text - The response text to speak aloud
   * @param {string} [params.language] - Language code ('as' | 'bn' | 'hi' | 'en')
   * @returns {Promise<{ audioBuffer: Buffer, mimeType: string, modelUsed: string, voiceUsed: string }>}
   */
  async synthesizeSpeech({ text, language = 'as' }) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('text is required for speech synthesis');
    }

    const cleanText = text.trim();
    const client = getOpenAIClient();

    const primaryModel = config.openai?.ttsModel || process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
    const voice = config.openai?.ttsVoice || process.env.OPENAI_TTS_VOICE || 'shimmer';
    const candidateModels = [primaryModel, 'tts-1'].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastError = null;

    for (const model of candidateModels) {
      try {
        const isGpt4oMini = model.startsWith('gpt-4o-mini');
        const payload = {
          model,
          voice,
          input: cleanText,
          response_format: 'mp3',
          speed: 0.88 // Calm, unhurried elderly pace
        };

        // 'instructions' parameter is supported in gpt-4o-mini-tts
        if (isGpt4oMini) {
          payload.instructions = 'Speak with a warm, gentle, calm, patient, and soothing elderly-friendly tone. Do not rush.';
        }

        const response = await client.audio.speech.create(payload, {
          timeout: 10000 // 10 second timeout
        });

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        if (!audioBuffer || audioBuffer.length === 0) {
          throw new Error('Received empty audio buffer from OpenAI TTS');
        }

        return {
          audioBuffer,
          mimeType: 'audio/mpeg',
          modelUsed: model,
          voiceUsed: voice
        };
      } catch (err) {
        lastError = err;
        const status = err?.status || err?.statusCode || (err.message && err.message.includes('401') ? 401 : null);
        logger.warn(`OpenAI TTS attempt with model "${model}" failed: ${err.message || 'Unknown error'}`);

        // If authentication error, fail immediately without retrying other models
        if (status === 401 || err.message?.includes('API key') || err.message?.includes('Incorrect API key')) {
          throw new Error('OpenAI authentication failed: Invalid or missing OPENAI_API_KEY.');
        }
      }
    }

    throw new Error(`OpenAI speech synthesis failed: ${lastError?.message || 'All models unavailable'}`);
  }
};
