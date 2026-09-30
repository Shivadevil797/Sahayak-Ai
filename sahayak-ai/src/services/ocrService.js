import Tesseract from 'tesseract.js';

/**
 * Extract text from an image buffer or file path using Tesseract.js.
 * Supports English + Hindi (Devanagari) OCR by default.
 *
 * @param {Buffer|string} imageSource - Image buffer or absolute file path
 * @param {string} [langs='eng+hin'] - Tesseract language codes
 * @returns {Promise<string>} Extracted text
 */
export const extractTextFromImage = async (imageSource, langs = 'eng+hin') => {
  try {
    console.log('[OCR] Starting text extraction...');
    const { data: { text, confidence } } = await Tesseract.recognize(imageSource, langs, {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${(info.progress * 100).toFixed(0)}%`);
        }
      },
    });

    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`[OCR] Extraction complete — confidence: ${confidence.toFixed(1)}%, length: ${cleaned.length} chars`);
    return cleaned || '[OCR returned empty text]';
  } catch (error) {
    console.error('[OCR Error]:', error.message);
    throw new Error(`OCR extraction failed: ${error.message}`);
  }
};
