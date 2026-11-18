import crypto from 'node:crypto';
import fs from 'node:fs';
import QRCode from 'qrcode';
import { config } from './config.js';
import { getDb, saveDb } from './models/db.js';
import { purchaseEmail } from './emails.js';
import { sendMail } from './mailer.js';
import { getProduct, productFilePath } from './models/products.js';
import { HttpError, money, orderCode, signPayload, verifyPayload } from './util.js';

function buildQrPayload(total, code) {
  return [
    'PAGO YAPE',
    `Tienda: ${config.storeName}`,
    `Yape: ${config.yape.phone}`,
    `Titular: ${config.yape.name}`,
    `Monto: S/ ${total.toFixed(2)}`,
    `Pedido: ${code}`,
  ].join('\n');
}

async function qrFor(order) {
  if (config.yape.qrImage) {
    return { image: config.yape.qrImage, generated: false };
  }
  const dataUrl = await QRCode.toDataURL(order.qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
    color: { dark: '#2B1450', light: '#FFFFFF' },
  });
  return { image: dataUrl, generated: true };
}

function publicOrder(order, { withQr = false } = {}) {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    total: order.total,
    items: order.items,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    operationCode: order.operationCode,
    ...(withQr && order.status === 'pending' ? { qrPayload: order.qrPayload } : {}),
  };
}

function markExpired(order) {
  if (order.status === 'pending' && order.expiresAt < Date.now()) {
    order.status = 'expired';
    return true;
  }
  return false;
}

export function buildLinks(order) {
  const expiresAt = Date.now() + config.downloadTtlMs;
  return order.items
    .map((item) => {
      const product = getProduct(item.productId);
      if (!product) return null;
      const token = signPayload(
        { o: order.id, p: product.id, exp: expiresAt },
        config.sessionSecret,
      );
      return {
        productId: product.id,
        name: product.name,
        fileLabel: `${product.fileType || 'PDF'}`,
        downloadUrl: `${config.appUrl}/api/download/${token}`,
        tutorialUrl: product.tutorialUrl,
        expiresAt: new Date(expiresAt).toISOString(),
      };
    })
    .filter(Boolean);
}

function uniqueOrderCode() {
  const db = getDb();
  const used = new Set(db.orders.map((order) => order.code));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = orderCode();
    if (!used.has(code)) return code;
  }
  return `CS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createOrder(user, productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new HttpError(400, 'Tu carrito está vacío.', 'EMPTY_CART');
  }

  const unique = [...new Set(productIds.map((id) => String(id)))].slice(0, 10);
  const items = unique.map((id) => {
    const product = getProduct(id);
    if (!product) {
      throw new HttpError(400, 'Uno de los productos ya no está disponible.', 'PRODUCT_UNAVAILABLE');
    }
    return { productId: product.id, name: product.name, price: product.price };
  });

  const total = money(items.reduce((sum, item) => sum + item.price, 0));
  const now = Date.now();
  const code = uniqueOrderCode();

  const order = {
    id: crypto.randomUUID(),
    code,
    userId: user.id,
    items,
    total,
    status: 'pending',
    qrPayload: buildQrPayload(total, code),
    createdAt: new Date(now).toISOString(),
    expiresAt: now + config.orderTtlMs,
    paidAt: null,
    operationCode: null,
  };

  const db = getDb();
  db.orders.push(order);
  saveDb();

  const qr = await qrFor(order);
  return {
    order: publicOrder(order),
    qr: {
      ...qr,
      payload: order.qrPayload,
      merchant: { name: config.yape.name, phone: config.yape.phone },
      expiresAt: order.expiresAt,
    },
  };
}

async function deliverPaidOrder(user, order) {
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  saveDb();

  const links = buildLinks(order);
  let emailSent = false;
  let emailError = null;

  try {
    const content = purchaseEmail({ user, order, links });
    await sendMail({
      to: user.email,
      ...content,
      meta: { kind: 'purchase', orderId: order.id, orderCode: order.code },
    });
    emailSent = true;
  } catch (error) {
    emailError =
      'El pago se registró, pero no pudimos enviar el correo con los enlaces. Puedes descargarlos aquí mismo.';
    console.error('[orders] Error enviando el correo de compra:', error);
  }

  return { order: publicOrder(order), links, emailSent, emailError };
}

export async function confirmOrder(user, orderId, rawOperationCode) {
  const db = getDb();
  const order = db.orders.find((candidate) => candidate.id === orderId && candidate.userId === user.id);
  if (!order) {
    throw new HttpError(404, 'No encontramos este pedido.', 'ORDER_NOT_FOUND');
  }

  if (order.status === 'paid') {
    return {
      order: publicOrder(order),
      links: buildLinks(order),
      alreadyPaid: true,
      emailSent: null,
    };
  }
  if (order.status === 'verifying') {
    return {
      order: publicOrder(order),
      links: [],
      pendingApproval: true,
      emailSent: null,
    };
  }
  if (markExpired(order)) {
    saveDb();
    throw new HttpError(409, 'El tiempo para pagar este pedido expiró. Genera uno nuevo.', 'ORDER_EXPIRED');
  }

  const operationCode = String(rawOperationCode || '')
    .trim()
    .replace(/[\s-]/g, '')
    .toUpperCase();

  if (!/^[A-Z0-9]{6,20}$/.test(operationCode)) {
    throw new HttpError(
      400,
      'Ingresa el número de operación de Yape (entre 6 y 20 letras o dígitos).',
      'INVALID_OPERATION_CODE',
    );
  }

  const reused = db.orders.some(
    (candidate) =>
      candidate.id !== order.id &&
      candidate.operationCode === operationCode &&
      ['paid', 'verifying'].includes(candidate.status),
  );
  if (reused) {
    throw new HttpError(
      409,
      'Ese número de operación ya fue registrado en otra compra. Verifica el código.',
      'OPERATION_CODE_REUSED',
    );
  }

  order.operationCode = operationCode;

  if (config.requireManualApproval) {
    order.status = 'verifying';
    saveDb();
    return { order: publicOrder(order), links: [], pendingApproval: true, emailSent: null };
  }

  return deliverPaidOrder(user, order);
}

export async function listMyOrders(userId) {
  const db = getDb();
  let changed = false;
  const orders = db.orders
    .filter((order) => order.userId === userId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((order) => {
      if (markExpired(order)) changed = true;
      return {
        ...publicOrder(order),
        links: order.status === 'paid' ? buildLinks(order) : [],
      };
    });
  if (changed) saveDb();
  return orders;
}

function orderOwner(db, order) {
  const user = db.users.find((candidate) => candidate.id === order.userId);
  return user
    ? { name: [user.name, user.lastName].filter(Boolean).join(' '), email: user.email }
    : null;
}

export function listAllOrders() {
  const db = getDb();
  let changed = false;
  const orders = [...db.orders]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((order) => {
      if (markExpired(order)) changed = true;
      return {
        ...publicOrder(order),
        user: orderOwner(db, order),
        links: order.status === 'paid' ? buildLinks(order) : [],
      };
    });
  if (changed) saveDb();
  return orders;
}

export async function approveOrder(orderId) {
  const db = getDb();
  const order = db.orders.find((candidate) => candidate.id === orderId);
  if (!order) throw new HttpError(404, 'No encontramos este pedido.', 'ORDER_NOT_FOUND');

  const owner = orderOwner(db, order);
  if (order.status === 'paid') {
    return {
      order: publicOrder(order),
      links: buildLinks(order),
      user: owner,
      alreadyPaid: true,
      emailSent: null,
    };
  }
  if (order.status !== 'verifying') {
    throw new HttpError(
      409,
      'Solo se pueden aprobar pedidos que están en verificación.',
      'ORDER_NOT_VERIFYING',
    );
  }

  const user = db.users.find((candidate) => candidate.id === order.userId);
  if (!user) throw new HttpError(404, 'No encontramos al comprador de este pedido.', 'ORDER_USER_MISSING');

  const result = await deliverPaidOrder(user, order);
  return { ...result, user: owner };
}

export function rejectOrder(orderId) {
  const db = getDb();
  const order = db.orders.find((candidate) => candidate.id === orderId);
  if (!order) throw new HttpError(404, 'No encontramos este pedido.', 'ORDER_NOT_FOUND');
  if (order.status === 'paid') {
    throw new HttpError(409, 'No puedes rechazar un pedido ya pagado.', 'ORDER_ALREADY_PAID');
  }
  order.status = 'expired';
  saveDb();
  return { order: publicOrder(order), user: orderOwner(db, order) };
}

export async function getOrderForUser(userId, orderId) {
  const db = getDb();
  const order = db.orders.find((candidate) => candidate.id === orderId && candidate.userId === userId);
  if (!order) throw new HttpError(404, 'No encontramos este pedido.', 'ORDER_NOT_FOUND');
  if (markExpired(order)) saveDb();

  const result = {
    order: publicOrder(order),
    links: order.status === 'paid' ? buildLinks(order) : [],
  };
  if (order.status === 'pending') {
    result.qr = {
      ...(await qrFor(order)),
      payload: order.qrPayload,
      merchant: { name: config.yape.name, phone: config.yape.phone },
      expiresAt: order.expiresAt,
    };
  }
  return result;
}

export function resolveDownload(token) {
  const payload = verifyPayload(token, config.sessionSecret);
  if (!payload || !payload.o || !payload.p) {
    throw new HttpError(403, 'Este enlace de descarga no es válido o venció.', 'DOWNLOAD_INVALID');
  }
  const order = getDb().orders.find((candidate) => candidate.id === payload.o);
  if (!order || order.status !== 'paid') {
    throw new HttpError(403, 'La compra todavía no está confirmada.', 'DOWNLOAD_NOT_PAID');
  }
  const product = getProduct(payload.p);
  if (!product) {
    throw new HttpError(404, 'El producto ya no está disponible.', 'DOWNLOAD_PRODUCT_MISSING');
  }
  const filePath = productFilePath(product);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new HttpError(404, 'El archivo no está disponible. Contacta a soporte.', 'DOWNLOAD_FILE_MISSING');
  }
  return { order, product, filePath };
}

export { publicOrder };
