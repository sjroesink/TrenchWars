import crypto from 'node:crypto';
import { WebSocket } from 'ws';
import type { ClientConnection } from './client-connection';

/**
 * WebSocket adapter implementing ClientConnection.
 * sendUnreliable falls back to ws.send (no unreliable path over TCP).
 */
export class WsConnection implements ClientConnection {
  readonly id: string;
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.id = crypto.randomUUID();
    this.ws = ws;
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  sendReliable(data: string): void {
    if (this.isOpen) {
      this.ws.send(data);
    }
  }

  sendUnreliable(data: Uint8Array): void {
    if (this.isOpen) {
      this.ws.send(data);
    }
  }

  onMessage(handler: (data: string) => void): void {
    this.ws.on('message', (raw) => {
      // Skip binary messages (unreliable fallback over WS) — handled by onDatagram registration
      if (typeof raw === 'string') {
        handler(raw);
      } else if (Buffer.isBuffer(raw)) {
        // Could be JSON string sent as buffer, or binary datagram fallback
        const firstByte = raw[0];
        if (firstByte >= 0x80) {
          // Binary datagram — routed to datagram handler
          return;
        }
        handler(raw.toString('utf-8'));
      }
    });
  }

  onDatagram(handler: (data: Uint8Array) => void): void {
    // For WebSocket, binary messages with high-bit type byte are datagrams
    this.ws.on('message', (raw) => {
      if (Buffer.isBuffer(raw) && raw.length > 0 && raw[0] >= 0x80) {
        handler(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
      }
    });
  }

  onClose(handler: () => void): void {
    this.ws.on('close', handler);
  }

  onError(handler: (err: Error) => void): void {
    this.ws.on('error', handler);
  }

  close(): void {
    this.ws.close();
  }
}
