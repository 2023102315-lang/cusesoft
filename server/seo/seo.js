import { config } from '../config.js';

export function buildProductMeta(product) {
  const baseUrl = config.appUrl;
  const url = `${baseUrl}/producto/${encodeURIComponent(product.id)}`;
  const image = product.cover?.startsWith('http') ? product.cover : `${baseUrl}${product.cover || '/assets/favicon.svg'}`;
  const description = String(product.description || product.tagline || product.name).slice(0, 160);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image,
    category: product.category,
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: config.storeName,
    },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'PEN',
      price: Number(product.price || 0).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
  };

  if (product.rating && product.reviews) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(product.rating),
      reviewCount: String(product.reviews),
    };
  }

  return {
    title: `${product.name} — ${config.storeName} Store`,
    description,
    canonicalUrl: url,
    ogImage: image,
    jsonLd: JSON.stringify(jsonLd),
  };
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildSitemapXml(products) {
  const baseUrl = config.appUrl;
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url>\n    <loc>${escapeXml(baseUrl)}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    ...products.map(
      (product) =>
        `  <url>\n    <loc>${escapeXml(`${baseUrl}/producto/${encodeURIComponent(product.id)}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function buildRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /producto/',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${config.appUrl}/sitemap.xml`,
    '',
  ].join('\n');
}
