import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const outDir = path.join(distDir, 'cusesoft-portable');
const isWin = process.platform === 'win32';
const arch = process.arch;
const zipName = `cusesoft-portable-${isWin ? 'win' : process.platform}-${arch}.zip`;
const zipPath = path.join(distDir, zipName);

const excludedServerData = new Set([
  path.normalize('server/data/db.json'),
  path.normalize('server/data/outbox'),
  path.normalize('server/data/.session-secret'),
]);

function copyFiltered(src, dest) {
  const rel = path.relative(root, src);
  if (excludedServerData.has(path.normalize(rel))) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyFiltered(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('[CuseSoft] Preparando paquete portable...');
fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1. Copiar binario portable de Node.js
const runtimeNodeDest = isWin
  ? path.join(outDir, 'runtime', 'node.exe')
  : path.join(outDir, 'runtime', 'bin', 'node');
fs.mkdirSync(path.dirname(runtimeNodeDest), { recursive: true });
fs.copyFileSync(process.execPath, runtimeNodeDest);
if (!isWin) fs.chmodSync(runtimeNodeDest, 0o755);

// 2. Copiar código fuente, dependencias y lanzadores
const itemsToCopy = [
  'node_modules',
  'server',
  'public',
  'scripts',
  'package.json',
  'package-lock.json',
  '.env.example',
  'README.md',
  'iniciar.bat',
  'iniciar-dev.bat',
  'iniciar.sh',
  'Dockerfile',
  'docker-compose.yml',
  '.dockerignore',
];

for (const item of itemsToCopy) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) {
    copyFiltered(src, path.join(outDir, item));
  }
}

// 3. Generar assets iniciales dentro del paquete portable usando el Node incluido
console.log('[CuseSoft] Generando portadas y PDF de ejemplo en el paquete...');
execFileSync(runtimeNodeDest, [path.join(outDir, 'scripts', 'make-assets.mjs')], {
  cwd: outDir,
  stdio: 'inherit',
});

// 4. Comprimir a ZIP
console.log(`[CuseSoft] Comprimiendo a ${zipName}...`);
if (isWin) {
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${outDir}', '${zipPath}', [System.IO.Compression.CompressionLevel]::Optimal, $false)`,
    ],
    { stdio: 'inherit' },
  );
} else {
  execFileSync('zip', ['-rq', zipPath, '.'], { cwd: outDir, stdio: 'inherit' });
}

const zipSizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
console.log('');
console.log('[CuseSoft] Paquete portable listo:');
console.log(`  ▸ Carpeta: ${outDir}`);
console.log(`  ▸ ZIP:     ${zipPath} (${zipSizeMb} MB)`);
console.log('  ▸ Uso:     Descomprime el ZIP en cualquier PC y ejecuta iniciar.bat (o iniciar-dev.bat para editar).');
console.log('');
