import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, publicDir } from './config.js';
import { attachUser } from './middlewares/auth.js';
import { errorHandler, notFoundHandler, requireSameOrigin, securityHeaders } from './middlewares/security.js';
import './models/settings.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import devRoutes from './routes/dev.js';
import orderRoutes from './routes/orders.js';
import productRoutes from './routes/products.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(securityHeaders);
app.use(express.json({ limit: '64kb' }));
app.use(attachUser);
app.use('/api', requireSameOrigin);

app.use(productRoutes);
app.use(authRoutes);
app.use(orderRoutes);
app.use(adminRoutes);

if (config.devMode || process.env.ALLOW_DEV_OUTBOX === 'true') {
  app.use(devRoutes);
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

app.use(notFoundHandler);
app.use(errorHandler);

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
