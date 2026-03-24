import type { TransportAdapter } from './transport-adapter';

/**
 * Browser WebTransport adapter implementing TransportAdapter.
 * Uses a bidi stream for reliable messages and datagrams for binary.
 */
export class WtAdapter implements TransportAdapter {
  private transport: WebTransport | null = null;
  private reliableWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private closed = false;
  private messageHandler: ((data: string) => void) | null = null;
  private datagramHandler: ((data: Uint8Array) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  async connect(url: string): Promise<void> {
    this.transport = new WebTransport(url);
    await this.transport.ready;

    // Watch for close
    this.transport.closed.then(() => {
      this.closed = true;
      this.closeHandler?.();
    }).catch(() => {
      this.closed = true;
      this.closeHandler?.();
    });

    // Read incoming bidi streams (server-initiated reliable channel)
    this.readIncomingStreams();

    // Read datagrams
    this.readDatagrams();
  }

  private async readIncomingStreams(): Promise<void> {
    if (!this.transport) return;
    try {
      const reader = this.transport.incomingBidirectionalStreams.getReader();
      while (!this.closed) {
        const { value: stream, done } = await reader.read();
        if (done) break;
        this.readStreamMessages(stream.readable.getReader());
      }
    } catch {
      // Transport closed
    }
  }

  private async readStreamMessages(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    let buffer = '';
    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += this.decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          if (line.length > 0) {
            this.messageHandler?.(line);
          }
        }
      }
      if (buffer.length > 0) {
        this.messageHandler?.(buffer);
      }
    } catch {
      // Stream closed
    }
  }

  private async readDatagrams(): Promise<void> {
    if (!this.transport) return;
    try {
      const reader = this.transport.datagrams.readable.getReader();
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value instanceof Uint8Array) {
          this.datagramHandler?.(value);
        }
      }
    } catch {
      // Transport closed
    }
  }

  sendReliable(data: string): void {
    if (this.closed) return;

    // If we don't have a reliable writer yet, open a bidi stream
    if (!this.reliableWriter) {
      this.openReliableStream().then(() => {
        this.doSendReliable(data);
      });
      return;
    }
    this.doSendReliable(data);
  }

  private async openReliableStream(): Promise<void> {
    if (!this.transport || this.reliableWriter) return;
    const stream = await this.transport.createBidirectionalStream();
    this.reliableWriter = stream.writable.getWriter();
    // Read from readable side (server responses on this stream)
    this.readStreamMessages(stream.readable.getReader());
  }

  private doSendReliable(data: string): void {
    if (!this.reliableWriter) return;
    const bytes = this.encoder.encode(data + '\n');
    this.reliableWriter.write(bytes).catch(() => {});
  }

  sendUnreliable(data: Uint8Array): void {
    if (this.closed || !this.transport) return;
    const writer = this.transport.datagrams.writable.getWriter();
    writer.write(data).catch(() => {}).finally(() => writer.releaseLock());
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

  get isOpen(): boolean {
    return !this.closed && this.transport !== null;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.transport?.close();
    } catch {
      // Already closed
    }
    this.transport = null;
  }
}
