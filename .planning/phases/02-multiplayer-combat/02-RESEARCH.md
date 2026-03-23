# Phase 2: Multiplayer Combat - Research

**Researched:** 2026-03-23
**Domain:** WebSocket networking, authoritative game server, client-side prediction, weapon systems, hit detection, entity interpolation
**Confidence:** HIGH

## Summary

Phase 2 transforms the single-player physics sandbox from Phase 1 into a real-time multiplayer combat game. This is the largest and most complex phase, touching every layer: a new server package with authoritative game simulation, WebSocket networking with binary protocols, client-side prediction and server reconciliation using the existing shared physics, entity interpolation for smooth remote players, a complete weapon system (bullets and bombs), death/respawn, and three distinct ship types with different weapon loadouts.

The critical architectural insight is that Phase 1 already built the physics as pure functions in `packages/shared/` -- this is exactly the pattern needed for authoritative networking. The server runs the same `updateShipPhysics` and `applyWallCollision` functions as the client, ensuring deterministic simulation. Client-side prediction works by replaying unacknowledged inputs against server-confirmed state using these same functions.

The weapon system follows SubSpace conventions extracted from the nullspace source code: bullets are projectiles that travel at BulletSpeed in the ship's facing direction, consuming energy and respecting fire delay cooldowns. Bombs bounce off walls (BombBounceCount times), deal area damage that decreases with distance from center, and apply thrust recoil to the firing ship. Damage is calculated server-side with the server as the single source of truth for hits.

**Primary recommendation:** Use raw `ws` (WebSocket library) with a custom binary protocol built on ArrayBuffer/DataView. No framework (Colyseus adds unnecessary abstraction for this game's needs). The server runs a 100Hz fixed-timestep loop identical to the client, processing inputs in order and broadcasting state snapshots at ~20Hz.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NETW-01 | Authoritative server validates all game state | Server runs shared physics, validates positions/hits/damage. Client inputs are commands, not state. |
| NETW-02 | Client-side prediction provides responsive local controls | Client applies inputs locally using shared physics immediately, stores input buffer with sequence numbers. |
| NETW-03 | Server reconciliation corrects client predictions | On server snapshot, client rewinds to server state, replays buffered inputs since last acknowledged sequence. |
| NETW-04 | Entity interpolation renders remote players smoothly | Buffer 2+ snapshots, render remote entities at (current_time - interpolation_delay) between snapshots. |
| NETW-05 | Player can reconnect after disconnect | Server preserves player slot for timeout period, client reconnects with session token, receives full state sync. |
| CMBT-01 | Player fires bullets with spacebar in facing direction | Bullet created with velocity = ship_velocity + heading * BulletSpeed. Energy cost = BulletFireEnergy * (level+1). |
| CMBT-02 | Bullets have travel time and speed (not hitscan) | Bullets are entities simulated at 100Hz. Speed conversion: BulletSpeed / 10 / 16 tiles/s. Alive for BulletAliveTime ticks. |
| CMBT-03 | Bullets damage other players on hit and are destroyed | Server AABB overlap check: bullet position vs player position +/- radius. Damage = BulletDamageLevel/1000 + BulletDamageUpgrade/1000 * level. |
| CMBT-04 | Bombs bounce off walls | Bomb wall collision identical to ship: axis-separated, velocity reversal. BombBounceCount decrements per bounce. Explodes when bounces=0. |
| CMBT-05 | Bombs deal area damage on player impact or timeout | Area damage formula: damage = (explode_pixels - distance) * (BombDamageLevel/1000 / explode_pixels). Radius scales with level. |
| CMBT-06 | Player dies when health reaches zero | Energy IS health in SubSpace. When energy <= 0, player dies. Server broadcasts death event. |
| CMBT-07 | Kill and death counts tracked per player | Server maintains wins/losses per player. Broadcast on death event. |
| CMBT-08 | Respawn at random safe location | Server picks random position, checks wall collision in 100 attempts. Apply EnterDelay before player is active. |
| CMBT-09 | Server performs lag-compensated hit detection | Server stores position history buffer. On weapon fire, rewind to shooter's timestamp, simulate projectile against historical positions. |
| SHIP-01 | Warbird: fast, agile fighter with standard bullets | Fast rotation (210), high speed, standard BulletFireDelay, lower BombBounceCount. Emphasis on gun combat. |
| SHIP-02 | Javelin: slower, powerful bombs, higher damage | Slower rotation (200), higher BombBounceCount, possibly higher bomb level. Emphasis on bomb combat. |
| SHIP-03 | Spider: medium speed, bombs for v1 | Same rotation as Javelin, higher recharge (500 vs 400). Balanced between guns and bombs. |
| SHIP-04 | Each ship has distinct stats | Already implemented in shared/ships.ts. Phase 2 adds weapon stats (fire delays, energy costs, bomb bounce counts) per ship. |
| SHIP-05 | Player can select ship type before entering arena | Server accepts ship selection message. Client sends ship type choice. Minimal UI (dropdown or number keys 1-3). |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ws | 8.20.0 | WebSocket server for Node.js | Fastest pure WebSocket implementation. No abstraction overhead. Battle-tested. RFC 6455 compliant. |
| @types/ws | 8.18.1 | TypeScript definitions for ws | Full type coverage for ws API. |
| @trench-wars/shared | workspace | Shared physics, types, constants | Already exists. Server reuses exact same physics code as client. Critical for deterministic simulation. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @msgpack/msgpack | 3.1.3 | Binary message serialization | For position snapshot encoding. ~40% smaller than JSON for numeric data. Optional -- can start with JSON and optimize later. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ws | Colyseus 0.17 | Colyseus adds room management, state sync, schema serialization. Overhead for a custom game loop. Would fight our 100Hz physics. Use ws for full control. |
| ws | socket.io | socket.io adds HTTP fallback, auto-reconnect, rooms. Heavier. We need raw WebSocket performance for game state, not chat features. |
| Custom binary protocol | Colyseus Schema | Colyseus schema is tied to Colyseus rooms. Our protocol is simpler: position snapshots + input commands. Custom is smaller and faster. |
| @msgpack/msgpack | JSON.stringify | JSON is fine for development. Binary protocol is an optimization for later if bandwidth is a concern. Start with JSON. |

**Installation:**
```bash
# Server package (new)
npm init -y -w packages/server
npm install ws -w packages/server
npm install -D @types/ws typescript@^5.9 -w packages/server

# Client needs WebSocket (browser-native, no package needed)
# Shared package already exists
```

**Version verification:**
| Package | Registry Version | Verified Date |
|---------|-----------------|---------------|
| ws | 8.20.0 | 2026-03-23 |
| @types/ws | 8.18.1 | 2026-03-23 |
| @msgpack/msgpack | 3.1.3 | 2026-03-23 |

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)
```
packages/
  server/                   # NEW: Authoritative game server
    src/
      main.ts               # Entry: create HTTP server, attach WebSocket, start game loop
      game-server.ts         # Server game loop (100Hz), processes inputs, broadcasts state
      client-connection.ts   # Per-player WebSocket connection handler
      weapon-manager.ts      # Bullet/bomb creation, simulation, hit detection
      player-manager.ts      # Player state, spawn, death, reconnect
      protocol.ts            # Message types, encode/decode (shared with client)
      lag-compensation.ts    # Position history buffer, rewind for hit detection
    tsconfig.json
    package.json

  shared/                   # EXTENDED: Add weapon types, combat constants
    src/
      types.ts              # Add: WeaponState, ProjectileState, PlayerState (full), GameSnapshot
      constants.ts          # Add: weapon constants, fire delays, damage values
      ships.ts              # Add: weapon stats per ship (fire delay, energy cost, bomb bounces)
      weapons.ts            # NEW: Bullet/bomb simulation (pure functions, like physics.ts)
      protocol.ts           # NEW: Message type enums, encode/decode helpers

  client/                   # MODIFIED: Add networking, weapon rendering, remote players
    src/
      main.ts               # Modified: connect to server instead of local-only
      game-loop.ts           # Modified: client prediction loop with server reconciliation
      network.ts             # NEW: WebSocket client, send inputs, receive snapshots
      prediction.ts          # NEW: Input buffer, reconciliation logic
      interpolation.ts       # NEW: Entity interpolation for remote players
      weapon-renderer.ts     # NEW: Render bullets, bombs, explosions
      remote-player.ts       # NEW: Render other players with interpolation
```

### Pattern 1: Authoritative Server with Client Prediction

**What:** Server is the single source of truth. Clients send inputs (not positions). Server simulates physics, validates everything, broadcasts authoritative state. Clients predict locally for responsiveness.

**When to use:** Always. This is the core networking architecture.

**Implementation:**

```typescript
// Server game loop (100Hz)
function serverTick(): void {
  const now = Date.now();

  for (const player of players) {
    // Process queued inputs in order
    while (player.inputQueue.length > 0) {
      const input = player.inputQueue.shift()!;
      updateShipPhysics(player.state, input.data, player.config, TICK_DT);
      applyWallCollision(player.state, TICK_DT, map, player.config.radius, BOUNCE_FACTOR);
      player.lastProcessedSeq = input.seq;
    }
  }

  // Simulate weapons
  weaponManager.update(TICK_DT);

  // Broadcast state snapshot at lower rate (~20Hz)
  if (tickCount % 5 === 0) {
    broadcastSnapshot();
  }
  tickCount++;
}
```

```typescript
// Client prediction + reconciliation
function onServerSnapshot(snapshot: GameSnapshot): void {
  // 1. Set local state to server's authoritative state
  localState = snapshot.players[myId].state;
  lastAckedSeq = snapshot.players[myId].lastProcessedSeq;

  // 2. Discard acknowledged inputs
  inputBuffer = inputBuffer.filter(i => i.seq > lastAckedSeq);

  // 3. Replay unacknowledged inputs
  for (const input of inputBuffer) {
    updateShipPhysics(localState, input.data, myConfig, TICK_DT);
    applyWallCollision(localState, TICK_DT, map, myConfig.radius, BOUNCE_FACTOR);
  }
}
```

### Pattern 2: Entity Interpolation for Remote Players

**What:** Remote players are rendered slightly in the past, interpolating between two known server snapshots. This avoids jitter from network variance and extrapolation errors.

**When to use:** For rendering ALL entities except the local player.

**Implementation:**

```typescript
// Buffer incoming snapshots with timestamps
const snapshotBuffer: { time: number; snapshot: GameSnapshot }[] = [];
const INTERPOLATION_DELAY = 100; // ms (one server update interval)

function getInterpolatedState(playerId: string): ShipState {
  const renderTime = Date.now() - INTERPOLATION_DELAY;

  // Find surrounding snapshots
  let prev = snapshotBuffer[0];
  let next = snapshotBuffer[1];
  for (let i = 1; i < snapshotBuffer.length; i++) {
    if (snapshotBuffer[i].time >= renderTime) {
      prev = snapshotBuffer[i - 1];
      next = snapshotBuffer[i];
      break;
    }
  }

  const alpha = (renderTime - prev.time) / (next.time - prev.time);
  const p = prev.snapshot.players[playerId].state;
  const n = next.snapshot.players[playerId].state;

  return {
    x: lerp(p.x, n.x, alpha),
    y: lerp(p.y, n.y, alpha),
    vx: lerp(p.vx, n.vx, alpha),
    vy: lerp(p.vy, n.vy, alpha),
    orientation: lerpAngle(p.orientation, n.orientation, alpha),
    energy: lerp(p.energy, n.energy, alpha),
  };
}
```

### Pattern 3: Weapon Simulation as Shared Pure Functions

**What:** Bullet and bomb physics run on both server and client, just like ship physics. Server is authoritative for hit detection. Client predicts local weapon visuals.

**When to use:** For all weapon simulation code.

```typescript
// packages/shared/src/weapons.ts
export interface ProjectileState {
  id: number;
  ownerId: string;
  type: 'bullet' | 'bomb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  level: number;
  bouncesRemaining: number;
  endTick: number;
}

export function createBullet(
  owner: ShipState, config: ShipConfig, weaponConfig: WeaponConfig, id: number, tick: number,
): ProjectileState {
  const angle = owner.orientation * Math.PI * 2;
  const speed = weaponConfig.bulletSpeed / 10 / 16; // SVS conversion
  return {
    id, ownerId: owner.id, type: 'bullet',
    x: owner.x, y: owner.y,
    vx: owner.vx + Math.cos(angle) * speed,
    vy: owner.vy + Math.sin(angle) * speed,
    level: 0,
    bouncesRemaining: 0, // standard bullets don't bounce
    endTick: tick + weaponConfig.bulletAliveTime,
  };
}

export function createBomb(
  owner: ShipState, config: ShipConfig, weaponConfig: WeaponConfig, id: number, tick: number,
): ProjectileState {
  const angle = owner.orientation * Math.PI * 2;
  const speed = weaponConfig.bombSpeed / 10 / 16;
  return {
    id, ownerId: owner.id, type: 'bomb',
    x: owner.x, y: owner.y,
    vx: owner.vx + Math.cos(angle) * speed,
    vy: owner.vy + Math.sin(angle) * speed,
    level: 0,
    bouncesRemaining: weaponConfig.bombBounceCount,
    endTick: tick + weaponConfig.bombAliveTime,
  };
}

export function updateProjectile(
  proj: ProjectileState, map: TileMap, dt: number,
): 'active' | 'wall_explode' | 'timed_out' {
  // Move X axis
  const prevX = proj.x;
  proj.x += proj.vx * dt;
  if (isCollidingWithWalls(proj.x, proj.y, 0.1, map)) {
    proj.x = prevX;
    proj.vx = -proj.vx;
    if (proj.type === 'bomb') {
      proj.bouncesRemaining--;
      if (proj.bouncesRemaining <= 0) return 'wall_explode';
    } else {
      return 'wall_explode'; // bullets die on wall hit (non-bouncing)
    }
  }

  // Move Y axis
  const prevY = proj.y;
  proj.y += proj.vy * dt;
  if (isCollidingWithWalls(proj.x, proj.y, 0.1, map)) {
    proj.y = prevY;
    proj.vy = -proj.vy;
    if (proj.type === 'bomb') {
      proj.bouncesRemaining--;
      if (proj.bouncesRemaining <= 0) return 'wall_explode';
    } else {
      return 'wall_explode';
    }
  }

  return 'active';
}
```

### Anti-Patterns to Avoid

- **Sending positions from client to server:** The client sends INPUTS only. Server computes positions. Sending positions enables speed hacks and teleport cheats.
- **Running physics at different rates on client vs server:** Both MUST use 100Hz with TICK_DT = 0.01. Any divergence causes constant reconciliation jitter.
- **Broadcasting full state every tick:** 100Hz state broadcast would saturate bandwidth. Broadcast at 20Hz (every 5 ticks). Client interpolates between snapshots.
- **Synchronizing with wall clock time:** Use tick-based timing, not Date.now(). Server ticks are the single time source. Prevents clock drift issues.
- **Interpolating the local player:** Only interpolate REMOTE entities. The local player uses client-side prediction for instant responsiveness.

## SubSpace Weapon Mechanics Deep Dive

### Weapon Settings per Ship (from nullspace ArenaSettings.h + ShipController.cpp)

Per-ship weapon settings (from ShipSettings struct):

| Setting | Unit | Description | SVS Conversion |
|---------|------|-------------|----------------|
| BulletSpeed | pixels/s/10 | Bullet travel speed | `value / 10 / 16` = tiles/s |
| BombSpeed | pixels/s/10 | Bomb travel speed | `value / 10 / 16` = tiles/s |
| BulletFireDelay | ticks (100Hz) | Cooldown between bullet fires | `value / 100` = seconds |
| BombFireDelay | ticks (100Hz) | Cooldown between bomb fires | `value / 100` = seconds |
| BulletFireEnergy | energy | Energy cost for L1 bullet | Direct. Cost = BulletFireEnergy * (level+1) |
| BombFireEnergy | energy | Energy cost for bomb | Direct |
| BombBounceCount | count | Wall bounces before explosion | Direct |
| MultiFireAngle | angle units | Spread angle for multifire | `value / 111` = radians |
| BombThrust | thrust units | Recoil thrust when firing bomb | `value / 100 * 10 / 16` = tiles/s |

Arena-wide weapon settings (from ArenaSettings struct):

| Setting | Unit | Description |
|---------|------|-------------|
| BulletDamageLevel | damage*1000 | Max damage for L1 bullet |
| BombDamageLevel | damage*1000 | Damage at bomb center |
| BulletDamageUpgrade | damage*1000 | Per-level damage increase |
| BulletAliveTime | ticks (100Hz) | How long bullets live |
| BombAliveTime | ticks (100Hz) | How long bombs live |
| BombExplodePixels | pixels | L1 blast radius (L2=2x, L3=3x) |
| ProximityDistance | tiles | Proximity bomb trigger radius |
| ShrapnelSpeed | pixels/s/10 | Shrapnel travel speed |
| ShrapnelDamagePercent | 0.1% | Shrapnel damage relative to bullets |
| ExactDamage | boolean | Whether damage is random or fixed |

### Recommended Default Values for TrenchWars v1

These are based on SVS defaults from SERVER.CFG and nullspace source code. Since we cannot access the exact TW zone settings, we use standard SVS defaults that are known to produce good gameplay:

**Per-Ship Weapon Settings:**

| Setting | Warbird | Javelin | Spider |
|---------|---------|---------|--------|
| BulletSpeed | 2000 | 2000 | 2000 |
| BombSpeed | 2000 | 2000 | 2000 |
| BulletFireDelay | 25 | 30 | 20 |
| BombFireDelay | 50 | 40 | 50 |
| BulletFireEnergy | 80 | 100 | 60 |
| BombFireEnergy | 300 | 250 | 300 |
| BombBounceCount | 0 | 3 | 2 |
| MultiFireAngle | 0 | 0 | 0 |
| BombThrust | 36 | 36 | 36 |
| InitialBombs | 0 | 1 | 1 |
| MaxBombs | 2 | 3 | 2 |

**Arena-Wide Weapon Settings:**

| Setting | Default Value | Converted |
|---------|---------------|-----------|
| BulletDamageLevel | 200000 | 200 damage for L1 bullet |
| BombDamageLevel | 550000 | 550 damage at center |
| BulletDamageUpgrade | 100000 | +100 damage per level |
| BulletAliveTime | 550 | 5.5 seconds |
| BombAliveTime | 700 | 7.0 seconds |
| BombExplodePixels | 80 | 5 tiles blast radius |
| ExactDamage | 1 | Fixed damage (no randomness) |
| ShrapnelSpeed | 2000 | Same as bullet speed |
| ShrapnelDamagePercent | 700 | 70% of bullet damage |

**Confidence:** MEDIUM -- BulletSpeed and BombSpeed of 2000 per ship are verified from Phase 1 research (already in ships.ts). Fire delays and energy costs are estimated from SVS defaults and nullspace code patterns. Exact TW zone values differ but these defaults produce balanced gameplay. Can be tuned via config.

### Damage Calculation Formulas (from nullspace ShipController.cpp)

**Bullet damage:**
```
damage = BulletDamageLevel / 1000 + BulletDamageUpgrade / 1000 * weapon_level
```

**Bomb area damage:**
```
explode_radius = BombExplodePixels + BombExplodePixels * bomb_level  (pixels)
damage_at_distance = (explode_radius - distance) * (BombDamageLevel / 1000 / explode_radius)
```
Damage is maximum at center and linearly decreases to zero at the edge of the blast radius.

**Energy IS health:** In SubSpace, energy serves as both ammunition and health. Getting hit reduces energy. When energy reaches 0, the player dies. Energy recharges over time (per ship config, already implemented).

### Weapon Firing Logic

**Fire sequence (server-side):**
1. Check fire cooldown: `current_tick >= next_fire_tick`
2. Check energy: `player.energy >= fire_energy_cost`
3. Deduct energy: `player.energy -= fire_energy_cost`
4. Create projectile with velocity = ship_velocity + heading * weapon_speed
5. Set next cooldown: `next_fire_tick = current_tick + fire_delay`
6. For bombs: apply recoil thrust to firing ship: `ship.velocity -= heading * bombThrust`

**Bullet behavior:**
- Travels in straight line at BulletSpeed + ship velocity
- Destroyed on wall hit (no bouncing for standard bullets)
- Destroyed on player hit (deals damage, bullet removed)
- Despawns after BulletAliveTime ticks

**Bomb behavior:**
- Travels at BombSpeed + ship velocity
- Bounces off walls (axis-separated, same as ship collision)
- BombBounceCount decrements per bounce; explodes when reaches 0
- Explodes on player contact (area damage)
- Explodes on timeout (BombAliveTime)
- Applies BombThrust recoil to firing ship

### Death and Respawn (from nullspace PlayerManager.cpp)

**Death sequence:**
1. Energy reaches 0 from damage
2. Server broadcasts death event (killer ID, killed ID, bounty)
3. Player flags/items cleared
4. Explosion animation triggered
5. Increment killer's wins, killed's losses
6. Enter delay timer starts: `EnterDelay / 100` seconds + explosion animation duration

**Respawn (server-side Spawn function):**
1. Try up to 100 random positions
2. Check each position for wall collision (using ship radius)
3. First non-colliding position is the spawn point
4. Reset energy to full, clear weapon cooldowns
5. Apply brief invulnerability or safety period

## Network Protocol Design

### Message Types

```typescript
// Client -> Server
enum ClientMsg {
  JOIN = 0x01,           // { name, shipType }
  INPUT = 0x02,          // { seq, tick, input: ShipInput, fire: boolean, fireBomb: boolean }
  SHIP_SELECT = 0x03,    // { shipType }
  PING = 0x04,           // { clientTime }
}

// Server -> Client
enum ServerMsg {
  WELCOME = 0x01,        // { playerId, tick, map, settings }
  SNAPSHOT = 0x02,       // { tick, players[], projectiles[] }
  PLAYER_JOIN = 0x03,    // { playerId, name, shipType }
  PLAYER_LEAVE = 0x04,   // { playerId }
  DEATH = 0x05,          // { killerId, killedId, weaponType }
  SPAWN = 0x06,          // { playerId, x, y }
  PONG = 0x07,           // { clientTime, serverTime }
}
```

### Snapshot Format (sent at ~20Hz)

```typescript
interface GameSnapshot {
  tick: number;                    // Server tick number
  players: {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    orientation: number;
    energy: number;
    shipType: number;
    lastProcessedSeq: number;      // For reconciliation
  }[];
  projectiles: {
    id: number;
    type: number;                  // 0=bullet, 1=bomb
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: string;
  }[];
}
```

### Bandwidth Estimation

- Snapshot at 20Hz with 10 players: ~10 * 40 bytes + 20 projectiles * 30 bytes = ~1000 bytes/snapshot = ~20KB/s
- Input at 100Hz: ~12 bytes/input = ~1.2KB/s upload
- Total: ~21KB/s per player. Well within browser WebSocket limits.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket transport | Raw TCP/UDP implementation | `ws` library | RFC 6455 compliant, handles framing, masking, ping/pong, close handshake. |
| Physics simulation | Separate server physics | `@trench-wars/shared` (already built) | Deterministic client/server agreement requires identical code. |
| Timer precision | `setTimeout` game loop | `setInterval` with drift correction or `node:perf_hooks` | setTimeout drifts. Use monotonic timer for server tick accuracy. |
| Binary encoding | Custom bit-packing | DataView on ArrayBuffer (or JSON to start) | DataView handles endianness. Start with JSON, optimize to binary if needed. |

**Key insight:** The shared physics package from Phase 1 is the single most valuable architectural decision. It eliminates the entire class of "client and server disagree on physics" bugs that plague multiplayer games.

## Common Pitfalls

### Pitfall 1: Physics Divergence Between Client and Server
**What goes wrong:** Client prediction produces different results than server, causing constant rubber-banding as reconciliation snaps the player around.
**Why it happens:** Different floating-point behavior, different update order, different tick rates, or different random seeds.
**How to avoid:** Client and server MUST import the exact same functions from `@trench-wars/shared`. Both run at 100Hz. No floating-point shortcuts or platform-specific optimizations. Test by running 1000 ticks with identical inputs on both and comparing final state.
**Warning signs:** Player position visually "snaps" or "jitters" even on localhost (0ms latency).

### Pitfall 2: Input Flooding / Fast Shooting
**What goes wrong:** Client sends inputs faster than server tick rate, or sends multiple fire commands per tick, allowing faster-than-intended fire rates.
**Why it happens:** Client can potentially send messages at any rate.
**How to avoid:** Server enforces fire delay cooldowns regardless of input timing. Server processes at most one input per tick per player. Discard excess inputs. nullspace explicitly has a `DisableFastShooting` flag.
**Warning signs:** A player fires bullets much faster than their BulletFireDelay should allow.

### Pitfall 3: Snapshot Buffer Underrun
**What goes wrong:** Entity interpolation breaks because there aren't enough buffered snapshots, causing remote players to freeze or teleport.
**Why it happens:** Network jitter causes snapshot arrival to vary. If interpolation delay is too small, buffer empties.
**How to avoid:** Buffer at least 3 snapshots. Use adaptive interpolation delay based on network jitter. When buffer underruns, extrapolate briefly rather than freezing.
**Warning signs:** Remote players occasionally freeze for a moment, then teleport to catch up.

### Pitfall 4: Not Accounting for Weapon Inherit Velocity
**What goes wrong:** Bullets travel at BulletSpeed relative to the world, not the ship. A moving ship's bullets should travel faster in the direction of movement.
**Why it happens:** Forgetting to add ship velocity to bullet velocity at creation time.
**How to avoid:** Bullet initial velocity = ship velocity + heading * BulletSpeed. This matches SubSpace behavior (verified in nullspace WeaponManager.cpp).
**Warning signs:** Bullets fired while moving fast seem to "pile up" in front of the ship or lag behind.

### Pitfall 5: Server Tick Timer Drift
**What goes wrong:** Server simulation gradually drifts from real time, causing desynchronization.
**Why it happens:** `setInterval(fn, 10)` in Node.js is not precise. It can fire at 11ms, 12ms, or even 16ms intervals.
**How to avoid:** Use a high-resolution timer (`process.hrtime.bigint()` or `performance.now()`) with accumulator pattern, same as the client. Process multiple ticks per timer callback if behind.
**Warning signs:** Server tick count diverges from expected count over minutes of play.

### Pitfall 6: Reconciliation Replay Without Speed Clamp
**What goes wrong:** During reconciliation, replaying many inputs rapidly can cause the ship to exceed speed limits temporarily, resulting in visual glitches.
**Why it happens:** Replaying inputs without the full physics pipeline (including speed clamp and wall collision).
**How to avoid:** Reconciliation must replay the COMPLETE physics step for each input: `updateShipPhysics` + `applyWallCollision`. Never shortcut by only applying thrust.
**Warning signs:** Player occasionally teleports through walls during reconciliation.

## Code Examples

### Server Game Loop with High-Resolution Timer

```typescript
// packages/server/src/game-server.ts
import { TICK_DT, TICK_RATE } from '@trench-wars/shared';

const NS_PER_TICK = BigInt(Math.floor(1e9 / TICK_RATE)); // 10ms in nanoseconds

export class GameServer {
  private lastTime = process.hrtime.bigint();
  private accumulator = BigInt(0);
  private tickCount = 0;

  start(): void {
    // Run timer at 1ms resolution for accuracy
    setInterval(() => this.update(), 1);
  }

  private update(): void {
    const now = process.hrtime.bigint();
    this.accumulator += now - this.lastTime;
    this.lastTime = now;

    while (this.accumulator >= NS_PER_TICK) {
      this.tick();
      this.accumulator -= NS_PER_TICK;
      this.tickCount++;
    }
  }

  private tick(): void {
    // 1. Process all queued player inputs
    // 2. Update ship physics (shared code)
    // 3. Update weapon projectiles (shared code)
    // 4. Check hit detection (server-only)
    // 5. Process deaths/respawns
    // 6. Broadcast snapshot every 5 ticks (20Hz)
  }
}
```

### Client Input Buffer and Reconciliation

```typescript
// packages/client/src/prediction.ts
interface BufferedInput {
  seq: number;
  tick: number;
  data: ShipInput;
}

export class PredictionManager {
  private inputBuffer: BufferedInput[] = [];
  private seq = 0;

  recordInput(input: ShipInput, tick: number): BufferedInput {
    const buffered = { seq: ++this.seq, tick, data: input };
    this.inputBuffer.push(buffered);
    return buffered;
  }

  reconcile(
    serverState: ShipState,
    lastProcessedSeq: number,
    config: ShipConfig,
    map: TileMap,
    bounceFactor: number,
  ): ShipState {
    // Discard acknowledged inputs
    this.inputBuffer = this.inputBuffer.filter(i => i.seq > lastProcessedSeq);

    // Start from server state
    const state = { ...serverState };

    // Replay unacknowledged inputs
    for (const input of this.inputBuffer) {
      updateShipPhysics(state, input.data, config, TICK_DT);
      applyWallCollision(state, TICK_DT, map, config.radius, bounceFactor);
    }

    return state;
  }
}
```

### Lag-Compensated Hit Detection

```typescript
// packages/server/src/lag-compensation.ts
interface PositionSnapshot {
  tick: number;
  positions: Map<string, { x: number; y: number; radius: number }>;
}

export class LagCompensation {
  private history: PositionSnapshot[] = [];
  private maxHistoryTicks = 200; // 2 seconds at 100Hz

  record(tick: number, players: Map<string, PlayerState>): void {
    const positions = new Map<string, { x: number; y: number; radius: number }>();
    for (const [id, player] of players) {
      positions.set(id, { x: player.x, y: player.y, radius: player.config.radius });
    }
    this.history.push({ tick, positions });
    if (this.history.length > this.maxHistoryTicks) {
      this.history.shift();
    }
  }

  getPositionsAtTick(tick: number): Map<string, { x: number; y: number; radius: number }> | null {
    // Find closest snapshot (binary search for efficiency)
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].tick <= tick) {
        return this.history[i].positions;
      }
    }
    return null;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socket.IO for game networking | Raw ws for performance-critical games | ~2020 | Socket.IO's HTTP fallback and event abstraction add latency. ws is lighter. |
| Colyseus for all multiplayer games | Custom server for action games, Colyseus for turn-based | ~2023 | Colyseus schema sync doesn't fit 100Hz physics. Custom gives full control. |
| JSON protocol always | Binary protocol for bandwidth-sensitive games | Ongoing | Start JSON, optimize to binary if bandwidth matters. |
| Lockstep networking | Client prediction + server reconciliation | ~2010+ | Lockstep requires all clients to be in sync. Prediction handles variable latency. |

**Deprecated/outdated:**
- `socket.io` v2 patterns (many game tutorials use old socket.io with rooms). Use raw `ws` instead.
- `process.hrtime()` (returns [seconds, nanoseconds] tuple). Use `process.hrtime.bigint()` for BigInt nanoseconds.

## Open Questions

1. **Exact Trench Wars weapon balance values**
   - What we know: SVS defaults for BulletSpeed (2000), BombSpeed (2000), basic damage formulas.
   - What's unclear: The exact fire delays, energy costs, and damage levels used in the actual TW zone. ASSS wiki was inaccessible (expired SSL cert).
   - Recommendation: Use SVS defaults as starting point. Weapon values are configurable. Tune during playtesting. The formulas and mechanics are correct; only the specific numbers need adjustment.

2. **Reconnection session persistence**
   - What we know: NETW-05 requires reconnection support. Server needs to hold player slot.
   - What's unclear: How long to hold the slot? What state to preserve?
   - Recommendation: Hold slot for 30 seconds. Assign a random session token on join. On reconnect with valid token within timeout, restore full player state. If expired, treat as new player.

3. **Smooth reconciliation vs snap**
   - What we know: Snap reconciliation works but can be visually jarring. Smooth reconciliation interpolates toward correct state.
   - What's unclear: How much smoothing is needed for SubSpace's fast-paced gameplay.
   - Recommendation: Start with snap reconciliation (simpler). If visual jitter is noticeable at reasonable latency (<100ms), add smooth reconciliation with a 100ms blend.

4. **Ship selection UI scope**
   - What we know: SHIP-05 requires ship selection before entering arena.
   - What's unclear: Whether this needs a full UI screen or minimal implementation.
   - Recommendation: Minimal for Phase 2 -- number keys 1/2/3 to pick ship before spawning, or a simple HTML overlay. Full ship selection screen is Phase 3 (UIEX-01).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured in packages/shared) |
| Config file | `packages/shared/vitest.config.ts` (exists), `packages/server/vitest.config.ts` (Wave 0) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NETW-01 | Server validates positions and rejects invalid state | unit | `npx vitest run packages/server/src/__tests__/game-server.test.ts -t "authoritative"` | Wave 0 |
| NETW-02 | Client prediction produces same result as server for same inputs | unit | `npx vitest run packages/shared/src/__tests__/prediction.test.ts -t "prediction"` | Wave 0 |
| NETW-03 | Reconciliation replays inputs and converges to server state | unit | `npx vitest run packages/client/src/__tests__/prediction.test.ts -t "reconciliation"` | Wave 0 |
| NETW-04 | Interpolation produces smooth intermediate positions | unit | `npx vitest run packages/client/src/__tests__/interpolation.test.ts -t "interpolation"` | Wave 0 |
| NETW-05 | Reconnect restores player state within timeout | integration | `npx vitest run packages/server/src/__tests__/reconnect.test.ts` | Wave 0 |
| CMBT-01 | Bullet created with correct velocity and energy deducted | unit | `npx vitest run packages/shared/src/__tests__/weapons.test.ts -t "bullet fire"` | Wave 0 |
| CMBT-02 | Bullet moves at correct speed and despawns after alive time | unit | `npx vitest run packages/shared/src/__tests__/weapons.test.ts -t "bullet movement"` | Wave 0 |
| CMBT-03 | Bullet-player collision detected and damage applied | unit | `npx vitest run packages/server/src/__tests__/hit-detection.test.ts -t "bullet hit"` | Wave 0 |
| CMBT-04 | Bomb bounces off walls correct number of times | unit | `npx vitest run packages/shared/src/__tests__/weapons.test.ts -t "bomb bounce"` | Wave 0 |
| CMBT-05 | Bomb area damage decreases with distance | unit | `npx vitest run packages/shared/src/__tests__/weapons.test.ts -t "bomb area damage"` | Wave 0 |
| CMBT-06 | Player dies when energy reaches zero | unit | `npx vitest run packages/server/src/__tests__/player-manager.test.ts -t "death"` | Wave 0 |
| CMBT-07 | Kill/death counts increment correctly | unit | `npx vitest run packages/server/src/__tests__/player-manager.test.ts -t "kill tracking"` | Wave 0 |
| CMBT-08 | Respawn position is not inside a wall | unit | `npx vitest run packages/server/src/__tests__/player-manager.test.ts -t "respawn"` | Wave 0 |
| CMBT-09 | Lag-compensated hit uses historical positions | unit | `npx vitest run packages/server/src/__tests__/lag-compensation.test.ts -t "rewind"` | Wave 0 |
| SHIP-01 | Warbird has correct weapon stats (fast fire, low bomb) | unit | `npx vitest run packages/shared/src/__tests__/ships.test.ts -t "warbird weapon"` | Wave 0 |
| SHIP-02 | Javelin has correct weapon stats (high bomb bounce) | unit | `npx vitest run packages/shared/src/__tests__/ships.test.ts -t "javelin weapon"` | Wave 0 |
| SHIP-03 | Spider has correct weapon stats (balanced) | unit | `npx vitest run packages/shared/src/__tests__/ships.test.ts -t "spider weapon"` | Wave 0 |
| SHIP-04 | Ship types have distinct stats | unit | `npx vitest run packages/shared/src/__tests__/ships.test.ts -t "distinct stats"` | Exists (extend) |
| SHIP-05 | Ship selection message changes player ship type | integration | `npx vitest run packages/server/src/__tests__/game-server.test.ts -t "ship select"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/package.json` -- server package initialization
- [ ] `packages/server/vitest.config.ts` -- test framework config for server
- [ ] `packages/server/tsconfig.json` -- TypeScript config for server
- [ ] `packages/shared/src/__tests__/weapons.test.ts` -- covers CMBT-01 through CMBT-05
- [ ] `packages/server/src/__tests__/game-server.test.ts` -- covers NETW-01, SHIP-05
- [ ] `packages/server/src/__tests__/player-manager.test.ts` -- covers CMBT-06, CMBT-07, CMBT-08
- [ ] `packages/server/src/__tests__/hit-detection.test.ts` -- covers CMBT-03, CMBT-09
- [ ] `packages/server/src/__tests__/lag-compensation.test.ts` -- covers CMBT-09
- [ ] `packages/server/src/__tests__/reconnect.test.ts` -- covers NETW-05
- [ ] `packages/client/src/__tests__/prediction.test.ts` -- covers NETW-02, NETW-03
- [ ] `packages/client/src/__tests__/interpolation.test.ts` -- covers NETW-04
- [ ] Framework install: `npm install -D vitest -w packages/server`

## Sources

### Primary (HIGH confidence)
- [nullspace WeaponManager.cpp](https://github.com/plushmonkey/nullspace/blob/master/src/null/WeaponManager.cpp) - Complete weapon simulation: bullet/bomb creation, wall bouncing, hit detection AABB, shrapnel generation
- [nullspace ShipController.cpp](https://github.com/plushmonkey/nullspace/blob/master/src/null/ShipController.cpp) - Weapon firing logic: energy costs, fire delays, multifire, bomb recoil thrust, damage formulas
- [nullspace ArenaSettings.h](https://github.com/plushmonkey/nullspace/blob/master/src/null/ArenaSettings.h) - ShipSettings and ArenaSettings structs with all weapon-related fields
- [nullspace PlayerManager.cpp](https://github.com/plushmonkey/nullspace/blob/master/src/null/PlayerManager.cpp) - Death/respawn handling, kill tracking, position packet processing, spawn algorithm
- [nullspace Player.h](https://github.com/plushmonkey/nullspace/blob/master/src/null/Player.h) - Player data structures: WeaponData bitfield, energy as health, damage tracking
- [Gabriel Gambetta - Client-Side Prediction](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html) - Input buffering, sequence numbering, reconciliation algorithm
- [Gabriel Gambetta - Entity Interpolation](https://www.gabrielgambetta.com/entity-interpolation.html) - Snapshot buffering, render delay, lerp between known positions
- [Gabriel Gambetta - Lag Compensation](https://www.gabrielgambetta.com/lag-compensation.html) - Server-side world rewind for fair hit detection
- [ws npm package](https://www.npmjs.com/package/ws) - Version 8.20.0 verified, RFC 6455 WebSocket implementation

### Secondary (MEDIUM confidence)
- [WebGameDev - Prediction Reconciliation](https://www.webgamedev.com/backend/prediction-reconciliation) - TypeScript implementation patterns for WebSocket game servers
- [Valve - Latency Compensating Methods](https://developer.valvesoftware.com/wiki/Latency_Compensating_Methods_in_Client/Server_In-game_Protocol_Design_and_Optimization) - Industry standard lag compensation approach
- Phase 1 research (01-RESEARCH.md) - SVS default ship parameters, physics formulas, unit conversions (all verified)

### Tertiary (LOW confidence)
- Weapon balance values (fire delays, energy costs, damage levels) - Estimated from SVS defaults and nullspace code analysis. Actual Trench Wars zone values may differ. These are tunable config values.
- ASSS Wiki (wiki.minegoboom.com) - Referenced but inaccessible due to expired SSL certificate. Ship Settings and Bomb Settings pages would have authoritative documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ws verified at 8.20.0, shared physics already built and proven in Phase 1
- Architecture: HIGH - Client prediction + server reconciliation is the standard pattern for authoritative multiplayer, well-documented by Gambetta and Valve
- Weapon mechanics: HIGH - Formulas extracted directly from nullspace C++ source code (reverse-engineered SubSpace client)
- Weapon balance values: MEDIUM - SVS defaults estimated, not verified against actual TW zone settings. Tunable.
- Networking patterns: HIGH - Gambetta articles are the canonical reference, verified against multiple implementations
- Pitfalls: HIGH - Common multiplayer game development issues, verified across multiple sources

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (30 days -- stable domain, well-understood networking patterns)
