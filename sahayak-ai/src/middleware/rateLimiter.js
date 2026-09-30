/**
 * In-memory sliding-window rate limiter middleware.
 * Protects expensive LLM and webhook endpoints against DDoS and abusive spikes.
 */
export const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60 * 1000; // default 1 minute
  const max = options.max || 60; // default 60 requests per window
  const message = options.message || 'Too many requests from this IP, please try again later.';

  // Storage: ip -> array of timestamps
  const hits = new Map();

  // Periodic cleanup every 2 minutes to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, valid);
      }
    }
  }, 2 * 60 * 1000).unref();

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const clientHits = hits.get(ip) || [];
    // Keep only timestamps within window
    const recentHits = clientHits.filter((time) => now - time < windowMs);

    if (recentHits.length >= max) {
      const oldestHit = recentHits[0];
      const retryAfterSec = Math.ceil((oldestHit + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(oldestHit + windowMs).toISOString());

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfterSeconds: retryAfterSec,
        },
      });
    }

    recentHits.push(now);
    hits.set(ip, recentHits);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - recentHits.length);

    next();
  };
};

// General API rate limiter: 120 req / min
export const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'API rate limit exceeded. Please throttle your requests.',
});

// Strict LLM Analysis limiter: 25 requests / min (protects Gemini quota)
export const analysisLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 25,
  message: 'Scam analysis rate limit reached. Please wait a moment before analyzing more messages.',
});
