import { Router } from 'express';
import { config } from '../config.js';
import { listOutbox, readOutbox } from '../mailer.js';
import { escapeHtml } from '../util.js';

const router = Router();

router.get('/api/dev/outbox', (_req, res) => {
  const entries = listOutbox();
  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #ece7f8;">
          <a href="/api/dev/outbox/${encodeURIComponent(entry.id)}" style="color:#6d28d9;font-weight:700;text-decoration:none;">${escapeHtml(entry.subject)}</a>
          <div style="font-size:12px;color:#8b81a8;margin-top:4px;">Para: ${escapeHtml(entry.to)} · ${escapeHtml(entry.createdAt)}</div>
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #ece7f8;text-align:right;white-space:nowrap;">
          ${entry.code ? `<span style="background:#ede9fe;color:#5b21b6;padding:6px 10px;border-radius:8px;font-family:monospace;font-weight:700;">OTP ${escapeHtml(entry.code)}</span>` : ''}
        </td>
      </tr>`,
    )
    .join('');

  res.type('html').send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bandeja de desarrollo</title></head>
<body style="margin:0;background:#f6f3fc;font-family:'Segoe UI',system-ui,sans-serif;color:#241442;">
<div style="max-width:760px;margin:40px auto;padding:0 16px;">
  <div style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(60,28,120,.12);">
    <div style="background:linear-gradient(135deg,#6d28d9,#c026d3);padding:24px 26px;color:#fff;">
      <div style="font-size:13px;opacity:.8;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(config.storeName)}</div>
      <h1 style="margin:6px 0 0;font-size:22px;">Bandeja de correos de desarrollo</h1>
    </div>
    <div style="padding:18px 26px 8px;font-size:13px;color:#6b6385;line-height:1.6;">
      No hay SMTP configurado, así que los correos se guardan aquí. En producción configura SMTP_* en <code>.env</code>.
    </div>
    <table style="width:100%;border-collapse:collapse;">${rows || `<tr><td style="padding:34px;text-align:center;color:#8b81a8;">Todavía no se envió ningún correo.</td></tr>`}</table>
    <div style="padding:18px 26px 24px;"><a href="/" style="color:#6d28d9;font-weight:700;text-decoration:none;">← Volver a la tienda</a></div>
  </div>
</div>
</body></html>`);
});

router.get('/api/dev/outbox/:id', (req, res) => {
  const html = readOutbox(req.params.id);
  if (!html) return res.status(404).type('html').send('<h1>Correo no encontrado</h1>');
  res.type('html').send(html);
});

export default router;
