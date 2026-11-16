import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { config } from './config.js';
import { getDb, publicUser, saveDb } from './db.js';
import { otpEmail } from './emails.js';
import { sendMail } from './mailer.js';
import {
  HttpError,
  hashOtp,
  isAdultBirthYear,
  isValidEmail,
  normalizeEmail,
  parseCookies,
  personName,
  signPayload,
  sixDigitCode,
  verifyPayload,
} from './util.js';

const SESSION_COOKIE = 'cs_session';
const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

export function startSession(res, user) {
  const token = signPayload(
    { uid: user.id, exp: Date.now() + config.sessionTtlMs },
    config.sessionSecret,
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.appUrl.startsWith('https://'),
    maxAge: config.sessionTtlMs,
    path: '/',
  });
}

export function endSession(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function currentUser(req) {
  const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifyPayload(token, config.sessionSecret);
  if (!payload) return null;
  return getDb().users.find((user) => user.id === payload.uid) || null;
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

export function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

export async function requestOtp({ email, mode = 'login', name, lastName, birthYear }) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new HttpError(400, 'Ingresa un correo electrónico válido.', 'INVALID_EMAIL');
  }

  const db = getDb();
  const existing = db.users.find((user) => user.email === normalized);
  let profile = null;

  if (mode === 'signup') {
    if (existing) {
      throw new HttpError(409, 'Ya existe una cuenta con este correo. Inicia sesión.', 'ACCOUNT_EXISTS');
    }
    const cleanName = personName(name);
    const cleanLastName = personName(lastName, 80);
    const year = Number(birthYear);

    if (!cleanName) {
      throw new HttpError(400, 'Ingresa tu nombre (solo letras, mínimo 2 caracteres).', 'INVALID_NAME');
    }
    if (!cleanLastName) {
      throw new HttpError(400, 'Ingresa tu apellido (solo letras, mínimo 2 caracteres).', 'INVALID_LASTNAME');
    }
    if (!isAdultBirthYear(year)) {
      throw new HttpError(
        400,
        `Ingresa un año de nacimiento válido (debes tener al menos 13 años).`,
        'INVALID_BIRTHYEAR',
      );
    }
    profile = { name: cleanName, lastName: cleanLastName, birthYear: year };
  } else if (mode === 'login') {
    if (!existing) {
      throw new HttpError(
        404,
        'No encontramos una cuenta con este correo. Crea una cuenta para continuar.',
        'ACCOUNT_NOT_FOUND',
      );
    }
  } else {
    throw new HttpError(400, 'Modo de verificación inválido.', 'INVALID_MODE');
  }

  const now = Date.now();
  const previous = db.otps[normalized];

  if (previous && now - previous.lastSentAt < config.otp.resendMs) {
    const retryAfter = Math.ceil((config.otp.resendMs - (now - previous.lastSentAt)) / 1000);
    throw new HttpError(
      429,
      `Espera ${retryAfter} segundos antes de pedir otro código.`,
      { code: 'RESEND_COOLDOWN', retryAfter },
    );
  }

  const sameWindow = previous && now - previous.windowStart < 60 * 60 * 1000;
  const windowStart = sameWindow ? previous.windowStart : now;
  const sentCount = sameWindow ? previous.sentCount || 0 : 0;

  if (sentCount >= config.otp.maxPerHour) {
    throw new HttpError(
      429,
      'Pediste demasiados códigos. Intenta de nuevo en una hora.',
      { code: 'OTP_LIMIT', retryAfter: Math.ceil((windowStart + 60 * 60 * 1000 - now) / 1000) },
    );
  }

  const code = sixDigitCode();
  db.otps[normalized] = {
    codeHash: hashOtp(normalized, code),
    expiresAt: now + config.otp.ttlMs,
    attempts: 0,
    lastSentAt: now,
    windowStart,
    sentCount: sentCount + 1,
    mode,
    profile,
  };
  saveDb();

  const content = otpEmail({ code, purpose: mode });
  try {
    await sendMail({
      to: normalized,
      ...content,
      meta: { kind: 'otp', code: config.exposeOtp ? code : undefined },
    });
  } catch (error) {
    if (db.otps[normalized]?.codeHash === hashOtp(normalized, code)) {
      delete db.otps[normalized];
      saveDb();
    }
    console.error('[auth] No se pudo enviar el OTP:', error);
    throw new HttpError(
      502,
      'No pudimos enviar el correo con el código. Revisa la configuración SMTP e intenta de nuevo.',
      'EMAIL_FAILED',
    );
  }

  return {
    email: normalized,
    expiresAt: db.otps[normalized]?.expiresAt || now + config.otp.ttlMs,
    resendAt: now + config.otp.resendMs,
    ...(config.exposeOtp ? { devCode: code } : {}),
  };
}

export function verifyOtp({ email, code }) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new HttpError(400, 'Ingresa un correo electrónico válido.', 'INVALID_EMAIL');
  }
  const given = String(code || '').trim();

  const db = getDb();
  const entry = db.otps[normalized];
  if (!entry) {
    throw new HttpError(400, 'Solicita un código nuevo para continuar.', 'OTP_MISSING');
  }
  if (entry.expiresAt < Date.now()) {
    delete db.otps[normalized];
    saveDb();
    throw new HttpError(410, 'El código expiró. Solicita uno nuevo.', 'OTP_EXPIRED');
  }
  if (entry.attempts >= config.otp.maxAttempts) {
    delete db.otps[normalized];
    saveDb();
    throw new HttpError(429, 'Demasiados intentos incorrectos. Solicita un código nuevo.', 'OTP_ATTEMPTS');
  }
  if (!/^\d{6}$/.test(given)) {
    throw new HttpError(400, 'Ingresa los 6 dígitos del código.', 'OTP_FORMAT');
  }
  if (entry.codeHash !== hashOtp(normalized, given)) {
    entry.attempts += 1;
    const left = config.otp.maxAttempts - entry.attempts;
    if (left <= 0) {
      delete db.otps[normalized];
      saveDb();
      throw new HttpError(429, 'Demasiados intentos incorrectos. Solicita un código nuevo.', 'OTP_ATTEMPTS');
    }
    saveDb();
    throw new HttpError(400, `Código incorrecto. Te ${left === 1 ? 'queda 1 intento' : `quedan ${left} intentos`}.`, {
      code: 'OTP_WRONG',
      attemptsLeft: left,
    });
  }

  delete db.otps[normalized];

  let user;
  if (entry.mode === 'signup') {
    if (db.users.some((candidate) => candidate.email === normalized)) {
      saveDb();
      throw new HttpError(409, 'Ya existe una cuenta con este correo. Inicia sesión.', 'ACCOUNT_EXISTS');
    }
    user = {
      id: crypto.randomUUID(),
      email: normalized,
      name: entry.profile.name,
      lastName: entry.profile.lastName,
      birthYear: entry.profile.birthYear,
      avatar: null,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
  } else {
    user = db.users.find((candidate) => candidate.email === normalized);
    if (!user) {
      saveDb();
      throw new HttpError(404, 'No encontramos tu cuenta. Vuelve a crear una.', 'ACCOUNT_NOT_FOUND');
    }
  }

  saveDb();
  return user;
}

export async function loginWithGoogle(credential) {
  if (!googleClient) {
    throw new HttpError(
      503,
      'El acceso con Google no está configurado. Define GOOGLE_CLIENT_ID en el archivo .env.',
      'GOOGLE_DISABLED',
    );
  }
  if (!credential || typeof credential !== 'string') {
    throw new HttpError(400, 'Falta la credencial de Google.', 'GOOGLE_MISSING');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error('[auth] Token de Google inválido:', error.message);
    throw new HttpError(401, 'No pudimos validar tu cuenta de Google. Intenta de nuevo.', 'GOOGLE_INVALID');
  }

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new HttpError(401, 'Tu cuenta de Google no tiene un correo verificado.', 'GOOGLE_UNVERIFIED');
  }

  const email = normalizeEmail(payload.email);
  const db = getDb();
  let user =
    db.users.find((candidate) => candidate.googleSub === payload.sub) ||
    db.users.find((candidate) => candidate.email === email);

  if (user) {
    if (!user.googleSub) user.googleSub = payload.sub;
    if (!user.avatar) user.avatar = payload.picture || null;
  } else {
    user = {
      id: crypto.randomUUID(),
      email,
      name: payload.given_name || payload.name?.split(' ')[0] || 'Usuario',
      lastName: payload.family_name || '',
      birthYear: null,
      avatar: payload.picture || null,
      provider: 'google',
      googleSub: payload.sub,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
  }
  saveDb();
  return user;
}

export function updateBirthYear(user, birthYear) {
  const year = Number(birthYear);
  if (!isAdultBirthYear(year)) {
    throw new HttpError(400, 'Ingresa un año de nacimiento válido (debes tener al menos 13 años).', 'INVALID_BIRTHYEAR');
  }
  user.birthYear = year;
  saveDb();
  return user;
}
