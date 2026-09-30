import { User } from '../models/User.js';
import { ScamReport } from '../models/ScamReport.js';
import { analyzeScamPayload } from '../services/scamAnalyzer.js';
import { extractTextFromImage } from '../services/ocrService.js';
import { transcribeAudio } from '../services/whisperService.js';
import { downloadMedia } from '../services/mediaDownloader.js';
import { sendSeniorWhatsAppReply, sendCaregiverAlert } from '../services/notification.js';

// ─────────────────────────────────────────────────────────────
// GET /webhook — Twilio / Meta webhook verification handshake
// ─────────────────────────────────────────────────────────────
export const verifyWebhook = (req, res) => {
  // Meta-style verification (hub.challenge)
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'sahayak_verify')) {
    console.log('[Webhook] Verification challenge accepted.');
    return res.status(200).send(challenge);
  }

  // Simple alive-check fallback
  return res.status(200).json({ status: 'webhook active', ts: new Date().toISOString() });
};

// ─────────────────────────────────────────────────────────────
// POST /webhook — Process incoming WhatsApp messages
// ─────────────────────────────────────────────────────────────
export const handleInboundMessage = async (req, res) => {
  // Twilio sends form-encoded payloads by default
  const payload = req.body;

  // ── 1. Extract sender info ──
  const senderPhone = payload.From || payload.WaId || '';
  const numMedia = parseInt(payload.NumMedia, 10) || 0;
  const bodyText = (payload.Body || '').trim();

  console.log(`[Webhook] Inbound from ${senderPhone} | media: ${numMedia} | text: "${bodyText.substring(0, 60)}"`);

  // Immediately respond 200 so Twilio doesn't retry
  res.status(200).type('text/xml').send('<Response></Response>');

  try {
    // ── 2. Resolve or auto-register user ──
    let user = await User.findOne({
      phone_number: senderPhone.replace('whatsapp:', ''),
    });

    if (!user) {
      // Auto-register unknown senders with defaults
      user = await User.create({
        phone_number: senderPhone.replace('whatsapp:', ''),
        name: 'Unknown Senior',
        preferred_language: 'Hindi',
        caregiver_phone: '',
      });
      console.log(`[Webhook] Auto-registered new user: ${user.phone_number}`);
    }

    const language = user.preferred_language || 'Hindi';

    // ── 3. Route by content type ──
    let extractedText = bodyText;
    let inputType = 'TEXT';

    if (numMedia > 0) {
      const mediaUrl = payload.MediaUrl0;
      const mediaType = (payload.MediaContentType0 || '').toLowerCase();

      if (!mediaUrl) {
        console.warn('[Webhook] Media count > 0 but no MediaUrl0 found.');
      } else if (mediaType.startsWith('image/')) {
        // ── Image / Screenshot → OCR ──
        inputType = 'IMAGE';
        console.log(`[Webhook] Processing image: ${mediaType}`);
        const { buffer } = await downloadMedia(mediaUrl);
        extractedText = await extractTextFromImage(buffer);
        // Append any body text as additional context
        if (bodyText) extractedText = `${bodyText}\n\n[Extracted from image]:\n${extractedText}`;
      } else if (mediaType.startsWith('audio/')) {
        // ── Audio Note → Speech-to-Text ──
        inputType = 'AUDIO';
        console.log(`[Webhook] Processing audio: ${mediaType}`);
        const { buffer } = await downloadMedia(mediaUrl);
        extractedText = await transcribeAudio(buffer, 'voice_note.ogg');
        if (bodyText) extractedText = `${bodyText}\n\n[Transcript]:\n${extractedText}`;
      } else {
        console.warn(`[Webhook] Unsupported media type: ${mediaType}`);
        extractedText = bodyText || `[Unsupported media type: ${mediaType}]`;
      }
    }

    if (!extractedText) {
      console.log('[Webhook] Empty payload — nothing to analyze.');
      return;
    }

    // ── 4. Run scam detection ──
    console.log(`[Webhook] Analyzing ${inputType} input (${extractedText.length} chars)...`);
    const analysis = await analyzeScamPayload(extractedText, language);

    // ── 5. Persist report ──
    const report = await ScamReport.create({
      user: user._id,
      raw_input: extractedText.substring(0, 5000), // cap storage
      input_type: inputType,
      risk_score: analysis.risk_score,
      risk_level: analysis.risk_level,
      scam_category: analysis.scam_category,
      confidence: analysis.confidence,
      elder_friendly_explanation: analysis.elder_friendly_explanation,
      immediate_action: analysis.immediate_action,
      alert_caregiver: analysis.alert_caregiver,
    });

    console.log(`[Webhook] Report saved: ${report._id} | Risk: ${analysis.risk_level} (${analysis.risk_score})`);

    // ── 6. Reply to senior ──
    await sendSeniorWhatsAppReply(senderPhone, analysis);

    // ── 7. Escalation trigger ──
    if ((analysis.alert_caregiver || analysis.risk_score >= 75) && user.caregiver_phone) {
      console.log(`[Webhook] 🚨 Escalating to caregiver: ${user.caregiver_phone}`);
      await sendCaregiverAlert(user.caregiver_phone, user, analysis, extractedText);

      // Mark alert timestamp
      await ScamReport.findByIdAndUpdate(report._id, {
        caregiver_alerted_at: new Date(),
      });
    }
  } catch (err) {
    console.error('[Webhook Pipeline Error]:', err);
    // Already sent 200 — errors are logged, not propagated to Twilio
  }
};
