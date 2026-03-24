import crypto from 'node:crypto';
import type { ClientConnection } from './client-connection';

/**
 * WebTransport session adapter implementing ClientConnection.
 * Uses a single bidi stream for reliable JSON messages and datagrams for binary.
 *
 * The `session` parameter follows the @fails-components/webtransport API:
 * - session.datagrams.readable / writable for unreliable datagrams
 * - session.openBidirectionalStream() for reliable streams
 * - session.incomingBidirectionalStreams for client-initiated streams
 */
export class WtConnection implements ClientConnection {
  readonly id: string;
  private session: any; // WebTransportSession from @fails-components/webtransport
  private reliableWriter: WritableStreamDefaultWriter | null = null;
  private datagramWriter: WritableStreamDefaultWriter | null = null;
  private closed = false;
  private messageHandler: ((data: string) => void) | null = null;
  private datagramHandler: ((data: Uint8Array) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private errorHandler: ((err: Error) => void) | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private _sendCount = 0;

  constructor(session: any) {
    this.id = crypto.randomUUID();
    this.session = session;
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Open a bidi stream for reliable messages (server-initiated)
      const bidiStream = await this.session.openBidirectionalStream();
      this.reliableWriter = bidiStream.writable.getWriter();

      // Acquire persistent datagram writer
      try {
        this.datagramWriter = this.session.datagrams.writable.getWriter();
        console.log(`[WT ${this.id.slice(0,8)}] datagram writer acquired`);
      } catch (err) {
        console.warn(`[WT ${this.id.slice(0,8)}] datagram writer failed:`, err);
      }

      // Read reliable messages from the client via incoming bidi streams
      this.readIncomingStreams();

      // Read datagrams
      this.readDatagrams();

      // Watch for session close
      this.session.closed
        .then(() => {
          this.closed = true;
          this.closeHandler?.();
        })
        .catch((err: Error) => {
          this.closed = true;
          this.errorHandler?.(err);
          this.closeHandler?.();
        });
    } catch (err) {
      this.closed = true;
      this.errorHandler?.(err as Error);
      this.closeHandler?.();
    }
  }

  private async readIncomingStreams(): Promise<void> {
    try {
      const reader = this.session.incomingBidirectionalStreams.getReader();
      while (!this.closed) {
        const { value: stream, done } = await reader.read();
        if (done) break;
        this.readStreamMessages(stream.readable.getReader());
      }
    } catch {
      // Session closed
    }
  }

  private async readStreamMessages(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    let buffer = '';
    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        // Accumulate and split on newline delimiter
        buffer += this.decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!; // Keep incomplete last line in buffer
        for (const line of lines) {
          if (line.length > 0) {
            this.messageHandler?.(line);
          }
        }
      }
      // Process remaining buffer
      if (buffer.length > 0) {
        this.messageHandler?.(buffer);
      }
    } catch {
      // Stream closed
    }
  }

  private async readDatagrams(): Promise<void> {
    try {
      const reader = this.session.datagrams.readable.getReader();
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value instanceof Uint8Array) {
          this.datagramHandler?.(value);
        }
      }
    } catch {
      // Session closed
    }
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  sendReliable(data: string): void {
    if (this.closed || !this.reliableWriter) return;
    // Delimit messages with newline for framing
    const bytes = this.encoder.encode(data + '\n');
    this.reliableWriter.write(bytes).catch(() => {
      // Write failed, connection likely closed
    });
  }

  sendUnreliable(data: Uint8Array): void {
    if (this.closed) return;
    if (this.datagramWriter) {
      this.datagramWriter.write(data).catch((err) => {
        if (this._sendCount++ < 3) console.warn(`[WT] datagram write failed:`, err);
      });
    } else {
      // No datagram support — send as binary over reliable stream
      if (this._sendCount++ < 3) console.warn(`[WT] no datagram writer, falling back to reliable`);
      this.sendReliable(JSON.stringify({ _bin: Array.from(data) }));
    }
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandler = handler;
  }

  onDatagram(handler: (data: Uint8Array) => void): void {
    this.datagramHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  onError(handler: (err: Error) => void): void {
    this.errorHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.session.close();
    } catch {
      // Already closed
    }
  }
}
