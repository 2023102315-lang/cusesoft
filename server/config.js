import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(serverDir, '..');
export const publicDir = path.join(rootDir, 'public');
export const dataDir = path.join(serverDir, 'data');
export const filesDir = path.join(serverDir, 'files');
export const outboxDir = path.join(dataDir, 'outbox');

for (const dir of [dataDir, filesDir, outboxDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

function readOrCreateSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  const secretFile = path.join(dataDir, '.session-secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing.length >= 16) return existing;
  } catch {
    /* se genera abajo */
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';

const smtp = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
};
const smtpConfigured = Boolean(smtp.host && smtp.user);

export const config = {
  port,
  host,
  env: process.env.NODE_ENV || 'development',
  appUrl: (process.env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  storeName: process.env.STORE_NAME || 'CuseSoft',
  supportEmail: process.env.SUPPORT_EMAIL || 'soporte@cusesoft.com',
  sessionSecret: readOrCreateSecret(),
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  otp: {
    ttlMs: Number(process.env.OTP_TTL_MINUTES || 10) * 60 * 1000,
    resendMs: Number(process.env.OTP_RESEND_SECONDS || 60) * 1000,
    maxAttempts: 5,
    maxPerHour: 6,
  },
  orderTtlMs: 30 * 60 * 1000,
  downloadTtlMs: 7 * 24 * 60 * 60 * 1000,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  yape: {
    name: process.env.YAPE_NAME || 'CuseSoft Store',
    phone: process.env.YAPE_PHONE || '999 999 999',
    // Si colocas una imagen oficial de tu QR de Yape en /public, pon aquí su ruta
    // (por ejemplo "/assets/yape-qr.png"). Si queda vacío se genera un QR informativo.
    qrImage: process.env.YAPE_QR_IMAGE || '',
  },
  smtp,
  mailFrom: process.env.MAIL_FROM || `"${process.env.STORE_NAME || 'CuseSoft'}" <no-reply@cusesoft.local>`,
  mailerConfigured: smtpConfigured,
  // En modo desarrollo los correos se guardan en server/data/outbox y el OTP
  // también se devuelve a la interfaz para poder probar el flujo sin SMTP.
  devMode: !smtpConfigured,
  exposeOtp: smtpConfigured ? process.env.DEV_EXPOSE_OTP === 'true' : process.env.DEV_EXPOSE_OTP !== 'false',
  requireManualApproval: process.env.REQUIRE_MANUAL_APPROVAL === 'true',
  adminToken: process.env.ADMIN_TOKEN || '',
};
