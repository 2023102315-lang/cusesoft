import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  attachUser,
  endSession,
  loginWithGoogle,
  loginWithPassword,
  me,
  registerWithPassword,
  requestOtp,
  requireAuth,
  startSession,
  updateBirthYear,
  verifyOtp,
} from './auth.js';
import { config, publicDir } from './config.js';
import { getDb, isAdminUser, publicUser } from './db.js';
import { listOutbox, readOutbox } from './mailer.js';
import {
  approveOrder,
  confirmOrder,
  createOrder,
  getOrderForUser,
  listAllOrders,
  listMyOrders,
  rejectOrder,
  resolveDownload,
} from './orders.js';
import {
  createProduct,
  deleteProduct,
  getCategories,
  listAdminProducts,
  listAvailableFiles,
  listProducts,
  updateProduct,
} from './products.js';
import { getSettings, updateSettings } from './settings.js';
import {
  createRateLimiter,
  escapeHtml,
  HttpError,
  normalizeEmail,
  signPayload,
  verifyPayload,
} from './util.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "script-src 'self' https://accounts.google.com https://www.gstatic.com",
      "frame-src https://accounts.google.com",
      "connect-src 'self' https://accounts.google.com",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
});

app.use(express.json({ limit: '64kb' }));
app.use(attachUser);

app.use('/api', (req, res, next) => {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch {
    /* origen inválido */
  }
  return next(new HttpError(403, 'Origen no permitido.', 'BAD_ORIGIN'));
});

const emailKey = (req) => normalizeEmail(req.body?.email) || req.ip;
const otpRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) => `${req.ip}:${emailKey(req)}`,
});
const otpVerifyLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  key: (req) => `${req.ip}:${emailKey(req)}`,
});
const orderLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  key: (req) => req.user?.id || req.ip,
});

function safeEquals(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a || '')).digest();
  const hashB = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function requireAdmin(req, _res, next) {
  if (req.user && isAdminUser(req.user)) {
    req.adminUser = req.user.email;
    return next();
  }

  if (!config.adminToken && !config.adminPassword) {
    return next(
      new HttpError(
        503,
        'El panel de administración no está configurado. Define ADMIN_TOKEN o ADMIN_PASSWORD en .env.',
        'ADMIN_DISABLED',
      ),
    );
  }
  const provided = String(req.get('x-admin-token') || '');
  if (!provided) {
    return next(new HttpError(401, 'Sesión de administración inválida.', 'ADMIN_UNAUTHORIZED'));
  }

  const session = verifyPayload(provided, config.sessionSecret);
  if (session && session.role === 'admin') {
    req.adminUser = session.user || config.adminUser;
    return next();
  }

  if (config.adminToken && safeEquals(provided, config.adminToken)) {
    req.adminUser = 'token';
    return next();
  }

  return next(new HttpError(401, 'Credenciales o token de administración inválidos.', 'ADMIN_UNAUTHORIZED'));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/config', (_req, res) => {
  res.json({
    storeName: config.storeName,
    currency: 'PEN',
    googleClientId: config.googleClientId,
    googleEnabled: Boolean(config.googleClientId),
    mailerConfigured: config.mailerConfigured,
    devMode: config.devMode,
    exposeOtp: config.exposeOtp,
    yape: { name: config.yape.name, phone: config.yape.phone, qrImage: config.yape.qrImage },
    featuredIds: getSettings().featuredIds,
    supportEmail: config.supportEmail,
    adminDefaultCredentialsActive: config.adminDefaultCredentialsActive,
    ...(config.adminDefaultCredentialsActive ? { adminDefaultUser: config.adminUser } : {}),
  });
});

app.get('/api/products', (_req, res) => {
  res.json({ products: listProducts(), categories: getCategories() });
});

app.get('/api/auth/me', me);

app.post('/api/auth/register', otpVerifyLimiter, (req, res) => {
  const user = registerWithPassword({
    email: req.body?.email,
    password: req.body?.password,
    name: req.body?.name,
    lastName: req.body?.lastName,
    birthYear: req.body?.birthYear,
  });
  startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/login', otpVerifyLimiter, (req, res) => {
  const user = loginWithPassword({
    email: req.body?.email,
    password: req.body?.password,
  });
  startSession(res, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/otp/request', otpRequestLimiter, async (req, res) => {
  const result = await requestOtp({
    email: req.body?.email,
    mode: req.body?.mode,
    name: req.body?.name,
    lastName: req.body?.lastName,
    birthYear: req.body?.birthYear,
  });
  res.json({ ok: true, ...result });
});

app.post('/api/auth/otp/verify', otpVerifyLimiter, (req, res) => {
  const user = verifyOtp({ email: req.body?.email, code: req.body?.code });
  startSession(res, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/google', otpVerifyLimiter, async (req, res) => {
  const user = await loginWithGoogle(req.body?.credential);
  startSession(res, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  endSession(res);
  res.json({ ok: true });
});

app.patch('/api/auth/profile', requireAuth, (req, res) => {
  const user = updateBirthYear(req.user, req.body?.birthYear);
  res.json({ user: publicUser(user) });
});

app.post('/api/orders', requireAuth, orderLimiter, async (req, res) => {
  const result = await createOrder(req.user, req.body?.items);
  res.status(201).json(result);
});

app.get('/api/orders', requireAuth, async (req, res) => {
  res.json({ orders: await listMyOrders(req.user.id) });
});

app.get('/api/orders/:id', requireAuth, async (req, res) => {
  res.json(await getOrderForUser(req.user.id, req.params.id));
});

app.post('/api/orders/:id/confirm', requireAuth, orderLimiter, async (req, res) => {
  const result = await confirmOrder(req.user, req.params.id, req.body?.operationCode);
  res.json(result);
});

app.post('/api/admin/login', otpVerifyLimiter, (req, res, next) => {
  if (!config.adminToken && !config.adminPassword) {
    return next(
      new HttpError(
        503,
        'El panel de administración no está configurado. Define ADMIN_TOKEN o ADMIN_PASSWORD en .env.',
        'ADMIN_DISABLED',
      ),
    );
  }

  const rawToken = String(req.body?.token || '').trim();
  if (rawToken) {
    if (config.adminToken && safeEquals(rawToken, config.adminToken)) {
      const token = signPayload(
        { role: 'admin', user: 'token', exp: Date.now() + 24 * 60 * 60 * 1000 },
        config.sessionSecret,
      );
      return res.json({ token, user: 'token' });
    }
    return next(new HttpError(401, 'Token de administración inválido.', 'ADMIN_UNAUTHORIZED'));
  }

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!config.adminPassword || !username || !password) {
    return next(new HttpError(401, 'Ingresa usuario y contraseña válidos.', 'ADMIN_UNAUTHORIZED'));
  }

  if (!safeEquals(username, config.adminUser) || !safeEquals(password, config.adminPassword)) {
    return next(new HttpError(401, 'Usuario o contraseña incorrectos.', 'ADMIN_UNAUTHORIZED'));
  }

  const token = signPayload(
    { role: 'admin', user: config.adminUser, exp: Date.now() + 24 * 60 * 60 * 1000 },
    config.sessionSecret,
  );
  return res.json({ token, user: config.adminUser });
});

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const db = getDb();
  const orders = listAllOrders();
  const products = listAdminProducts();
  const paidOrders = orders.filter((order) => order.status === 'paid');
  const verifyingOrders = orders.filter((order) => order.status === 'verifying');
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const outboxCount = config.devMode || process.env.ALLOW_DEV_OUTBOX === 'true' ? listOutbox().length : 0;

  res.json({
    adminUser: config.adminUser,
    stats: {
      revenue,
      ordersTotal: orders.length,
      ordersPaid: paidOrders.length,
      ordersVerifying: verifyingOrders.length,
      usersTotal: db.users.length,
      productsTotal: products.length,
      filesTotal: listAvailableFiles().length,
      outboxCount,
    },
    system: {
      env: config.env,
      storeName: config.storeName,
      appUrl: config.appUrl,
      devMode: config.devMode,
      mailerConfigured: config.mailerConfigured,
      requireManualApproval: config.requireManualApproval,
      googleEnabled: Boolean(config.googleClientId),
      adminTokenConfigured: Boolean(config.adminToken),
      adminDefaultCredentialsActive: config.adminDefaultCredentialsActive,
      yape: { name: config.yape.name, phone: config.yape.phone },
    },
  });
});

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  res.json({ orders: listAllOrders() });
});

app.post('/api/admin/orders/:id/approve', requireAdmin, async (req, res) => {
  res.json(await approveOrder(req.params.id));
});

app.post('/api/admin/orders/:id/reject', requireAdmin, (req, res) => {
  res.json(rejectOrder(req.params.id));
});

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  res.json({
    products: listAdminProducts(),
    categories: getCategories(),
    files: listAvailableFiles(),
  });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const product = createProduct(req.body);
  res.status(201).json({ product });
});

app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  const product = updateProduct(req.params.id, req.body);
  res.json({ product });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  res.json(deleteProduct(req.params.id));
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json({ settings: getSettings() });
});

app.patch('/api/admin/settings', requireAdmin, (req, res) => {
  const settings = updateSettings(req.body);
  res.json({ settings });
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  const db = getDb();
  const ordersByUser = new Map();
  for (const order of db.orders) {
    const current = ordersByUser.get(order.userId) || { count: 0, paidCount: 0, spent: 0 };
    current.count += 1;
    if (order.status === 'paid') {
      current.paidCount += 1;
      current.spent += Number(order.total || 0);
    }
    ordersByUser.set(order.userId, current);
  }

  const users = [...db.users]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((user) => {
      const summary = ordersByUser.get(user.id) || { count: 0, paidCount: 0, spent: 0 };
      return {
        ...publicUser(user),
        ordersCount: summary.count,
        paidOrdersCount: summary.paidCount,
        totalSpent: summary.spent,
      };
    });

  res.json({ users });
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get('/api/download/:token', (req, res, next) => {
  let file;
  try {
    file = resolveDownload(req.params.token);
  } catch (error) {
    return next(error);
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.download(file.filePath, file.product.fileName, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

if (config.devMode || process.env.ALLOW_DEV_OUTBOX === 'true') {
  app.get('/api/dev/outbox', (_req, res) => {
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

  app.get('/api/dev/outbox/:id', (req, res) => {
    const html = readOutbox(req.params.id);
    if (!html) return res.status(404).type('html').send('<h1>Correo no encontrado</h1>');
    res.type('html').send(html);
  });
}

app.use(
  express.static(publicDir, {
    etag: true,
    maxAge: config.env === 'production' ? '1h' : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && req.accepts('html')) {
    return res.sendFile(path.join(publicDir, 'index.html'));
  }
  return next();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.', code: 'NOT_FOUND' });
});

app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  const status = Number(error.status) || 500;
  if (status >= 500 && !error.status) console.error('[error]', error);
  const details = error.details && typeof error.details === 'object' ? error.details : {};
  res.status(status).json({
    error: status >= 500 && !error.status ? 'Ocurrió un error inesperado. Intenta de nuevo.' : error.message,
    code: details.code || error.code || null,
    ...details,
  });
});

const server = app.listen(config.port, config.host, () => {
  console.log('');
  console.log(`  ${config.storeName} Store`);
  console.log(`  ▸ Tienda:  ${config.appUrl}`);
  console.log(`  ▸ Modo:    ${config.env}`);
  if (config.devMode) {
    console.log(`  ▸ Correos: ${config.appUrl}/api/dev/outbox (sin SMTP configurado)`);
    console.log('  ▸ El código OTP también se muestra en pantalla para pruebas.');
  } else {
    console.log(`  ▸ Correos: SMTP ${config.smtp.host}`);
  }
  if (!config.googleClientId) {
    console.log('  ▸ Google:  desactivado (define GOOGLE_CLIENT_ID en .env)');
  }
  console.log(`  ▸ Yape:    ${config.yape.name} · ${config.yape.phone}`);
  console.log('');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${config.port} ya está en uso. Cambia PORT en .env o cierra la otra aplicación.`);
    process.exit(1);
  }
  throw error;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
