#!/usr/bin/env node
/**
 * Servidor local simples para abrir o Gerador de Licença em "localhost".
 * (WebCrypto exige contexto seguro; localhost é considerado seguro.)
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = __dirname;
const port = Number(process.env.PORT || 8787);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function safePath(p) {
  const clean = p.replace(/\0/g, '').replace(/\.\.(\/|\\)/g, '');
  return clean;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://localhost');
  let pathname = safePath(u.pathname);
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const filePath = path.join(root, pathname);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`\n✅ Gerador de Licença rodando em: http://localhost:${port}`);
  console.log('   (Abra este link no navegador)\n');
});
