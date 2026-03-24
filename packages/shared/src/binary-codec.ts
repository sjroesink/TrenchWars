import type { ShipInput, GameSnapshot } from './types';

/**
 * Binary message types for unreliable datagrams.
 * Range 0x80+ to distinguish from JSON ServerMsg/ClientMsg (0x01-0x0F).
 */
export enum BinaryMsg {
  INPUT = 0x80,
  SNAPSHOT_PLAYERS = 0x81,
  SNAPSHOT_PROJECTILES = 0x82,
  PING = 0x83,
  PONG = 0x84,
}

// ---- UUID helpers ----

const HEX = '0123456789abcdef';

/** Convert UUID string (36 chars) to 16 raw bytes. */
function uuidToBytes(uuid: string, buf: DataView, offset: number): void {
  let bi = 0;
  for (let i = 0; i < uuid.length; i++) {
    const c = uuid.charCodeAt(i);
    if (c === 0x2d) continue; // skip '-'
    const hi = hexVal(c);
    const lo = hexVal(uuid.charCodeAt(++i));
    buf.setUint8(offset + bi++, (hi << 4) | lo);
  }
}

/** Convert 16 raw bytes to UUID string. */
function bytesToUuid(buf: DataView, offset: number): string {
  const chars: string[] = [];
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) chars.push('-');
    const b = buf.getUint8(offset + i);
    chars.push(HEX[b >> 4], HEX[b & 0x0f]);
  }
  return chars.join('');
}

function hexVal(charCode: number): number {
  if (charCode >= 0x30 && charCode <= 0x39) return charCode - 0x30;       // 0-9
  if (charCode >= 0x61 && charCode <= 0x66) return charCode - 0x61 + 10;  // a-f
  if (charCode >= 0x41 && charCode <= 0x46) return charCode - 0x41 + 10;  // A-F
  return 0;
}

// ---- INPUT encoding (client → server) ----
// 10 bytes: [type:1] [seq:4] [tick:4] [flags:1]

export interface BinaryInput {
  seq: number;
  tick: number;
  input: ShipInput;
  fire: boolean;
  fireBomb: boolean;
  multifire: boolean;
}

export function encodeInput(msg: BinaryInput): Uint8Array {
  const buf = new ArrayBuffer(10);
  const view = new DataView(buf);
  view.setUint8(0, BinaryMsg.INPUT);
  view.setUint32(1, msg.seq, true);
  view.setUint32(5, msg.tick, true);

  let flags = 0;
  if (msg.input.left) flags |= 0x01;
  if (msg.input.right) flags |= 0x02;
  if (msg.input.thrust) flags |= 0x04;
  if (msg.input.reverse) flags |= 0x08;
  if (msg.input.afterburner) flags |= 0x10;
  if (msg.input.multifire) flags |= 0x20;
  if (msg.fire) flags |= 0x40;
  if (msg.fireBomb) flags |= 0x80;
  view.setUint8(9, flags);

  return new Uint8Array(buf);
}

export function decodeInput(data: Uint8Array): BinaryInput {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const flags = view.getUint8(9);
  return {
    seq: view.getUint32(1, true),
    tick: view.getUint32(5, true),
    input: {
      left: (flags & 0x01) !== 0,
      right: (flags & 0x02) !== 0,
      thrust: (flags & 0x04) !== 0,
      reverse: (flags & 0x08) !== 0,
      afterburner: (flags & 0x10) !== 0,
      multifire: (flags & 0x20) !== 0,
    },
    fire: (flags & 0x40) !== 0,
    fireBomb: (flags & 0x80) !== 0,
    multifire: (flags & 0x20) !== 0,
  };
}

// ---- SNAPSHOT PLAYERS (server → client) ----
// Header: [type:1] [tick:4] [count:1]
// Per player (48 bytes): [id:16] [x:4] [y:4] [vx:4] [vy:4] [orientation:4]
//   [energy:2] [shipType:1] [flags:1] [kills:2] [deaths:2] [lastProcessedSeq:4]

const PLAYER_BYTES = 48;

export type SnapshotPlayer = GameSnapshot['players'][number];

export function encodeSnapshotPlayers(tick: number, players: SnapshotPlayer[]): Uint8Array {
  const headerSize = 6;
  const buf = new ArrayBuffer(headerSize + players.length * PLAYER_BYTES);
  const view = new DataView(buf);

  view.setUint8(0, BinaryMsg.SNAPSHOT_PLAYERS);
  view.setUint32(1, tick, true);
  view.setUint8(5, players.length);

  let offset = headerSize;
  for (const p of players) {
    uuidToBytes(p.id, view, offset); offset += 16;
    view.setFloat32(offset, p.x, true); offset += 4;
    view.setFloat32(offset, p.y, true); offset += 4;
    view.setFloat32(offset, p.vx, true); offset += 4;
    view.setFloat32(offset, p.vy, true); offset += 4;
    view.setFloat32(offset, p.orientation, true); offset += 4;
    view.setInt16(offset, Math.round(p.energy), true); offset += 2;
    view.setUint8(offset, p.shipType); offset += 1;
    view.setUint8(offset, p.alive ? 1 : 0); offset += 1;
    view.setUint16(offset, p.kills, true); offset += 2;
    view.setUint16(offset, p.deaths, true); offset += 2;
    view.setUint32(offset, p.lastProcessedSeq, true); offset += 4;
  }

  return new Uint8Array(buf);
}

export function decodeSnapshotPlayers(data: Uint8Array): { tick: number; players: SnapshotPlayer[] } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tick = view.getUint32(1, true);
  const count = view.getUint8(5);
  const players: SnapshotPlayer[] = [];

  let offset = 6;
  for (let i = 0; i < count; i++) {
    const id = bytesToUuid(view, offset); offset += 16;
    const x = view.getFloat32(offset, true); offset += 4;
    const y = view.getFloat32(offset, true); offset += 4;
    const vx = view.getFloat32(offset, true); offset += 4;
    const vy = view.getFloat32(offset, true); offset += 4;
    const orientation = view.getFloat32(offset, true); offset += 4;
    const energy = view.getInt16(offset, true); offset += 2;
    const shipType = view.getUint8(offset); offset += 1;
    const alive = view.getUint8(offset) !== 0; offset += 1;
    const kills = view.getUint16(offset, true); offset += 2;
    const deaths = view.getUint16(offset, true); offset += 2;
    const lastProcessedSeq = view.getUint32(offset, true); offset += 4;

    // Name is not included in binary snapshots — client caches from PLAYER_JOIN
    players.push({ id, name: '', x, y, vx, vy, orientation, energy, shipType, alive, kills, deaths, lastProcessedSeq });
  }

  return { tick, players };
}

// ---- SNAPSHOT PROJECTILES (server → client) ----
// Header: [type:1] [tick:4] [count:1]
// Per projectile (38 bytes): [id:4] [type:1] [x:4] [y:4] [vx:4] [vy:4]
//   [ownerId:16] [flags:1]

const PROJECTILE_BYTES = 38;

export type SnapshotProjectile = GameSnapshot['projectiles'][number];

export function encodeSnapshotProjectiles(tick: number, projectiles: SnapshotProjectile[]): Uint8Array {
  const headerSize = 6;
  const buf = new ArrayBuffer(headerSize + projectiles.length * PROJECTILE_BYTES);
  const view = new DataView(buf);

  view.setUint8(0, BinaryMsg.SNAPSHOT_PROJECTILES);
  view.setUint32(1, tick, true);
  view.setUint8(5, projectiles.length);

  let offset = headerSize;
  for (const pr of projectiles) {
    view.setUint32(offset, pr.id, true); offset += 4;
    view.setUint8(offset, pr.type === 'bullet' ? 0 : 1); offset += 1;
    view.setFloat32(offset, pr.x, true); offset += 4;
    view.setFloat32(offset, pr.y, true); offset += 4;
    view.setFloat32(offset, pr.vx, true); offset += 4;
    view.setFloat32(offset, pr.vy, true); offset += 4;
    uuidToBytes(pr.ownerId, view, offset); offset += 16;
    view.setUint8(offset, pr.rear ? 1 : 0); offset += 1;
  }

  return new Uint8Array(buf);
}

export function decodeSnapshotProjectiles(data: Uint8Array): { tick: number; projectiles: SnapshotProjectile[] } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tick = view.getUint32(1, true);
  const count = view.getUint8(5);
  const projectiles: SnapshotProjectile[] = [];

  let offset = 6;
  for (let i = 0; i < count; i++) {
    const id = view.getUint32(offset, true); offset += 4;
    const type = view.getUint8(offset) === 0 ? 'bullet' as const : 'bomb' as const; offset += 1;
    const x = view.getFloat32(offset, true); offset += 4;
    const y = view.getFloat32(offset, true); offset += 4;
    const vx = view.getFloat32(offset, true); offset += 4;
    const vy = view.getFloat32(offset, true); offset += 4;
    const ownerId = bytesToUuid(view, offset); offset += 16;
    const rear = view.getUint8(offset) !== 0; offset += 1;

    projectiles.push({ id, type, x, y, vx, vy, ownerId, rear: rear || undefined });
  }

  return { tick, projectiles };
}

// ---- PING / PONG ----
// PING: [type:1] [clientTime:8] = 9 bytes
// PONG: [type:1] [clientTime:8] [serverTime:8] = 17 bytes

export function encodePing(clientTime: number): Uint8Array {
  const buf = new ArrayBuffer(9);
  const view = new DataView(buf);
  view.setUint8(0, BinaryMsg.PING);
  view.setFloat64(1, clientTime, true);
  return new Uint8Array(buf);
}

export function decodePing(data: Uint8Array): { clientTime: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { clientTime: view.getFloat64(1, true) };
}

export function encodePong(clientTime: number, serverTime: number): Uint8Array {
  const buf = new ArrayBuffer(17);
  const view = new DataView(buf);
  view.setUint8(0, BinaryMsg.PONG);
  view.setFloat64(1, clientTime, true);
  view.setFloat64(9, serverTime, true);
  return new Uint8Array(buf);
}

export function decodePong(data: Uint8Array): { clientTime: number; serverTime: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    clientTime: view.getFloat64(1, true),
    serverTime: view.getFloat64(9, true),
  };
}

/** Maximum datagram payload size (conservative QUIC limit). */
export const MAX_DATAGRAM_SIZE = 1200;

/** Check if binary data fits in a single datagram. */
export function fitsInDatagram(data: Uint8Array): boolean {
  return data.byteLength <= MAX_DATAGRAM_SIZE;
}

/** Read the message type byte from a binary datagram. */
export function readBinaryMsgType(data: Uint8Array): number {
  return data[0];
}
