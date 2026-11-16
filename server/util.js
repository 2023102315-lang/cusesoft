import crypto from 'node:crypto';
import { config } from './config.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmail(value) {
  return EMAIL_RE.test(value) && value.length <= 254;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

export function hmac(value) {
  return crypto.createHmac('sha256', Buffer.from(value.secret)).update(value.data).digest();
}

export function signPayload(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(hmac({ secret, data: body }));
  return `${body}.${signature}`;
}

export function verifyPayload(token, secret) {
  if (typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = hmac({ secret, data: body });
  let received;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (received.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashOtp(email, code) {
  return crypto
    .createHmac('sha256', 'otp:' + config.sessionSecret)
    .update(`${email}:${code}`)
    .digest('hex');
}

export function sixDigitCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function orderCode() {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return `CS-${out}`;
}

export function money(value) {
  return Number(value.toFixed(2));
}

export function createRateLimiter({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const bucketKey = key(req);
    const entry = hits.get(bucketKey);
    if (!entry || entry.resetAt <= now) {
      hits.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return next(new HttpError(429, 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'));
    }
    return next();
  };
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

export function isAdultBirthYear(year) {
  const current = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1900 && year <= current - 13;
}

export function personName(value, max = 60) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > max) return null;
  if (!/^[a-záéíóúüñ' -]+$/i.test(name)) return null;
  return name;
}
