import { GameServer } from './game-server';
import { generateTestArena } from '@trench-wars/shared';

const map = generateTestArena(200, 200);
const server = new GameServer({ map, port: 3001 });
server.start();
console.log('TrenchWars server running on ws://localhost:3001');
