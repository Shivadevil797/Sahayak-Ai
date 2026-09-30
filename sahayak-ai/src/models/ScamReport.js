import mongoose from 'mongoose';

const ScamReportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null, index: true },
    raw_input: { type: String, required: true },
    input_type: { type: String, enum: ['TEXT', 'IMAGE', 'AUDIO'], default: 'TEXT' },
    risk_score: { type: Number, min: 0, max: 100, required: true, index: true },
    risk_level: { type: String, enum: ['SAFE', 'SUSPICIOUS', 'CRITICAL'], required: true, index: true },
    scam_category: {
      type: String,
      default: 'UNKNOWN',
      index: true,
    },
    confidence: { type: Number, min: 0, max: 1, default: 0.8 },
    elder_friendly_explanation: { type: String, required: true },
    immediate_action: { type: String, required: true },
    alert_caregiver: { type: Boolean, default: false, index: true },
    caregiver_alerted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } }
);

ScamReportSchema.index({ timestamp: -1 });
ScamReportSchema.index({ risk_level: 1, timestamp: -1 });

export const ScamReport = mongoose.model('ScamReport', ScamReportSchema);