import { config } from '../config.js';
import { getSettings } from '../models/settings.js';
import { getCategories, listProducts } from '../products.js';
import { buildProductMeta, buildRobotsTxt, buildSitemapXml } from '../seo/seo.js';

export function getHealth(_req, res) {
  res.json({ ok: true, time: new Date().toISOString() });
}

export function getPublicConfig(_req, res) {
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
}

export function getProducts(_req, res) {
  res.json({ products: listProducts(), categories: getCategories() });
}

export function renderProductPage(req, res, next) {
  const product = listProducts().find((item) => item.id === req.params.id);
  if (!product) return next();
  const meta = buildProductMeta(product);
  return res.render('product', {
    product,
    meta,
    storeName: config.storeName,
  });
}

export function getSitemap(_req, res) {
  res.type('application/xml').send(buildSitemapXml(listProducts()));
}

export function getRobots(_req, res) {
  res.type('text/plain').send(buildRobotsTxt());
}
