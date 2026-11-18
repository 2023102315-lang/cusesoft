import crypto from 'node:crypto';
import { currentUser } from '../auth.js';
import { config } from '../config.js';
import { isAdminUser } from '../models/db.js';
import { HttpError, verifyPayload } from '../util.js';

export function safeEquals(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a || '')).digest();
  const hashB = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function attachUser(req, _res, next) {
  req.user = currentUser(req);
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new HttpError(401, 'Inicia sesión para continuar con tu compra.', 'AUTH_REQUIRED'));
  }
  return next();
}

export function requireAdmin(req, _res, next) {
  if (req.user && isAdminUser(req.user)) {
    req.adminUser = req.user.email;
    return next();
  }

  if (!config.adminToken && !config.adminPassword) {
    return next(
      new HttpError(
        503,
        'El panel de administración no está configurado. Define ADMIN_TOKEN o ADMIN_PASSWORD en .env.',
        'ADMIN_DISABLED',
      ),
    );
  }
  const provided = String(req.get('x-admin-token') || '');
  if (!provided) {
    return next(new HttpError(401, 'Sesión de administración inválida.', 'ADMIN_UNAUTHORIZED'));
  }

  const session = verifyPayload(provided, config.sessionSecret);
  if (session && session.role === 'admin') {
    req.adminUser = session.user || config.adminUser;
    return next();
  }

  if (config.adminToken && safeEquals(provided, config.adminToken)) {
    req.adminUser = 'token';
    return next();
  }

  return next(new HttpError(401, 'Credenciales o token de administración inválidos.', 'ADMIN_UNAUTHORIZED'));
}
