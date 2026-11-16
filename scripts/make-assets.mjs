import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const products = JSON.parse(fs.readFileSync(path.join(root, 'server/data/products.json'), 'utf8'));
const coversDir = path.join(root, 'public/assets/covers');
const filesDir = path.join(root, 'server/files');
fs.mkdirSync(coversDir, { recursive: true });
fs.mkdirSync(filesDir, { recursive: true });

const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function shade(hex, amount) {
  const value = hex.replace('#', '');
  const num = Number.parseInt(value, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function variantShapes(index, accent) {
  const shapes = [
    `<g transform="rotate(-18 500 300)" fill="${accent}" fill-opacity=".30">
      <rect x="410" y="170" width="230" height="230" rx="46"/>
      <rect x="470" y="230" width="230" height="230" rx="46" fill="#ffffff" fill-opacity=".07"/>
    </g>`,
    `<g fill="none" stroke="${accent}" stroke-opacity=".55" stroke-width="2">
      <path d="M360 360c60-120 150-120 220 0s160 120 220 0"/>
      <path d="M360 400c60-120 150-120 220 0s160 120 220 0" stroke-opacity=".3"/>
      <path d="M360 440c60-120 150-120 220 0s160 120 220 0" stroke-opacity=".15"/>
    </g>`,
    `<g fill="none" stroke="#ffffff" stroke-opacity=".22">
      <circle cx="590" cy="250" r="150" stroke-width="1.5"/>
      <circle cx="590" cy="250" r="110" stroke-width="1.5"/>
      <circle cx="590" cy="250" r="70" stroke="${accent}" stroke-opacity=".8" stroke-width="26"/>
    </g>`,
    `<g fill="${accent}" fill-opacity=".28">
      <rect x="390" y="140" width="60" height="330" rx="30" transform="rotate(18 390 140)"/>
      <rect x="480" y="80" width="60" height="330" rx="30" transform="rotate(18 480 80)" fill="#ffffff" fill-opacity=".10"/>
      <rect x="570" y="140" width="60" height="330" rx="30" transform="rotate(18 570 140)" fill-opacity=".16"/>
    </g>`,
  ];
  return shapes[index % shapes.length];
}

function coverSvg(product, index) {
  const accent = product.accent || '#8b5cf6';
  const dark = shade(accent, -110);
  const twoDigits = String(index + 1).padStart(2, '0');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" role="img" aria-label="${esc(product.name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0613"/>
      <stop offset="0.62" stop-color="${dark}"/>
      <stop offset="1" stop-color="${shade(accent, -70)}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${accent}" stop-opacity=".85"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity=".05"/>
    </pattern>
  </defs>
  <rect width="800" height="520" fill="url(#bg)"/>
  <rect width="800" height="520" fill="url(#grid)"/>
  <circle cx="650" cy="80" r="260" fill="url(#glow)" opacity=".55"/>
  <circle cx="110" cy="480" r="190" fill="${accent}" opacity=".14"/>
  ${variantShapes(index, accent)}
  <g font-family="'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <text x="56" y="72" fill="#ffffff" fill-opacity=".62" font-size="13" letter-spacing="4.4" font-weight="600">${esc(product.category.toUpperCase())}</text>
    <text x="56" y="126" fill="#ffffff" fill-opacity=".95" font-size="15" letter-spacing="0.4" font-weight="600">CuseSoft Store</text>
    <text x="56" y="438" fill="#ffffff" font-size="96" font-weight="800" letter-spacing="-5">${twoDigits}</text>
    <text x="58" y="476" fill="#ffffff" fill-opacity=".55" font-size="15" letter-spacing="1.2">PRODUCTO DIGITAL</text>
  </g>
  <rect x="0.75" y="0.75" width="798.5" height="518.5" fill="none" stroke="#ffffff" stroke-opacity=".10" rx="2"/>
</svg>
`;
}

products.forEach((product, index) => {
  const target = path.join(coversDir, `${product.id}.svg`);
  fs.writeFileSync(target, coverSvg(product, index), 'utf8');
});

// ---------------------------------------------------------------------------
// Generador de PDFs de muestra (sin dependencias externas)
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

function pdfEscape(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxChars) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function hexToRgb01(hex) {
  const value = hex.replace('#', '');
  const num = Number.parseInt(value, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255]
    .map((channel) => channel.toFixed(3))
    .join(' ');
}

function makePdf(product) {
  const accent = product.accent || '#8b5cf6';
  const accentRgb = hexToRgb01(accent);
  const darkRgb = hexToRgb01(shade(accent, -110));
  const parts = [];
  const text = (font, size, color, x, y, value, extra = '') =>
    parts.push(
      `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm ${extra}(${pdfEscape(value)}) Tj ET`,
    );

  // Fondo y banda superior
  parts.push(`q ${darkRgb} rg 0 ${PAGE_HEIGHT - 150} ${PAGE_WIDTH} 150 re f Q`);
  parts.push(`q ${accentRgb} rg 0 ${PAGE_HEIGHT - 150} 8 150 re f Q`);
  parts.push(`q 1 1 1 rg 0 ${PAGE_HEIGHT - 152} ${PAGE_WIDTH} 2 re f Q`);

  text('F2', 28, '1 1 1', 48, PAGE_HEIGHT - 64, 'CuseSoft');
  text('F1', 11, '1 1 1', 48, PAGE_HEIGHT - 84, 'Productos digitales · Tienda oficial');
  text('F1', 9, '0.85 0.82 1', 48, PAGE_HEIGHT - 112, product.category.toUpperCase());

  let y = PAGE_HEIGHT - 210;
  const titleLines = wrap(product.name, 34);
  for (const line of titleLines) {
    text('F2', 30, '0.11 0.06 0.19', 48, y, line);
    y -= 36;
  }

  y -= 4;
  for (const line of wrap(product.tagline, 74)) {
    text('F1', 13, '0.35 0.32 0.46', 48, y, line);
    y -= 20;
  }

  y -= 18;
  parts.push(`q ${accentRgb} rg 48 ${y} 64 3 re f Q`);
  y -= 34;

  for (const line of wrap(product.description, 88)) {
    text('F1', 11, '0.23 0.20 0.34', 48, y, line);
    y -= 17;
  }

  y -= 22;
  text('F2', 14, '0.11 0.06 0.19', 48, y, 'Contenido incluido');
  y -= 26;

  for (const item of product.includes) {
    parts.push(`q ${accentRgb} rg 50 ${y + 3} 5 5 re f Q`);
    for (const [index, line] of wrap(item, 82).entries()) {
      text('F1', 11, '0.23 0.20 0.34', 64, y - index * 15, line);
    }
    y -= 15 * Math.max(1, wrap(item, 82).length) + 6;
  }

  y -= 10;
  parts.push(`q 0.96 0.94 0.99 rg 48 ${y - 64} ${PAGE_WIDTH - 96} 64 re f Q`);
  parts.push(`q ${accentRgb} rg 48 ${y - 64} 4 64 re f Q`);
  text('F2', 10, '0.30 0.18 0.60', 64, y - 20, 'CÓMO USAR ESTE PRODUCTO');
  text(
    'F1',
    9,
    '0.35 0.32 0.46',
    64,
    y - 38,
    'Mira el video de instrucciones incluido en el correo de compra y descarga el archivo',
  );
  text('F1', 9, '0.35 0.32 0.46', 64, y - 51, 'nuevamente desde "Mis compras" cuando lo necesites.');

  text('F1', 9, '0.55 0.52 0.64', 48, 56, `Pedido digital · ${product.id} · ${new Date().getFullYear()}`);
  text('F1', 9, '0.55 0.52 0.64', 48, 42, 'Documento de muestra generado para la tienda CuseSoft.');
  text('F1', 9, '0.55 0.52 0.64', 48, 28, 'Los enlaces de descarga son personales e intransferibles.');

  return buildPdf(parts.join('\n'), product.name);
}

function buildPdf(content, title) {
  const contentBuffer = Buffer.from(content, 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${contentBuffer.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${pdfEscape(title)}) /Author (CuseSoft Store) /Creator (CuseSoft Store) >>`,
  ];

  const chunks = [];
  let offset = 0;
  const push = (value) => {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'latin1');
    chunks.push(buffer);
    offset += buffer.length;
  };

  push('%PDF-1.4\n');
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(offset);
    push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  push(xref);

  return Buffer.concat(chunks);
}

for (const product of products) {
  const pdf = makePdf(product);
  fs.writeFileSync(path.join(filesDir, product.fileName), pdf);
}

console.log(`Listo: ${products.length} portadas SVG y ${products.length} PDFs de muestra generados.`);
