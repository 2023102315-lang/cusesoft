import { HttpError } from '../util.js';

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "script-src 'self' https://accounts.google.com https://www.gstatic.com",
      "frame-src https://accounts.google.com",
      "connect-src 'self' https://accounts.google.com",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
}

export function requireSameOrigin(req, _res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch {
    /* origen inválido */
  }
  return next(new HttpError(403, 'Origen no permitido.', 'BAD_ORIGIN'));
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Recurso no encontrado.', code: 'NOT_FOUND' });
}

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  const status = Number(error.status) || 500;
  if (status >= 500 && !error.status) console.error('[error]', error);
  const details = error.details && typeof error.details === 'object' ? error.details : {};
  res.status(status).json({
    error: status >= 500 && !error.status ? 'Ocurrió un error inesperado. Intenta de nuevo.' : error.message,
    code: details.code || error.code || null,
    ...details,
  });
}
