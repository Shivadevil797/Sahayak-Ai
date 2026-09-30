/**
 * Input validation and sanitization middleware
 */

export const validateAnalysisInput = (req, res, next) => {
  const { text, language } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Field "text" is required and must be a non-empty string.',
      },
    });
  }

  if (text.length > 10000) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Input text exceeds the maximum allowed length of 10,000 characters.',
      },
    });
  }

  const allowedLanguages = ['Hindi', 'English', 'Kannada', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati'];
  if (language && !allowedLanguages.includes(language)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_LANGUAGE',
        message: `Language "${language}" not supported. Allowed: ${allowedLanguages.join(', ')}`,
      },
    });
  }

  // Sanitize control characters
  req.body.text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

  next();
};

export const validateSeniorRegistration = (req, res, next) => {
  const { phone_number, name, caregiver_phone, preferred_language } = req.body;

  if (!phone_number || !name || !caregiver_phone) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'Fields "phone_number", "name", and "caregiver_phone" are required.',
      },
    });
  }

  // Validate phone format roughly (+ or digits, 10-15 chars)
  const phoneRegex = /^\+?[0-9\s-]{10,16}$/;
  if (!phoneRegex.test(phone_number.trim())) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PHONE_FORMAT',
        message: 'Field "phone_number" must be a valid 10-15 digit phone number (e.g., +919876543210).',
      },
    });
  }

  if (!phoneRegex.test(caregiver_phone.trim())) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PHONE_FORMAT',
        message: 'Field "caregiver_phone" must be a valid 10-15 digit phone number.',
      },
    });
  }

  const allowedLanguages = ['Hindi', 'English', 'Kannada', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati'];
  if (preferred_language && !allowedLanguages.includes(preferred_language)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_LANGUAGE',
        message: `Language "${preferred_language}" not supported. Allowed: ${allowedLanguages.join(', ')}`,
      },
    });
  }

  req.body.name = String(name).trim().slice(0, 100);
  req.body.phone_number = phone_number.trim();
  req.body.caregiver_phone = caregiver_phone.trim();
  if (req.body.caregiver_name) {
    req.body.caregiver_name = String(req.body.caregiver_name).trim().slice(0, 100);
  }

  next();
};
