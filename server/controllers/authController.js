import {
  endSession,
  loginWithGoogle,
  loginWithPassword,
  me,
  registerWithPassword,
  requestOtp,
  startSession,
  updateBirthYear,
  verifyOtp,
} from '../auth.js';
import { publicUser } from '../models/db.js';

export const getMe = me;

export function register(req, res) {
  const user = registerWithPassword({
    email: req.body?.email,
    password: req.body?.password,
    name: req.body?.name,
    lastName: req.body?.lastName,
    birthYear: req.body?.birthYear,
  });
  startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}

export function login(req, res) {
  const user = loginWithPassword({
    email: req.body?.email,
    password: req.body?.password,
  });
  startSession(res, user);
  res.json({ user: publicUser(user) });
}

export async function requestOtpCode(req, res) {
  const result = await requestOtp({
    email: req.body?.email,
    mode: req.body?.mode,
    name: req.body?.name,
    lastName: req.body?.lastName,
    birthYear: req.body?.birthYear,
  });
  res.json({ ok: true, ...result });
}

export function verifyOtpCode(req, res) {
  const user = verifyOtp({ email: req.body?.email, code: req.body?.code });
  startSession(res, user);
  res.json({ user: publicUser(user) });
}

export async function googleLogin(req, res) {
  const user = await loginWithGoogle(req.body?.credential);
  startSession(res, user);
  res.json({ user: publicUser(user) });
}

export function logout(_req, res) {
  endSession(res);
  res.json({ ok: true });
}

export function updateProfile(req, res) {
  const user = updateBirthYear(req.user, req.body?.birthYear);
  res.json({ user: publicUser(user) });
}
