import { SchemaType } from '@google/generative-ai';
import { genAI } from './geminiClient.js';

// ─────────────────────────────────────────────────────────────
// System prompt — instructs Gemini to act as a scam classifier
// tuned for threats targeting Indian senior citizens.
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are **Sahayak AI**, an empathetic scam-detection guardian built to protect Indian senior citizens from digital fraud.

## Your Task
Analyze the forwarded message (text, OCR-extracted text from screenshots, or audio transcripts) and determine whether it is a scam targeting an elderly person.

## Threat Categories to Evaluate
1. **DIGITAL_ARREST** — Fake police, CBI, customs, or court summons demanding immediate payment or personal data.
2. **FAKE_KYC** — Fraudulent bank KYC updates, malicious APK links posing as RBI / SBI / Aadhaar apps.
3. **UPI_FRAUD** — Fake UPI collect requests, wrong-transfer refund tricks, QR code scams.
4. **FAMILY_EMERGENCY_CLONE** — AI voice-cloned distress calls impersonating a grandchild/son/daughter.
5. **LOTTERY** — KBC, PM Yojana, lottery, or cash-prize scams.
6. **UNKNOWN** — Suspicious but doesn't match known categories.
7. **NONE** — Message is safe / not a scam.

## Scoring Guide
- **risk_score** (0–100): 0 = completely safe, 100 = definite scam.
- **risk_level**: "SAFE" (0–30), "SUSPICIOUS" (31–74), "CRITICAL" (75–100).
- **confidence** (0.0–1.0): Your confidence in the classification.
- **alert_caregiver**: Set to true if risk_score >= 75 OR the message demands immediate money/action.

## Response Language
- Write \`elder_friendly_explanation\` and \`immediate_action\` in the **senior's preferred language** (specified in the prompt). Use simple, warm, reassuring language a 70-year-old would understand. Avoid jargon.

## Rules
- Return ONLY the JSON object. No markdown, no commentary.
- Never disclose that you are an AI to the senior.
- When uncertain, err on the side of caution (higher risk score).
`;

// ─────────────────────────────────────────────────────────────
// Structured output schema — enforced via Gemini's JSON mode
// ─────────────────────────────────────────────────────────────
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    risk_score:                 { type: SchemaType.INTEGER,  description: 'Scam risk score from 0 (safe) to 100 (definite scam)' },
    risk_level:                 { type: SchemaType.STRING,   description: 'SAFE | SUSPICIOUS | CRITICAL',                        enum: ['SAFE', 'SUSPICIOUS', 'CRITICAL'] },
    scam_category:              { type: SchemaType.STRING,   description: 'Category of the detected scam',                       enum: ['DIGITAL_ARREST', 'FAKE_KYC', 'UPI_FRAUD', 'FAMILY_EMERGENCY_CLONE', 'LOTTERY', 'UNKNOWN', 'NONE'] },
    confidence:                 { type: SchemaType.NUMBER,   description: 'Classification confidence 0.0–1.0' },
    elder_friendly_explanation: { type: SchemaType.STRING,   description: 'Warm, simple explanation in the senior\'s language' },
    immediate_action:           { type: SchemaType.STRING,   description: 'Concrete next step the senior should take' },
    alert_caregiver:            { type: SchemaType.BOOLEAN,  description: 'Whether to notify the caregiver immediately' },
  },
  required: [
    'risk_score',
    'risk_level',
    'scam_category',
    'confidence',
    'elder_friendly_explanation',
    'immediate_action',
    'alert_caregiver',
  ],
};

// ─────────────────────────────────────────────────────────────
// Vernacular fallback explanations (used when LLM call fails)
// ─────────────────────────────────────────────────────────────
const FALLBACK_EXPLANATIONS = {
  Hindi:   'नमस्ते जी, यह संदेश संदिग्ध लग रहा है। कृपया किसी भी लिंक पर क्लिक न करें और पैसे न भेजें।',
  Kannada: 'ನಮಸ್ಕಾರ, ಈ ಸಂದೇಶವು ಅನುಮಾನಾಸ್ಪದವಾಗಿ ಕಾಣುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಯಾವುದೇ ಲಿಂಕ್ ಅನ್ನು ಕ್ಲಿಕ್ ಮಾಡಬೇಡಿ.',
  Tamil:   'வணக்கம், இந்தச் செய்தி சந்தேகமாகத் தெரிகிறது. எந்த இணைப்பையும் கிளிக் செய்யாதீர்கள்.',
  Telugu:  'నమస్కారం, ఈ సందేశం అనుమానాస్పదంగా కనిపిస్తోంది. దయచేసి ఏ లింక్‌పై క్లిక్ చేయకండి.',
  English: 'Hello. This message looks suspicious. Please do not click any links or send money.',
};

/**
 * Analyze a text payload for scam indicators using Gemini 1.5 Flash.
 *
 * @param {string} rawText - The message content (text, OCR output, or transcript)
 * @param {string} language - Senior's preferred language
 * @returns {Promise<Object>} Structured scam analysis result
 */
export const analyzeScamPayload = async (rawText, language = 'Hindi') => {
  // Model fallback chain — stable first, lighter fallbacks for high-demand periods
  const MODEL_CANDIDATES = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  const REQUEST_TIMEOUT_MS = 12_000; // 12s max per model attempt

  const prompt = [
    `Senior's Preferred Language: ${language}`,
    '',
    `Message Content:`,
    rawText,
  ].join('\n');

  /** Race a generateContent call against a timeout */
  const withTimeout = (promise, ms) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT: Model did not respond within ' + ms + 'ms')), ms),
      ),
    ]);

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      });

      console.log(`[Analyzer] Trying model "${modelName}" with ${rawText.length} chars (lang: ${language})...`);

      const result = await withTimeout(model.generateContent(prompt), REQUEST_TIMEOUT_MS);

      const textResponse = result.response.text();
      const parsed = JSON.parse(textResponse.trim());

      console.log(`[Analyzer] ✅ Success with "${modelName}" — risk: ${parsed.risk_level} (${parsed.risk_score}), category: ${parsed.scam_category}`);
      return parsed;
    } catch (error) {
      const msg = error?.message || '';
      const isRetryable = msg.includes('503') || msg.includes('429') || msg.includes('high demand') || msg.includes('TIMEOUT');
      console.warn(`[Analyzer] ⚠️ Model "${modelName}" failed: ${msg.substring(0, 150)}`);

      if (!isRetryable) {
        // Non-retryable error (e.g., schema issue, auth) — skip remaining models
        break;
      }
      // Otherwise, try next model in the chain
    }
  }

  // All models exhausted — graceful degradation with cautious fallback
  console.warn('[Analyzer] All models failed. Returning safe fallback response.');
  return {
    risk_score: 80,
    risk_level: 'CRITICAL',
    scam_category: 'UNKNOWN',
    confidence: 0.5,
    elder_friendly_explanation:
      FALLBACK_EXPLANATIONS[language] || FALLBACK_EXPLANATIONS.English,
    immediate_action:
      language === 'Hindi'
        ? 'कृपया तुरंत अपने परिवार के सदस्य या देखभालकर्ता से बात करें।'
        : 'Please talk to your caregiver or family member right away.',
    alert_caregiver: true,
  };
};