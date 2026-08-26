#!/usr/bin/env node
/**
 * Servidor estático mínimo para el build docente-local.
 * No depende de herramientas ni dependencias de desarrollo.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configuredDist = String(process.env.DOCENTE_WEB_DIST || '').trim();
const publicRoot = configuredDist === 'apps/frontend/dist-e2e-docente'
  ? path.resolve(root, 'apps', 'frontend', 'dist-e2e-docente')
  : path.resolve(root, 'apps', 'frontend', 'dist-docente');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PUERTO_WEB || 4173);
const mimeTypes = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
});

function buildAssetIndex(rootDir) {
  const index = new Map();
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        const relative = path.relative(rootDir, absolute).split(path.sep).join('/');
        index.set(`/${relative}`, absolute);
      }
    }
  };
  if (fs.existsSync(rootDir)) walk(rootDir);
  return index;
}

const assetIndex = buildAssetIndex(publicRoot);
const fallback = assetIndex.get('/index.html') || null;

function safePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^[/\\]+/, '');
  if (relative.includes('..') || relative.includes('\0')) return null;

  if (relative) {
    const absolutePath = path.resolve(publicRoot, relative);
    if (absolutePath.startsWith(publicRoot) && fs.existsSync(absolutePath)) {
      try {
        const stat = fs.statSync(absolutePath);
        if (stat.isFile()) return absolutePath;
      } catch {
        // fallback
      }
    }
  }

  const fallbackPath = path.resolve(publicRoot, 'index.html');
  if (fs.existsSync(fallbackPath)) return fallbackPath;
  return null;
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff'
  });
  // lgtm[js/path-injection] filePath solo proviene de safePath, que aplica
  // decode controlado y containment bajo publicRoot antes de llegar aquí.
  fs.createReadStream(filePath).on('error', () => response.destroy()).pipe(response);
}

const server = http.createServer((request, response) => {
  // Proxy reverso transparente para rutas /api hacia el backend nativo
  if (request.url?.startsWith('/api/')) {
    const apiPort = Number(process.env.PUERTO_API || 4000);
    const proxyReq = http.request(
      {
        host: '127.0.0.1',
        port: apiPort,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, host: `127.0.0.1:${apiPort}` }
      },
      (proxyRes) => {
        response.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(response);
      }
    );
    proxyReq.on('error', (err) => {
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Backend API no disponible', detalle: String(err?.message || err) }));
    });
    request.pipe(proxyReq);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const requested = safePath(request.url || '/');
  if (!requested) {
    response.writeHead(400);
    response.end('Solicitud inválida');
    return;
  }
  const candidate = requested;
  if (!candidate) {
    response.writeHead(503);
    response.end('Build docente no disponible');
    return;
  }
  if (request.method === 'HEAD') {
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(candidate).toLowerCase()] || 'application/octet-stream' });
    response.end();
    return;
  }
  sendFile(response, candidate);
});

server.listen(port, host, () => {
  process.stdout.write(`[docente-static] listo en http://${host}:${port}\n`);
});

function stop() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
