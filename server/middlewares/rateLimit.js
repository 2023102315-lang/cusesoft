import { createRateLimiter, normalizeEmail } from '../util.js';

const emailKey = (req) => normalizeEmail(req.body?.email) || req.ip;

export const otpRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) => `${req.ip}:${emailKey(req)}`,
});

export const otpVerifyLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  key: (req) => `${req.ip}:${emailKey(req)}`,
});

export const orderLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  key: (req) => req.user?.id || req.ip,
});
