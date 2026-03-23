import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { GameServer } from './game-server';
import { generateTestArena } from '@trench-wars/shared';

const PORT = parseInt(process.env.PORT || '9020', 10);
const STATIC_DIR = process.env.STATIC_DIR || join(process.cwd(), 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

// HTTP server for static files
const httpServer = createServer((req, res) => {
  const url = req.url?.split('?')[0] || '/';
  let filePath = join(STATIC_DIR, url === '/' ? 'index.html' : url);

  // Try to serve file, fall back to index.html for SPA routing
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(STATIC_DIR, 'index.html');
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end('Server error');
  }
});

// Game server with WebSocket attached to the HTTP server
const map = generateTestArena(200, 200);
const server = new GameServer({ map, port: PORT, httpServer });
server.start();

console.log(`TrenchWars running on http://localhost:${PORT}`);
console.log(`WebSocket on ws://localhost:${PORT}`);
console.log(`Serving static files from ${STATIC_DIR}`);
