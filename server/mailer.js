import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { config, outboxDir } from './config.js';

let transporter = null;

if (config.mailerConfigured) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

export async function sendMail({ to, subject, html, text, meta = {} }) {
  if (transporter) {
    const info = await transporter.sendMail({
      from: config.mailFrom,
      to,
      subject,
      html,
      text,
    });
    return { delivered: true, messageId: info.messageId };
  }

  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const htmlFile = `${id}.html`;
  fs.writeFileSync(path.join(outboxDir, htmlFile), html, 'utf8');
  fs.writeFileSync(
    path.join(outboxDir, `${id}.json`),
    JSON.stringify(
      {
        id,
        to,
        subject,
        createdAt: new Date().toISOString(),
        htmlFile,
        ...meta,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`[mail:dev] "${subject}" → ${to}. Vista previa: ${config.appUrl}/api/dev/outbox/${id}`);
  return { delivered: false, previewUrl: `/api/dev/outbox/${id}` };
}

export function listOutbox() {
  const entries = [];
  for (const file of fs.readdirSync(outboxDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(outboxDir, file), 'utf8'));
      entries.push(data);
    } catch {
      /* archivo corrupto: se ignora */
    }
  }
  return entries.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function readOutbox(id) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return null;
  const file = path.join(outboxDir, `${id}.html`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}
