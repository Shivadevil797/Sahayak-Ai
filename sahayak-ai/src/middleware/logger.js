/**
 * Lightweight HTTP request logger middleware
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  // Filter out static asset noise if any
  if (originalUrl.startsWith('/favicon.ico')) return next();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '-';

    let statusColor = '\x1b[32m'; // green
    if (status >= 500) statusColor = '\x1b[31m'; // red
    else if (status >= 400) statusColor = '\x1b[33m'; // yellow
    else if (status >= 300) statusColor = '\x1b[36m'; // cyan

    const resetColor = '\x1b[0m';
    const timestamp = new Date().toISOString().substring(11, 19);

    console.log(
      `[${timestamp}] ${method} ${originalUrl} ${statusColor}${status}${resetColor} - ${duration}ms (${ip})`
    );
  });

  next();
};
