import fs from 'node:fs';
import path from 'node:path';
import { dataDir, filesDir } from '../config.js';

const catalogFile = path.join(dataDir, 'products.json');

function readCatalog() {
  const raw = fs.readFileSync(catalogFile, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('products.json debe contener un arreglo de productos');
  return parsed;
}

const products = readCatalog();
const byId = new Map(products.map((product) => [product.id, product]));

export function saveCatalog() {
  const tmp = `${catalogFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(products, null, 2));
  fs.renameSync(tmp, catalogFile);
}

export function getRawProducts() {
  return products;
}

export function getProduct(id) {
  return byId.get(id) || null;
}

export function insertProduct(product) {
  products.push(product);
  byId.set(product.id, product);
  saveCatalog();
  return product;
}

export function removeProduct(id) {
  const index = products.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const [removed] = products.splice(index, 1);
  byId.delete(removed.id);
  saveCatalog();
  return removed;
}

export function productFilePath(product) {
  if (!product?.fileName) return null;
  const resolved = path.resolve(filesDir, String(product.fileName));
  if (!resolved.startsWith(path.resolve(filesDir) + path.sep)) return null;
  return resolved;
}

export function fileInfo(product) {
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
