import { User } from '../models/User.js';

/**
 * POST /api/v1/seniors — Register a senior citizen's profile.
 */
export const registerSenior = async (req, res) => {
  try {
    const { phone_number, name, preferred_language, caregiver_name, caregiver_phone } = req.body;

    // ── Validation ──
    if (!phone_number || !name || !caregiver_phone) {
      return res.status(400).json({
        error: 'Fields "phone_number", "name", and "caregiver_phone" are required.',
      });
    }

    const allowedLanguages = ['Hindi', 'English', 'Kannada', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati'];
    if (preferred_language && !allowedLanguages.includes(preferred_language)) {
      return res.status(400).json({
        error: `Invalid language. Allowed: ${allowedLanguages.join(', ')}`,
      });
    }

    // ── Upsert (update if phone already exists) ──
    const user = await User.findOneAndUpdate(
      { phone_number },
      {
        name,
        preferred_language: preferred_language || 'Hindi',
        caregiver_name: caregiver_name || '',
        caregiver_phone,
        is_active: true,
      },
      { upsert: true, new: true, runValidators: true },
    );

    const isNew = user.created_at && user.updated_at &&
      Math.abs(new Date(user.created_at) - new Date(user.updated_at)) < 1000;

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Senior registered successfully.' : 'Senior profile updated.',
      data: {
        id: user._id,
        phone_number: user.phone_number,
        name: user.name,
        preferred_language: user.preferred_language,
        caregiver_name: user.caregiver_name,
        caregiver_phone: user.caregiver_phone,
        is_active: user.is_active,
      },
    });
  } catch (err) {
    console.error('[Senior Registration Error]:', err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/v1/seniors — List all registered seniors (admin/debug).
 */
export const listSeniors = async (_req, res) => {
  try {
    const users = await User.find({ is_active: true })
      .select('-__v')
      .sort({ created_at: -1 })
      .lean();
    return res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
