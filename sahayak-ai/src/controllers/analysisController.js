import { User } from '../models/User.js';
import { ScamReport } from '../models/ScamReport.js';
import { analyzeScamPayload } from '../services/scamAnalyzer.js';
import { sendCaregiverAlert } from '../services/notification.js';

/**
 * POST /api/v1/analyze — Standalone scam analysis endpoint (no WhatsApp required).
 * Accepts raw text, runs the Gemini scam detector, persists a report, and returns results.
 */
export const directAnalysis = async (req, res) => {
  try {
    const { text, language = 'Hindi', phone_number } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Field "text" is required.' });
    }

    // ── 1. Run scam detection ──
    const analysis = await analyzeScamPayload(text, language);

    // ── 2. Attempt to link to a registered user ──
    let user = null;
    if (phone_number) {
      user = await User.findOne({ phone_number });
    }

    // ── 3. Persist report ──
    const report = await ScamReport.create({
      user: user ? user._id : null,
      raw_input: text.substring(0, 5000),
      input_type: 'TEXT',
      risk_score: analysis.risk_score,
      risk_level: analysis.risk_level,
      scam_category: analysis.scam_category || 'UNKNOWN',
      confidence: analysis.confidence ?? 0.8,
      elder_friendly_explanation: analysis.elder_friendly_explanation,
      immediate_action: analysis.immediate_action,
      alert_caregiver: analysis.alert_caregiver || false,
    });
    const reportId = report._id;

    // ── 4. Escalation trigger ──
    if (user && (analysis.alert_caregiver || analysis.risk_score >= 75) && user.caregiver_phone) {
      console.log(`[Analyze API] 🚨 Escalating to caregiver: ${user.caregiver_phone}`);
      // Fire-and-forget so we don't block the response
      sendCaregiverAlert(user.caregiver_phone, user, analysis, text)
        .then(() => ScamReport.findByIdAndUpdate(reportId, { caregiver_alerted_at: new Date() }))
        .catch((err) => console.error('[Analyze API] Caregiver alert failed:', err.message));
    }

    return res.status(200).json({
      success: true,
      report_id: reportId,
      data: analysis,
    });
  } catch (err) {
    console.error('[Analyze API Error]:', err);
    return res.status(500).json({ error: err.message });
  }
};