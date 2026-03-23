import type { ShipInput } from './types';

// Client -> Server message types
export enum ClientMsg {
  JOIN = 0x01,        // { name: string, shipType: number }
  INPUT = 0x02,       // { seq: number, tick: number, input: ShipInput, fire: boolean, fireBomb: boolean }
  SHIP_SELECT = 0x03, // { shipType: number }
  PING = 0x04,        // { clientTime: number }
  CHAT = 0x05,        // { message: string }
}

// Server -> Client message types
export enum ServerMsg {
  WELCOME = 0x01,       // { playerId: string, tick: number, mapName: string }
  SNAPSHOT = 0x02,      // GameSnapshot
  PLAYER_JOIN = 0x03,   // { playerId: string, name: string, shipType: number }
  PLAYER_LEAVE = 0x04,  // { playerId: string }
  DEATH = 0x05,         // { killerId: string, killedId: string, weaponType: 'bullet' | 'bomb' }
  SPAWN = 0x06,         // { playerId: string, x: number, y: number }
  PONG = 0x07,          // { clientTime: number, serverTime: number }
  CHAT = 0x08,          // { playerId: string, name: string, message: string }
  GAME_STATE = 0x09,    // GameModeState (mode type, scores, round, phase)
  SCORE_UPDATE = 0x0A,  // { state: GameModeState }
  TEAM_ASSIGN = 0x0B,   // { playerId: string, team: number }
}

export interface NetworkMessage {
  type: ClientMsg | ServerMsg;
  [key: string]: unknown;
}
