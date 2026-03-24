import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';
import { GameServer } from './game-server';
import { WtConnection } from './transport/wt-connection';
import { generateTestArena } from '@trench-wars/shared';

const PORT = parseInt(process.env.PORT || '9020', 10);
const TLS_CERT = process.env.TLS_CERT || '';
const TLS_KEY = process.env.TLS_KEY || '';
const STATIC_DIR = process.env.STATIC_DIR || join(process.cwd(), 'public');

// Version from git commit count
let APP_VERSION = 'dev';
try {
  const count = execSync('git rev-list --count HEAD').toString().trim();
  APP_VERSION = `0.${count}.0`;
} catch { /* git not available in production — use env */ }
APP_VERSION = process.env.APP_VERSION || APP_VERSION;

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

// Check if TLS is configured
const hasTls = TLS_CERT && TLS_KEY && existsSync(TLS_CERT) && existsSync(TLS_KEY);
const cert = hasTls ? readFileSync(TLS_CERT, 'utf-8') : '';
const key = hasTls ? readFileSync(TLS_KEY, 'utf-8') : '';

// Request handler for static files
const handleRequest = (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
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
};

// Create HTTPS server if TLS configured, otherwise HTTP
const httpServer = hasTls
  ? createHttpsServer({ key, cert }, handleRequest)
  : createHttpServer(handleRequest);

// Game server with WebSocket attached
const map = generateTestArena(200, 200);
const server = new GameServer({ map, port: PORT, httpServer });
server.start();

const proto = hasTls ? 'https' : 'http';
console.log(`TrenchWars v${APP_VERSION}`);
console.log(`  ${proto.toUpperCase()} + WebSocket on ${proto}://localhost:${PORT}`);
console.log(`  Static files from ${STATIC_DIR}`);

// Start HTTP/3 WebTransport server on the SAME port if TLS is configured
// (HTTP/3 uses UDP, HTTPS uses TCP — they coexist on the same port)
if (hasTls) {
  (async () => {
    try {
      // @ts-ignore — optional dependency, handled by try/catch
      const { Http3Server } = await import('@fails-components/webtransport');

      const h3Server = new Http3Server({
        port: PORT,
        host: '0.0.0.0',
        secret: 'trenchwars-' + Date.now(),
        cert,
        privKey: key,
      });

      h3Server.startServer();

      // Accept WebTransport sessions on /game path
      const sessionStream = h3Server.sessionStream('/game');
      console.log(`  WebTransport on https://127.0.0.1:${PORT}/game (same port, UDP)`);

      // Compute SPKI hash for Chrome launch flags
      const spkiHash = execSync(
        `openssl x509 -pubkey -noout -in "${TLS_CERT}" | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`,
      ).toString().trim();
      console.log('');
      console.log('  Launch Chrome with:');
      console.log(`    chrome --ignore-certificate-errors-spki-list=${spkiHash} --origin-to-force-quic-on=127.0.0.1:${PORT} https://127.0.0.1:${PORT}`);

      // Handle incoming sessions
      (async () => {
        const reader = sessionStream.getReader();
        while (true) {
          const { value: session, done } = await reader.read();
          if (done) break;
          console.log('  [WT] new session');
          server.handleConnection(new WtConnection(session));
        }
      })();
    } catch (err) {
      console.warn('  WebTransport unavailable:', (err as Error).message);
    }
  })();
}
