import path from 'node:path';
import { config, publicDir } from '../config.js';
import { listOutbox } from '../mailer.js';
import { safeEquals } from '../middlewares/auth.js';
import { getDb, publicUser } from '../models/db.js';
import { getSettings, updateSettings } from '../models/settings.js';
import { approveOrder, listAllOrders, rejectOrder } from '../orders.js';
import {
  createProduct,
  deleteProduct,
  getCategories,
  listAdminProducts,
  listAvailableFiles,
  updateProduct,
} from '../products.js';
import { HttpError, signPayload } from '../util.js';

export function adminLogin(req, res, next) {
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
}

export function getOverview(_req, res) {
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
}

export function listOrders(_req, res) {
  res.json({ orders: listAllOrders() });
}

export async function approve(req, res) {
  res.json(await approveOrder(req.params.id));
}

export function reject(req, res) {
  res.json(rejectOrder(req.params.id));
}

export function listProductsAdmin(_req, res) {
  res.json({
    products: listAdminProducts(),
    categories: getCategories(),
    files: listAvailableFiles(),
  });
}

export function createProductAdmin(req, res) {
  const product = createProduct(req.body);
  res.status(201).json({ product });
}

export function updateProductAdmin(req, res) {
  const product = updateProduct(req.params.id, req.body);
  res.json({ product });
}

export function deleteProductAdmin(req, res) {
  res.json(deleteProduct(req.params.id));
}

export function getSettingsAdmin(_req, res) {
  res.json({ settings: getSettings() });
}

export function updateSettingsAdmin(req, res) {
  const settings = updateSettings(req.body);
  res.json({ settings });
}

export function listUsers(_req, res) {
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
}

export function serveAdminPage(_req, res) {
  res.sendFile(path.join(publicDir, 'admin.html'));
}
