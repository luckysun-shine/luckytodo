import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = process.env.LUCKYTODO_WEB || path.resolve(__dirname, '../../../web');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function tryServeStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel.includes('..')) return false;
  const abs = path.join(WEB_ROOT, rel);
  if (!abs.startsWith(WEB_ROOT)) return false;
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return false;
  const data = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  res.writeHead(200, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  if (req.method !== 'HEAD') res.end(data);
  else res.end();
  return true;
}
