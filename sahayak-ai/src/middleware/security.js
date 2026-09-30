/**
 * Security headers middleware
 * Implements hardened HTTP response headers for defense-in-depth against
 * clickjacking, MIME-sniffing, XSS, and unauthorized framing.
 */
export const securityHeaders = (req, res, next) => {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Guard against clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Legacy XSS filter activation
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information sent in requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent download opening vulnerabilities in legacy IE
  res.setHeader('X-Download-Options', 'noopen');

  // Disable browser caching for sensitive API payloads
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};
