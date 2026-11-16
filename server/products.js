import fs from 'node:fs';
import path from 'node:path';
import { dataDir, filesDir } from './config.js';

const catalogFile = path.join(dataDir, 'products.json');

function readCatalog() {
  const raw = fs.readFileSync(catalogFile, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('products.json debe contener un arreglo de productos');
  return parsed;
}

const products = readCatalog();
const byId = new Map(products.map((product) => [product.id, product]));

function fileInfo(product) {
  const filePath = path.join(filesDir, product.fileName);
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

export function getProduct(id) {
  return byId.get(id) || null;
}

export function getCategories() {
  return [...new Set(products.map((product) => product.category))];
}

export function productFilePath(product) {
  const resolved = path.resolve(filesDir, product.fileName);
  if (!resolved.startsWith(path.resolve(filesDir) + path.sep)) return null;
  return resolved;
}
