import fs from 'node:fs';
import path from 'node:path';
import { dataDir, filesDir } from './config.js';
import { HttpError } from './util.js';

const catalogFile = path.join(dataDir, 'products.json');

function readCatalog() {
  const raw = fs.readFileSync(catalogFile, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('products.json debe contener un arreglo de productos');
  return parsed;
}

const products = readCatalog();
const byId = new Map(products.map((product) => [product.id, product]));

function saveCatalog() {
  const tmp = `${catalogFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(products, null, 2));
  fs.renameSync(tmp, catalogFile);
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function fileInfo(product) {
  const filePath = productFilePath(product);
  if (!filePath) return { label: product.fileType || 'PDF', exists: false };
  try {
    const { size } = fs.statSync(filePath);
    const kb = size / 1024;
    return {
      label: `${product.fileType || 'PDF'} · ${kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`}`,
      exists: true,
    };
  } catch {
    return { label: product.fileType || 'PDF', exists: false };
  }
}

export function listAvailableFiles() {
  try {
    return fs
      .readdirSync(filesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => {
        const stat = fs.statSync(path.join(filesDir, entry.name));
        return { name: entry.name, size: stat.size };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function listProducts() {
  return products.map((product) => {
    const info = fileInfo(product);
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      tagline: product.tagline,
      description: product.description,
      price: product.price,
      compareAt: product.compareAt || null,
      cover: product.cover,
      accent: product.accent || '#8b5cf6',
      includes: product.includes || [],
      rating: product.rating || 5,
      reviews: product.reviews || 0,
      sales: product.sales || 0,
      badge: product.badge || null,
      fileLabel: info.label,
    };
  });
}

export function listAdminProducts() {
  return products.map((product) => {
    const info = fileInfo(product);
    return {
      ...product,
      compareAt: product.compareAt || null,
      badge: product.badge || null,
      accent: product.accent || '#8b5cf6',
      includes: product.includes || [],
      fileLabel: info.label,
      fileExists: info.exists,
    };
  });
}

export function getProduct(id) {
  return byId.get(id) || null;
}

export function getCategories() {
  return [...new Set(products.map((product) => product.category))];
}

export function productFilePath(product) {
  if (!product?.fileName) return null;
  const resolved = path.resolve(filesDir, String(product.fileName));
  if (!resolved.startsWith(path.resolve(filesDir) + path.sep)) return null;
  return resolved;
}

function normalizeIncludes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12);
  }
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function validateProductPayload(data, { isNew = false } = {}) {
  const name = String(data?.name || '').trim();
  const category = String(data?.category || '').trim();
  const price = Number(data?.price);

  if (isNew && !name) throw new HttpError(400, 'El nombre del producto es obligatorio.', 'INVALID_PRODUCT');
  if (isNew && !category) throw new HttpError(400, 'La categoría es obligatoria.', 'INVALID_PRODUCT');
  if ((isNew || data?.price !== undefined) && (!Number.isFinite(price) || price <= 0)) {
    throw new HttpError(400, 'El precio debe ser mayor a 0.', 'INVALID_PRODUCT');
  }

  const compareAtRaw = data?.compareAt;
  const compareAt =
    compareAtRaw === '' || compareAtRaw === null || compareAtRaw === undefined ? null : Number(compareAtRaw);
  if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt <= 0)) {
    throw new HttpError(400, 'El precio anterior debe ser mayor a 0 o quedar vacío.', 'INVALID_PRODUCT');
  }

  return {
    name,
    category,
    tagline: data?.tagline !== undefined ? String(data.tagline).trim() : undefined,
    description: data?.description !== undefined ? String(data.description).trim() : undefined,
    price: Number.isFinite(price) ? Math.round(price * 100) / 100 : undefined,
    compareAt: compareAtRaw !== undefined ? (compareAt ? Math.round(compareAt * 100) / 100 : null) : undefined,
    cover: data?.cover !== undefined ? String(data.cover).trim() : undefined,
    accent: data?.accent !== undefined ? String(data.accent).trim() : undefined,
    badge: data?.badge !== undefined ? (String(data.badge).trim() || null) : undefined,
    fileName: data?.fileName !== undefined ? path.basename(String(data.fileName).trim()) : undefined,
    fileType: data?.fileType !== undefined ? String(data.fileType).trim().toUpperCase() || 'PDF' : undefined,
    youtubeUrl: data?.youtubeUrl !== undefined ? String(data.youtubeUrl).trim() : undefined,
    includes: data?.includes !== undefined ? normalizeIncludes(data.includes) : undefined,
  };
}

export function createProduct(data) {
  const clean = validateProductPayload(data, { isNew: true });
  const baseId = slugify(data?.id || clean.name) || `producto-${Date.now()}`;
  let id = baseId;
  let counter = 2;
  while (byId.has(id)) {
    id = `${baseId}-${counter++}`;
  }

  const product = {
    id,
    name: clean.name,
    category: clean.category,
    tagline: clean.tagline || 'Recurso digital listo para usar',
    description: clean.description || clean.tagline || clean.name,
    price: clean.price,
    compareAt: clean.compareAt ?? null,
    cover: clean.cover || '/assets/covers/freelance-os.svg',
    accent: /^#[0-9a-fA-F]{6}$/.test(clean.accent || '') ? clean.accent : '#8b5cf6',
    badge: clean.badge ?? null,
    fileName: clean.fileName || `${id}.zip`,
    fileType: clean.fileType || 'ZIP',
    youtubeUrl: clean.youtubeUrl || '',
    includes: clean.includes || [],
    rating: 5,
    reviews: 0,
    sales: 0,
  };

  products.push(product);
  byId.set(product.id, product);
  saveCatalog();
  return listAdminProducts().find((item) => item.id === product.id);
}

export function updateProduct(id, patch) {
  const product = byId.get(id);
  if (!product) {
    throw new HttpError(404, 'Producto no encontrado.', 'PRODUCT_NOT_FOUND');
  }
  const clean = validateProductPayload(patch, { isNew: false });

  if (clean.name) product.name = clean.name;
  if (clean.category) product.category = clean.category;
  if (clean.tagline !== undefined) product.tagline = clean.tagline;
  if (clean.description !== undefined) product.description = clean.description;
  if (clean.price !== undefined) product.price = clean.price;
  if (clean.compareAt !== undefined) product.compareAt = clean.compareAt;
  if (clean.cover) product.cover = clean.cover;
  if (clean.accent && /^#[0-9a-fA-F]{6}$/.test(clean.accent)) product.accent = clean.accent;
  if (clean.badge !== undefined) product.badge = clean.badge;
  if (clean.fileName) product.fileName = clean.fileName;
  if (clean.fileType !== undefined) product.fileType = clean.fileType;
  if (clean.youtubeUrl !== undefined) product.youtubeUrl = clean.youtubeUrl;
  if (clean.includes !== undefined) product.includes = clean.includes;

  saveCatalog();
  return listAdminProducts().find((item) => item.id === product.id);
}

export function deleteProduct(id) {
  const index = products.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new HttpError(404, 'Producto no encontrado.', 'PRODUCT_NOT_FOUND');
  }
  const [removed] = products.splice(index, 1);
  byId.delete(removed.id);
  saveCatalog();
  return { ok: true, id: removed.id };
}
