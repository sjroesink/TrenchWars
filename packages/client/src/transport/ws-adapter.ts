import type { TransportAdapter } from './transport-adapter';

/**
 * Browser WebSocket adapter implementing TransportAdapter.
 * sendUnreliable falls back to ws.send (no unreliable path over TCP).
 */
export class WsAdapter implements TransportAdapter {
  private ws: WebSocket | null = null;
  private messageHandler: ((data: string) => void) | null = null;
  private datagramHandler: ((data: Uint8Array) => void) | null = null;
  private closeHandler: (() => void) | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const bytes = new Uint8Array(event.data);
          if (bytes.length > 0 && bytes[0] >= 0x80) {
            // Binary datagram (high-bit type byte)
            this.datagramHandler?.(bytes);
          } else {
            // Binary-encoded string (fallback path)
            const text = new TextDecoder().decode(bytes);
            this.messageHandler?.(text);
          }
        } else if (typeof event.data === 'string') {
          this.messageHandler?.(event.data);
        }
      };

      this.ws.onclose = () => {
        this.closeHandler?.();
      };
    });
  }

  sendReliable(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  sendUnreliable(data: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
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

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
