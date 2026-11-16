import { config } from './config.js';
import { escapeHtml } from './util.js';

const brand = config.storeName;

function layout({ preheader, heading, body }) {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(brand)}</title></head>
<body style="margin:0;padding:0;background-color:#f3f0fb;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#231b3a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f0fb;padding:32px 14px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(60,28,120,0.12);">
      <tr>
        <td bgcolor="#6d28d9" style="padding:26px 32px;background-image:linear-gradient(135deg,#6d28d9 0%,#c026d3 100%);color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">
          ${escapeHtml(brand)} <span style="font-weight:400;opacity:0.75;">Store</span>
        </td>
      </tr>
      <tr><td style="padding:36px 32px 12px 32px;">
        <h1 style="margin:0 0 14px 0;font-size:26px;line-height:1.25;letter-spacing:-0.5px;color:#1d1233;">${heading}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:24px 32px 32px 32px;">
        <hr style="border:none;border-top:1px solid #ece7f8;margin:0 0 18px 0;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#8b81a8;">
          ${escapeHtml(brand)} · Productos digitales con entrega inmediata.<br>
          ¿Necesitas ayuda? Escríbenos a <a href="mailto:${escapeHtml(config.supportEmail)}" style="color:#7c3aed;text-decoration:none;">${escapeHtml(config.supportEmail)}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function otpEmail({ code, purpose }) {
  const isSignup = purpose === 'signup';
  const heading = isSignup ? 'Confirma tu correo' : 'Tu código de acceso';
  const intro = isSignup
    ? 'Estás a un paso de crear tu cuenta en la tienda. Usa este código para verificar tu correo electrónico.'
    : 'Usa este código para iniciar sesión en tu cuenta.';
  const html = layout({
    preheader: `Tu código de verificación es ${code}`,
    heading,
    body: `
      <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:#5c5475;">${intro}</p>
      <div style="margin:0 0 24px 0;padding:22px 16px;background-color:#f5f1ff;border:1px dashed #c4b5fd;border-radius:14px;text-align:center;">
        <div style="font-family:Consolas,'Courier New',monospace;font-size:38px;line-height:1;letter-spacing:12px;font-weight:800;color:#4c1d95;padding-left:12px;">${code}</div>
      </div>
      <p style="margin:0 0 8px 0;font-size:14px;line-height:1.7;color:#5c5475;">El código vence en <strong>${Math.round(config.otp.ttlMs / 60000)} minutos</strong> y solo puede usarse una vez.</p>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#8b81a8;">Si no solicitaste este código, ignora este correo. Nadie podrá acceder a tu cuenta sin él.</p>`,
  });
  return {
    subject: isSignup ? `Verifica tu correo · ${brand}` : `Tu código de acceso · ${brand}`,
    html,
    text: `${heading}\n\nTu código es: ${code}\nVence en ${Math.round(config.otp.ttlMs / 60000)} minutos.\n\n${brand}`,
  };
}

export function purchaseEmail({ user, order, links }) {
  const firstName = escapeHtml(user.name || 'hola');
  const rows = links
    .map(
      (link) => `
      <tr>
        <td style="padding:18px 0;border-bottom:1px solid #efeaf9;">
          <div style="font-size:15px;font-weight:700;color:#241442;margin-bottom:4px;">${escapeHtml(link.name)}</div>
          <div style="font-size:12px;color:#8b81a8;margin-bottom:14px;">${escapeHtml(link.fileLabel || 'Archivo digital')} · Pedido ${escapeHtml(order.code)}</div>
          <a href="${escapeHtml(link.downloadUrl)}" style="display:inline-block;background-color:#6d28d9;background-image:linear-gradient(135deg,#6d28d9,#c026d3);color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:9px;margin:0 8px 8px 0;">Descargar producto</a>
          <a href="${escapeHtml(link.tutorialUrl)}" style="display:inline-block;background-color:#f5f1ff;color:#6d28d9;font-size:13px;font-weight:700;text-decoration:none;padding:11px 18px;border-radius:9px;border:1px solid #ddd2f7;">Ver video de instrucciones</a>
        </td>
      </tr>`,
    )
    .join('');

  const html = layout({
    preheader: `Tu compra ${order.code} está lista. Descarga tus productos.`,
    heading: `¡Gracias por tu compra, ${firstName}!`,
    body: `
      <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#5c5475;">
        Confirmamos tu pago de <strong>S/ ${order.total.toFixed(2)}</strong> (operación ${escapeHtml(order.operationCode || '')}). Tus productos ya están disponibles:
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">${rows}</table>
      <div style="background-color:#f5f1ff;border-radius:14px;padding:16px 18px;margin:0 0 20px 0;">
        <p style="margin:0;font-size:13px;line-height:1.7;color:#5c5475;">
          Los enlaces de descarga son personales y vencen en <strong>7 días</strong>. También puedes volver a descargarlos desde <strong>Mis compras</strong> en la tienda.
        </p>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#8b81a8;">
        Guarda este correo. Si tienes problemas con la descarga, responde a este mensaje y te ayudamos.
      </p>`,
  });

  return {
    subject: `Tu compra ${order.code} está lista · ${brand}`,
    html,
    text: `¡Gracias por tu compra, ${user.name}!\n\nPedido ${order.code} · S/ ${order.total.toFixed(2)}\n\nDescargas:\n${links
      .map((link) => `- ${link.name}: ${link.downloadUrl}\n  Instrucciones: ${link.tutorialUrl}`)
      .join('\n')}\n\nLos enlaces vencen en 7 días.\n\n${brand}`,
  };
}
