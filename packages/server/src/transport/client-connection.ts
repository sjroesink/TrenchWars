/**
 * Transport-agnostic connection interface.
 * Both WebSocket and WebTransport adapters implement this,
 * so game logic never touches raw transport APIs.
 */
export interface ClientConnection {
  /** Unique connection ID. */
  readonly id: string;

  /** Whether the connection is currently open and usable. */
  readonly isOpen: boolean;

  /** Send a message reliably (ordered, guaranteed delivery). */
  sendReliable(data: string): void;

  /** Send binary data unreliably (unordered, may be dropped). Falls back to reliable if unavailable. */
  sendUnreliable(data: Uint8Array): void;

  /** Register a handler for incoming reliable (string) messages. */
  onMessage(handler: (data: string) => void): void;

  /** Register a handler for incoming unreliable binary datagrams. */
  onDatagram(handler: (data: Uint8Array) => void): void;

  /** Register a handler for connection close. */
  onClose(handler: () => void): void;

  /** Register a handler for connection errors. */
  onError(handler: (err: Error) => void): void;

  /** Close the connection. */
  close(): void;
}
