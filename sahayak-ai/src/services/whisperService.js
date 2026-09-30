import axios from 'axios';
import FormData from 'form-data';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Transcribe an audio buffer using OpenAI Whisper API.
 * Falls back to a mock response if OPENAI_API_KEY is not configured.
 *
 * @param {Buffer} audioBuffer - Raw audio file buffer
 * @param {string} [filename='audio.ogg'] - Original filename for MIME inference
 * @returns {Promise<string>} Transcribed text
 */
export const transcribeAudio = async (audioBuffer, filename = 'audio.ogg') => {
  // ── Mock fallback when no API key is set ──
  if (!OPENAI_API_KEY) {
    console.warn('[Whisper] OPENAI_API_KEY not set — using mock transcription.');
    return '[Mock Transcription] "Aapka bijli ka bill overdue hai. Turant ₹3,500 bhejiye nahi toh connection kat jayega. Yeh CBI ka order hai."';
  }

  try {
    console.log(`[Whisper] Transcribing ${filename} (${(audioBuffer.length / 1024).toFixed(1)} KB)...`);

    const form = new FormData();
    form.append('file', audioBuffer, { filename, contentType: 'audio/ogg' });
    form.append('model', 'whisper-1');
    form.append('language', 'hi');                 // prioritize Hindi
    form.append('response_format', 'text');

    const { data } = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        maxContentLength: 25 * 1024 * 1024,       // Whisper 25 MB limit
        timeout: 60_000,
      },
    );

    const transcript = (typeof data === 'string' ? data : data.text || '').trim();
    console.log(`[Whisper] Transcription complete — ${transcript.length} chars`);
    return transcript || '[Whisper returned empty transcript]';
  } catch (error) {
    console.error('[Whisper Error]:', error?.response?.data || error.message);
    throw new Error(`Audio transcription failed: ${error.message}`);
  }
};
