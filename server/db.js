import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './config.js';

const dbFile = path.join(dataDir, 'db.json');

function emptyDb() {
  return { users: [], otps: {}, orders: [] };
}

function load() {
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      otps: parsed.otps && typeof parsed.otps === 'object' ? parsed.otps : {},
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch {
    return emptyDb();
  }
}

const db = load();

export function getDb() {
  return db;
}

export function saveDb() {
  const tmp = `${dbFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dbFile);
}

export function mutate(fn) {
  const result = fn(db);
  saveDb();
  return result;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    lastName: user.lastName || '',
    fullName: [user.name, user.lastName].filter(Boolean).join(' '),
    email: user.email,
    birthYear: user.birthYear ?? null,
    avatar: user.avatar || null,
    provider: user.provider,
    createdAt: user.createdAt,
  };
}
