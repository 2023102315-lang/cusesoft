import fs from 'node:fs';
import path from 'node:path';
import { config, dataDir } from './config.js';

const settingsFile = path.join(dataDir, 'settings.json');

function defaultSettings() {
  return {
    storeName: config.storeName,
    supportEmail: config.supportEmail,
    requireManualApproval: Boolean(config.requireManualApproval),
    yapeName: config.yape.name,
    yapePhone: config.yape.phone,
    yapeQrImage: config.yape.qrImage || '',
    featuredIds: ['freelance-os', 'react-desde-cero'],
  };
}

function loadSettings() {
  const base = defaultSettings();
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...base,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      featuredIds: Array.isArray(parsed?.featuredIds) ? parsed.featuredIds : base.featuredIds,
    };
  } catch {
    return base;
  }
}

let settings = loadSettings();

function applyToConfig(current) {
  config.storeName = current.storeName;
  config.supportEmail = current.supportEmail;
  config.requireManualApproval = Boolean(current.requireManualApproval);
  config.yape.name = current.yapeName;
  config.yape.phone = current.yapePhone;
  config.yape.qrImage = current.yapeQrImage || '';
}

applyToConfig(settings);

function saveSettings() {
  const tmp = `${settingsFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
  fs.renameSync(tmp, settingsFile);
}

export function getSettings() {
  return { ...settings, featuredIds: [...(settings.featuredIds || [])] };
}

export function updateSettings(patch) {
  const next = { ...settings };

  if (patch?.storeName !== undefined) {
    const val = String(patch.storeName).trim();
    if (val) next.storeName = val.slice(0, 60);
  }
  if (patch?.supportEmail !== undefined) {
    const val = String(patch.supportEmail).trim();
    if (val) next.supportEmail = val.slice(0, 120);
  }
  if (patch?.requireManualApproval !== undefined) {
    next.requireManualApproval = Boolean(patch.requireManualApproval);
  }
  if (patch?.yapeName !== undefined) {
    const val = String(patch.yapeName).trim();
    if (val) next.yapeName = val.slice(0, 80);
  }
  if (patch?.yapePhone !== undefined) {
    const val = String(patch.yapePhone).trim();
    if (val) next.yapePhone = val.slice(0, 30);
  }
  if (patch?.yapeQrImage !== undefined) {
    next.yapeQrImage = String(patch.yapeQrImage).trim().slice(0, 240);
  }
  if (Array.isArray(patch?.featuredIds)) {
    next.featuredIds = [...new Set(patch.featuredIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 6);
  }

  settings = next;
  applyToConfig(settings);
  saveSettings();
  return getSettings();
}
