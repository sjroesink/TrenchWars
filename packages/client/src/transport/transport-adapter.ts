/**
 * Browser-side transport interface.
 * Both WebSocket and WebTransport adapters implement this.
 */
export interface TransportAdapter {
  /** Connect to the server. */
  connect(url: string): Promise<void>;

  /** Send a message reliably (ordered, guaranteed delivery). */
  sendReliable(data: string): void;

  /** Send binary data unreliably (may be dropped). Falls back to reliable if unavailable. */
  sendUnreliable(data: Uint8Array): void;

  /** Register a handler for incoming reliable (string) messages. */
  onMessage(handler: (data: string) => void): void;

  /** Register a handler for incoming unreliable binary datagrams. */
  onDatagram(handler: (data: Uint8Array) => void): void;

  /** Register a handler for connection close. */
  onClose(handler: () => void): void;

  /** Whether the connection is currently open. */
  readonly isOpen: boolean;

  /** Close the connection. */
  close(): void;
}
