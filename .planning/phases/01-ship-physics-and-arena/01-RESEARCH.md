# Phase 1: Ship Physics and Arena - Research

**Researched:** 2026-03-22
**Domain:** 2D ship physics simulation, tile-based arena rendering, SubSpace/Continuum game feel
**Confidence:** HIGH

## Summary

Phase 1 is a single-player-in-browser physics playground. No networking, no combat, no server -- just one ship flying around a tile-based map in the browser. The entire purpose is to nail the SubSpace "feel" before adding complexity. This is the foundation that everything else builds on.

The critical discovery from this research is that SubSpace does NOT use drag/friction for speed limiting. It uses a hard velocity clamp (`Truncate`). Ships maintain full momentum in space until they hit the speed cap or a wall. This is fundamentally different from most space game tutorials that apply drag coefficients, and getting this wrong would destroy the authentic feel.

The physics simulation runs at 100Hz internally (both in the original game and our implementation should match). The coordinate system is tile-based (1024x1024 tiles, each 16 pixels). Wall collision uses axis-separated box-box intersection with configurable bounce factor.

**Primary recommendation:** Build the shared physics module first as pure TypeScript math (no rendering, no DOM), validate it with unit tests against known SubSpace parameters, then wire up PixiJS rendering and keyboard input.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PHYS-01 | Ship rotates left/right with arrow keys at configurable rotation speed | Rotation formula: `orientation += (rotation / 400.0f) * dt`. SVS Warbird InitialRotation=210. See SubSpace Physics section. |
| PHYS-02 | Ship thrusts forward with up arrow, applying force in facing direction | Thrust formula: `velocity += heading * (thrust * 10.0 / 16.0) * dt`. SVS Warbird InitialThrust=16. |
| PHYS-03 | Ship maintains momentum and drifts when not thrusting (inertia) | SubSpace has zero friction. No drag. Ship velocity persists until speed-capped or wall-bounced. |
| PHYS-04 | Ship has configurable drag that gradually slows it over time | NOTE: SubSpace does NOT use drag. It uses a hard speed clamp: `velocity.Truncate(speed / 10.0 / 16.0)`. Implement as speed cap, not drag. |
| PHYS-05 | Ship bounces off tile walls on collision | Axis-separated collision with bounce factor: `velocity[axis] *= -bounceFactor`. Default BounceFactor=16 (i.e., `16/16 = 1.0` = fully elastic). SVS uses 16. |
| PHYS-06 | Physics parameters match authentic SubSpace feel | SVS default values extracted from original SERVER.CFG. Simulation at 100Hz fixed timestep. All unit conversions documented below. |
| PHYS-07 | Ship can activate afterburner for temporary speed boost consuming energy | Afterburner uses MaximumThrust and MaximumSpeed instead of current values. Energy cost: `(AfterburnerEnergy / 10.0) * dt`. SVS AfterburnerEnergy=1200. |
| MAPS-01 | Tile-based map system with walls and open space | 1024x1024 tile grid, each tile 16x16 pixels. Tiles are solid or empty. Collision uses box-box intersection with Minkowski expansion by ship radius. |
| MAPS-02 | At least one playable arena map designed for 10-20 players | Design a custom map as a JSON tilemap (not .lvl format). Focus on a 200x200 active area with corridors and open spaces. |
| MAPS-03 | Map data loads from a defined format (tilemap) | Use a simple JSON format: `{ width, height, tiles: number[] }`. Load once at startup. Render with @pixi/tilemap CompositeTilemap. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PixiJS | ^8.17.1 | 2D WebGL rendering engine | Fastest 2D renderer in JS. GPU-accelerated for glow effects and smooth 60fps. Lighter than Phaser, gives full control over game loop. |
| @pixi/tilemap | ^5.0.2 | Efficient tilemap rendering | Purpose-built for large tilemaps with WebGL batching. Handles 1024x1024 tile grids. Compatible with PixiJS v8. |
| TypeScript | ^5.9.3 | Type-safe game logic | Shared physics code between future client/server. Type safety prevents unit mismatch bugs. |
| Vite | ^6.x | Dev server and bundler | Sub-50ms HMR for rapid iteration on game feel. Native TypeScript support. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lil-gui | ^0.21.0 | Runtime parameter tweaking | Development only. Tune rotation speed, thrust, speed cap, bounce factor in real-time without code changes. Essential for getting the feel right. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PixiJS | Phaser 3 | Phaser adds physics engine and scene management we don't need. Fights authoritative server pattern in later phases. |
| @pixi/tilemap | Manual sprite grid | Would lose WebGL batching optimization. @pixi/tilemap handles thousands of tiles efficiently. |
| Custom JSON map format | SubSpace .lvl format | .lvl format is underdocumented and adds parsing complexity. JSON is simpler for v1. Can add .lvl import later. |
| lil-gui | dat.gui | lil-gui is the maintained successor to dat.gui. Same API, smaller, actively maintained. |

**Installation:**
```bash
# Initialize monorepo
npm init -y
# Client package (Phase 1 is client-only)
npm init -y -w packages/client
npm install pixi.js@^8.17.1 @pixi/tilemap@^5.0.2 -w packages/client
npm install -D vite@^6 typescript@^5.9 lil-gui@^0.21.0 -w packages/client

# Shared physics package
npm init -y -w packages/shared
npm install -D typescript@^5.9 -w packages/shared
```

**Version verification:**
| Package | Registry Version | Verified Date |
|---------|-----------------|---------------|
| pixi.js | 8.17.1 | 2026-03-22 |
| @pixi/tilemap | 5.0.2 | 2026-03-22 |
| vite | 8.0.1 (use ^6.x for stability) | 2026-03-22 |
| typescript | 5.9.3 | 2026-03-22 |
| lil-gui | 0.21.0 | 2026-03-22 |
| colyseus | 0.17.8 (not needed yet) | 2026-03-22 |

## Architecture Patterns

### Recommended Project Structure (Phase 1)
```
trench-wars/
  packages/
    shared/                 # Pure physics + constants (no DOM, no Node APIs)
      src/
        physics.ts          # Ship movement: thrust, rotation, speed clamp
        collision.ts         # Wall collision detection + bounce
        ships.ts             # Ship type configs (Warbird, Javelin, Spider stats)
        constants.ts         # Tick rate, map dimensions, unit conversions
        types.ts             # Interfaces: ShipState, Input, TileMap
      tsconfig.json
      package.json

    client/                 # Browser rendering + input (Phase 1 only)
      src/
        main.ts             # Entry point: init PixiJS, start game loop
        game-loop.ts         # Fixed-timestep accumulator pattern
        renderer.ts          # PixiJS rendering: ship sprite, tilemap, camera
        input.ts             # Keyboard state polling (arrow keys, shift)
        camera.ts            # Viewport following ship, clamped to map bounds
        debug.ts             # lil-gui panel for tuning physics params
      index.html
      vite.config.ts
      tsconfig.json
      package.json

  assets/
    maps/
      arena.json            # Tile map data
    sprites/
      ship.png              # Ship sprite (or procedural vector rendering)
      tiles.png             # Tileset texture

  package.json              # Monorepo root (npm workspaces)
  tsconfig.base.json        # Shared TypeScript config
```

### Pattern 1: Fixed-Timestep Game Loop with Accumulator

**What:** Physics simulation runs at exactly 100Hz (10ms per tick), matching SubSpace's internal rate. The browser's `requestAnimationFrame` provides variable-rate rendering. An accumulator bridges the two: real elapsed time accumulates, and the physics steps in fixed 10ms increments.

**When to use:** Always. This is the foundation for deterministic physics and future client-side prediction.

**Example:**
```typescript
// Source: Glenn Fiedler's "Fix Your Timestep" + SubSpace reverse engineering
const TICK_RATE = 100; // Hz, matching SubSpace
const TICK_DT = 1 / TICK_RATE; // 0.01 seconds

let accumulator = 0;
let lastTime = performance.now();

function gameLoop(currentTime: number) {
  const frameTime = Math.min((currentTime - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = currentTime;
  accumulator += frameTime;

  // Poll input once per frame
  const input = pollKeyboard();

  while (accumulator >= TICK_DT) {
    // Step physics at fixed rate
    updateShipPhysics(shipState, input, TICK_DT);
    checkWallCollision(shipState, tileMap, TICK_DT);
    accumulator -= TICK_DT;
  }

  // Render at display refresh rate
  // Optional: interpolate visual position by accumulator/TICK_DT for extra smoothness
  render(shipState);
  requestAnimationFrame(gameLoop);
}
```

### Pattern 2: Shared Physics as Pure Functions

**What:** All physics code lives in `packages/shared/` as pure functions that take state + input + dt and return new state. No side effects, no DOM access, no Node APIs. This enables unit testing, future server-side execution, and deterministic replay.

**When to use:** For all physics calculations -- thrust, rotation, speed clamping, collision.

**Example:**
```typescript
// packages/shared/src/physics.ts
export interface ShipState {
  x: number;          // tile coordinates (0-1023)
  y: number;
  vx: number;         // tiles per second
  vy: number;
  orientation: number; // 0-1 (fraction of full rotation)
  energy: number;
  ship: ShipType;
}

export interface ShipInput {
  left: boolean;
  right: boolean;
  thrust: boolean;
  afterburner: boolean;
}

export function applyRotation(state: ShipState, input: ShipInput, config: ShipConfig, dt: number): void {
  if (input.left) {
    state.orientation -= (config.rotation / 400) * dt;
    if (state.orientation < 0) state.orientation += 1;
  }
  if (input.right) {
    state.orientation += (config.rotation / 400) * dt;
    if (state.orientation >= 1) state.orientation -= 1;
  }
}

export function applyThrust(state: ShipState, input: ShipInput, config: ShipConfig, dt: number): void {
  if (!input.thrust) return;

  const thrust = input.afterburner ? config.maxThrust : config.thrust;
  const angle = state.orientation * Math.PI * 2;
  const thrustPerSecond = thrust * (10 / 16);

  state.vx += Math.cos(angle) * thrustPerSecond * dt;
  state.vy += Math.sin(angle) * thrustPerSecond * dt;
}

export function clampSpeed(state: ShipState, input: ShipInput, config: ShipConfig): void {
  const maxSpeed = input.afterburner ? config.maxSpeed : config.speed;
  const speedLimit = maxSpeed / 10 / 16; // convert to tiles/second
  const currentSpeed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);

  if (currentSpeed > speedLimit) {
    const scale = speedLimit / currentSpeed;
    state.vx *= scale;
    state.vy *= scale;
  }
}
```

### Pattern 3: Axis-Separated Wall Collision

**What:** Check X and Y movement independently. Move on X axis first, check collision, bounce if needed. Then move on Y axis, check collision, bounce if needed. This prevents corner-case tunneling and matches SubSpace's collision behavior.

**When to use:** Every physics tick for ship-wall collision.

**Example:**
```typescript
// Source: nullspace (plushmonkey) reverse-engineered SubSpace physics
export function simulateAxis(
  state: ShipState, dt: number, axis: 'x' | 'y',
  map: TileMap, radius: number, bounceFactor: number
): boolean {
  const velKey = axis === 'x' ? 'vx' : 'vy';
  const otherVelKey = axis === 'x' ? 'vy' : 'vx';
  const previous = state[axis];

  state[axis] += state[velKey] * dt;

  // Check tiles around new position
  if (isCollidingWithWall(state, map, radius)) {
    state[axis] = previous;
    state[velKey] *= -bounceFactor;
    state[otherVelKey] *= bounceFactor;
    return true;
  }
  return false;
}
```

### Anti-Patterns to Avoid

- **Applying drag/friction to velocity:** SubSpace does NOT use drag. Velocity persists indefinitely until speed-capped or wall-bounced. Using drag will make ships feel "floaty" or "sluggish" instead of the crisp, zero-friction space feel.
- **Variable timestep physics:** Using `requestAnimationFrame` delta time directly for physics will cause different behavior at different frame rates. Always use fixed 10ms timestep.
- **Pixel-based coordinates:** SubSpace uses tile-based coordinates (0-1023). Pixels are tiles * 16. Working in pixels introduces unnecessary floating-point precision issues.
- **Rendering inside the physics loop:** Keep physics pure. Render separately at display rate. Never call PixiJS APIs from shared physics code.

## SubSpace Physics Deep Dive

### Unit System

All values from SERVER.CFG use SubSpace's internal unit system. Conversions (verified from nullspace source code):

| Setting | Internal Unit | Conversion | Example |
|---------|--------------|------------|---------|
| Rotation | 90 degrees / (seconds/100) | `value / 400` = full rotations per second | 210 -> 0.525 rot/s |
| Thrust | speed / (seconds/10) | `value * 10 / 16` = tiles/s/s | 16 -> 10 tiles/s/s |
| Speed | pixels / (seconds/10) | `value / 10 / 16` = tiles/s | 2010 -> 12.5625 tiles/s |
| Recharge | energy / (seconds/10) | `value / 10` = energy/s | 400 -> 40 energy/s |
| Energy | raw value | direct | 1000 = 1000 energy |
| AfterburnerEnergy | energy / (seconds/10) | `value / 10` = energy/s cost | 1200 -> 120 energy/s |
| BounceFactor | factor * 16 | `16 / value` = velocity multiplier | 16 -> 1.0 (fully elastic) |

### SVS Default Ship Parameters (from SubSpace 1.34 SERVER.CFG)

| Parameter | Warbird | Javelin | Spider |
|-----------|---------|---------|--------|
| InitialRotation | 210 | 200 | 200 |
| InitialThrust | 16 | 15 | 15 |
| InitialSpeed | 2010 | 2200 | 2010 |
| InitialRecharge | 400 | 400 | 500 |
| InitialEnergy | 1000 | 1000 | 1000 |
| MaximumRotation | 300 | 230 | 230 |
| MaximumThrust | 19 | 17 | 17 |
| MaximumSpeed | 3250 | 3750 | 3250 |
| MaximumRecharge | 1150 | 1150 | 1150 |
| MaximumEnergy | 1700 | 1700 | 1700 |
| AfterburnerEnergy | 1200 | 1200 | 1200 |
| BulletSpeed | 2000 | 2000 | 2000 |
| BombSpeed | 2000 | 2000 | 2000 |
| Gravity | 1500 | 1500 | 1500 |
| GravityTopSpeed | 100 | 100 | 100 |

### Converted Values for Implementation (Warbird)

| Property | Raw | Converted | Unit |
|----------|-----|-----------|------|
| Rotation rate | 210 | 0.525 | full rotations/second |
| Thrust acceleration | 16 | 10.0 | tiles/second^2 |
| Max speed | 2010 | 12.5625 | tiles/second |
| Max speed (afterburner) | 3250 | 20.3125 | tiles/second |
| Energy recharge | 400 | 40.0 | energy/second |
| Starting energy | 1000 | 1000 | energy units |
| Afterburner cost | 1200 | 120.0 | energy/second |
| Bounce factor | 16 | 1.0 | multiplier (fully elastic) |

### Physics Update Order (per tick)

Based on the nullspace source code, the update order per tick is:

1. Apply gravity (from wormholes -- skip for Phase 1)
2. Apply thrust (if forward/backward pressed): `velocity += heading * thrustPerSecond * dt`
3. Apply rotation (if left/right pressed): `orientation += rotationRate * dt`
4. Clamp speed: `velocity.Truncate(speedLimit)` -- hard cap, NOT drag
5. Update energy: subtract afterburner cost, add recharge
6. Simulate X axis: move position, check wall collision, bounce if needed
7. Simulate Y axis: move position, check wall collision, bounce if needed

### Key Insight: No Drag

SubSpace ships have NO velocity decay. A ship at maximum speed stays at maximum speed forever in open space. The speed cap (`Truncate`) only prevents going faster, it never slows you down. This is what gives SubSpace its distinctive "ice skating in space" feel.

The requirement PHYS-04 says "configurable drag that gradually slows it over time." This conflicts with authentic SubSpace behavior. **Recommendation:** Implement as a hard speed clamp matching SubSpace, but make it configurable via the debug panel so an optional drag parameter can be tested. The default should be zero drag (authentic SubSpace).

### Map System

- **Dimensions:** 1024x1024 tiles (16,384 x 16,384 pixels)
- **Tile size:** 16x16 pixels
- **Coordinate system:** Origin at top-left. X increases right, Y increases down.
- **Ship positions:** Float values in tile coordinates (e.g., 512.5 = center of tile 512)
- **Ship radius:** Configurable per ship type. Used for Minkowski-expanded box collision.
- **Collision detection:** Check tiles within `position +/- radius` range. Box-box intersection between ship AABB and tile AABB.

For Phase 1, we do NOT need to support the SubSpace .lvl file format. Use a simple JSON format:

```typescript
interface TileMap {
  width: number;   // tiles (e.g., 256)
  height: number;  // tiles (e.g., 256)
  tiles: number[]; // flat array, row-major. 0=empty, 1=wall
}
```

Design a small arena (200-300 tiles wide) with walls around the perimeter and internal corridors. This is sufficient for Phase 1 testing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebGL tilemap rendering | Manual sprite positioning for each tile | @pixi/tilemap `CompositeTilemap` | Batches thousands of tiles into minimal draw calls. Manual approach hits GPU limits fast. |
| 2D WebGL rendering pipeline | Raw WebGL shader/buffer management | PixiJS v8 | PixiJS handles sprite batching, texture management, coordinate transforms. Weeks of work to replicate. |
| Runtime parameter tweaking UI | Custom HTML inputs for debug sliders | lil-gui | Instant floating panel with auto-typing. Custom UI is a time sink that distracts from physics work. |
| Fixed-timestep accumulator | Custom timing logic from scratch | Standard accumulator pattern | The algorithm is well-known (Glenn Fiedler). Implement it, but don't invent a novel approach. |

**Key insight:** Phase 1's value is in getting the physics FEEL right, not in building rendering infrastructure. Use libraries for everything visual. Spend time on the shared physics module and parameter tuning.

## Common Pitfalls

### Pitfall 1: Applying Drag Instead of Speed Clamp
**What goes wrong:** Tutorials for "space ship games" almost universally apply velocity drag: `velocity *= 0.99`. This makes ships slow down over time, which feels completely wrong for SubSpace.
**Why it happens:** Drag is the intuitive approach for "top speed" and is well-documented in game dev tutorials.
**How to avoid:** Use `velocity.Truncate(maxSpeed)` -- a hard magnitude clamp. Velocity only changes from thrust, collision, or external forces. Never decays on its own.
**Warning signs:** Ships slow to a stop when you release thrust. That's NOT SubSpace.

### Pitfall 2: Wrong Rotation Direction Mapping
**What goes wrong:** Ship visual rotation doesn't match movement direction after thrusting, because the angle convention (0 = right vs 0 = up) or rotation direction (CW vs CCW) is inconsistent between physics and rendering.
**Why it happens:** SubSpace uses 0-1 orientation range where the heading is computed via `OrientationToHeading`. Different systems use different conventions (radians vs degrees, different zero-angles).
**How to avoid:** Define the convention once in constants.ts: orientation 0 = right (east), increasing = clockwise. Use `angle = orientation * 2 * PI` consistently. Ensure the ship sprite faces right at orientation 0.
**Warning signs:** Ship appears to thrust sideways or backwards.

### Pitfall 3: Rendering at Physics Rate Instead of Display Rate
**What goes wrong:** Game loop runs physics and rendering together at 100Hz (or worse, ties physics to `requestAnimationFrame` at 60fps). Either physics runs too slowly (60Hz instead of 100Hz) or the game wastes CPU (rendering 100fps when display only shows 60).
**Why it happens:** Simpler to have one loop doing everything.
**How to avoid:** Decouple physics (100Hz fixed timestep via accumulator) from rendering (requestAnimationFrame at display rate). Render after all physics steps for the frame are complete.
**Warning signs:** Physics behavior changes on monitors with different refresh rates (60Hz vs 144Hz).

### Pitfall 4: Floating-Point Accumulation in Orientation
**What goes wrong:** Orientation drifts outside 0-1 range over time due to floating-point precision, or wrapping logic has off-by-one that causes visual glitches.
**Why it happens:** Repeated addition of small float values accumulates error.
**How to avoid:** Always normalize orientation after modification: `if (orientation < 0) orientation += 1; if (orientation >= 1) orientation -= 1;`. Consider periodic normalization (e.g., every 100 ticks).
**Warning signs:** Ship rotation becomes jerky or snaps after extended play.

### Pitfall 5: Tile Collision Tunneling at High Speed
**What goes wrong:** A fast-moving ship passes through a thin wall (1-tile thick) because its position jumps from one side to the other in a single tick.
**Why it happens:** Discrete position updates can skip over narrow obstacles.
**How to avoid:** The axis-separated collision approach naturally prevents this for walls aligned with axes. For diagonal movement, checking both axes independently (X then Y) catches most cases. The speed cap also inherently limits how far a ship can move per tick (at max speed ~20 tiles/s, that's 0.2 tiles per 100Hz tick -- well under 1 tile).
**Warning signs:** Ship occasionally passes through walls at maximum speed + afterburner.

## Code Examples

### Ship Config from SVS Values

```typescript
// packages/shared/src/ships.ts
// Source: SubSpace 1.34 SERVER.CFG (SVS defaults)

export interface ShipConfig {
  name: string;
  // Raw SVS values (stored for reference/serialization)
  rawRotation: number;
  rawThrust: number;
  rawSpeed: number;
  rawMaxRotation: number;
  rawMaxThrust: number;
  rawMaxSpeed: number;
  rawRecharge: number;
  rawEnergy: number;
  rawMaxRecharge: number;
  rawMaxEnergy: number;
  rawAfterburnerEnergy: number;
  // Converted values for physics simulation (tiles/second units)
  rotation: number;      // full rotations per second
  thrust: number;        // tiles/s^2
  speed: number;         // tiles/s (max speed, hard cap)
  maxThrust: number;     // tiles/s^2 (afterburner thrust)
  maxSpeed: number;      // tiles/s (afterburner max speed)
  recharge: number;      // energy/second
  energy: number;        // starting energy
  maxRecharge: number;
  maxEnergy: number;
  afterburnerCost: number; // energy/second
  radius: number;        // tiles (ship collision radius)
}

function convertShip(raw: {
  rotation: number; thrust: number; speed: number;
  maxRotation: number; maxThrust: number; maxSpeed: number;
  recharge: number; energy: number; maxRecharge: number; maxEnergy: number;
  afterburnerEnergy: number; radius?: number; name: string;
}): ShipConfig {
  return {
    name: raw.name,
    rawRotation: raw.rotation,
    rawThrust: raw.thrust,
    rawSpeed: raw.speed,
    rawMaxRotation: raw.maxRotation,
    rawMaxThrust: raw.maxThrust,
    rawMaxSpeed: raw.maxSpeed,
    rawRecharge: raw.recharge,
    rawEnergy: raw.energy,
    rawMaxRecharge: raw.maxRecharge,
    rawMaxEnergy: raw.maxEnergy,
    rawAfterburnerEnergy: raw.afterburnerEnergy,
    rotation: raw.rotation / 400,
    thrust: raw.thrust * 10 / 16,
    speed: raw.speed / 10 / 16,
    maxThrust: raw.maxThrust * 10 / 16,
    maxSpeed: raw.maxSpeed / 10 / 16,
    recharge: raw.recharge / 10,
    energy: raw.energy,
    maxRecharge: raw.maxRecharge / 10,
    maxEnergy: raw.maxEnergy,
    afterburnerCost: raw.afterburnerEnergy / 10,
    radius: raw.radius ?? 14 / 16, // ~0.875 tiles, typical ship radius
  };
}

export const WARBIRD = convertShip({
  name: 'Warbird',
  rotation: 210, thrust: 16, speed: 2010,
  maxRotation: 300, maxThrust: 19, maxSpeed: 3250,
  recharge: 400, energy: 1000, maxRecharge: 1150, maxEnergy: 1700,
  afterburnerEnergy: 1200,
});

export const JAVELIN = convertShip({
  name: 'Javelin',
  rotation: 200, thrust: 15, speed: 2200,
  maxRotation: 230, maxThrust: 17, maxSpeed: 3750,
  recharge: 400, energy: 1000, maxRecharge: 1150, maxEnergy: 1700,
  afterburnerEnergy: 1200,
});

export const SPIDER = convertShip({
  name: 'Spider',
  rotation: 200, thrust: 15, speed: 2010,
  maxRotation: 230, maxThrust: 17, maxSpeed: 3250,
  recharge: 500, energy: 1000, maxRecharge: 1150, maxEnergy: 1700,
  afterburnerEnergy: 1200,
});
```

### Wall Collision Detection

```typescript
// packages/shared/src/collision.ts
// Source: nullspace PlayerManager::SimulateAxis

export function isWallAt(map: TileMap, tileX: number, tileY: number): boolean {
  if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) return true; // map border
  return map.tiles[tileY * map.width + tileX] !== 0;
}

export function isCollidingWithWalls(
  x: number, y: number, radius: number, map: TileMap
): boolean {
  const startX = Math.floor(x - radius);
  const startY = Math.floor(y - radius);
  const endX = Math.floor(x + radius) + 1;
  const endY = Math.floor(y + radius) + 1;

  for (let ty = startY; ty < endY; ty++) {
    for (let tx = startX; tx < endX; tx++) {
      if (isWallAt(map, tx, ty)) {
        // Box-box intersection (ship AABB vs tile AABB)
        // Ship AABB: [x-radius, y-radius] to [x+radius, y+radius]
        // Tile AABB: [tx, ty] to [tx+1, ty+1]
        if (x + radius > tx && x - radius < tx + 1 &&
            y + radius > ty && y - radius < ty + 1) {
          return true;
        }
      }
    }
  }
  return false;
}
```

### PixiJS Tilemap Rendering

```typescript
// packages/client/src/renderer.ts
// Source: @pixi/tilemap documentation + PixiJS v8 API
import { Application, Assets, Texture } from 'pixi.js';
import { CompositeTilemap } from '@pixi/tilemap';

async function createTilemap(app: Application, map: TileMap, tilesetUrl: string) {
  const tileset = await Assets.load(tilesetUrl);
  const tilemap = new CompositeTilemap();

  const TILE_SIZE = 16;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tileId = map.tiles[y * map.width + x];
      if (tileId > 0) {
        // Wall tile -- add to tilemap
        tilemap.tile(tileset, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
  }

  app.stage.addChild(tilemap);
  return tilemap;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PixiJS v7 API (new PIXI.Application) | PixiJS v8 API (Application.init(), Assets.load()) | PixiJS v8, 2024 | Different initialization pattern. v8 uses async init. |
| @pixi/tilemap v4 | @pixi/tilemap v5 (pixijs-userland) | 2024 | Moved to pixijs-userland org. Compatible with PixiJS v8. |
| Vite 5 | Vite 6 (stable) / Vite 8 (bleeding edge) | 2025-2026 | Use Vite 6 for stability. Vite 8 uses Rolldown but is very new. |

**Deprecated/outdated:**
- `PIXI.Loader` is removed in PixiJS v8. Use `Assets.load()` instead.
- `new PIXI.Application({ ... })` is deprecated. Use `const app = new Application(); await app.init({ ... })`.
- `@pixi/tilemap` v3/v4 are incompatible with PixiJS v8. Must use v5.

## Open Questions

1. **Ship sprite orientation convention**
   - What we know: SubSpace uses 40 rotation frames in its sprite sheet. Orientation 0 in the code maps to heading "right" (east).
   - What's unclear: Whether to use a sprite sheet (40+ frames) or rotate a single sprite via PixiJS transforms.
   - Recommendation: Use PixiJS rotation transform on a single sprite. Simpler, resolution-independent, and good enough for Phase 1. The original 40-frame approach was a hardware limitation of the 1990s.

2. **Map design for testing**
   - What we know: Need a playable arena with walls and corridors for 10-20 players.
   - What's unclear: Exact map layout. No design provided.
   - Recommendation: Create a simple test arena programmatically -- outer wall border, a few internal wall structures forming corridors and rooms. ~200x200 tiles. Can refine or replace with a designed map later.

3. **PHYS-04 (drag) vs authentic SubSpace behavior**
   - What we know: SubSpace has NO drag. Ships maintain velocity indefinitely.
   - What's unclear: Whether the requirement intentionally diverges from SubSpace or is a misunderstanding.
   - Recommendation: Implement the authentic speed-clamp behavior. Add an optional drag parameter (defaulting to 0) exposed via debug panel, so it can be tested but is off by default.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, bundled with Vite ecosystem) |
| Config file | `packages/shared/vitest.config.ts` -- Wave 0 |
| Quick run command | `npx vitest run --project shared` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHYS-01 | Rotation applies at correct rate, wraps at boundaries | unit | `npx vitest run packages/shared/src/__tests__/physics.test.ts -t "rotation"` | Wave 0 |
| PHYS-02 | Thrust adds velocity in facing direction | unit | `npx vitest run packages/shared/src/__tests__/physics.test.ts -t "thrust"` | Wave 0 |
| PHYS-03 | Velocity persists when thrust stops (no drag) | unit | `npx vitest run packages/shared/src/__tests__/physics.test.ts -t "inertia"` | Wave 0 |
| PHYS-04 | Speed clamp prevents exceeding max speed | unit | `npx vitest run packages/shared/src/__tests__/physics.test.ts -t "speed clamp"` | Wave 0 |
| PHYS-05 | Wall collision bounces with correct factor | unit | `npx vitest run packages/shared/src/__tests__/collision.test.ts -t "bounce"` | Wave 0 |
| PHYS-06 | SVS parameter conversions produce correct values | unit | `npx vitest run packages/shared/src/__tests__/ships.test.ts -t "conversion"` | Wave 0 |
| PHYS-07 | Afterburner increases speed cap and drains energy | unit | `npx vitest run packages/shared/src/__tests__/physics.test.ts -t "afterburner"` | Wave 0 |
| MAPS-01 | Tile map correctly identifies walls and empty space | unit | `npx vitest run packages/shared/src/__tests__/collision.test.ts -t "tilemap"` | Wave 0 |
| MAPS-02 | Arena map loads and has expected dimensions | unit | `npx vitest run packages/shared/src/__tests__/map.test.ts -t "arena"` | Wave 0 |
| MAPS-03 | JSON map format parses correctly | unit | `npx vitest run packages/shared/src/__tests__/map.test.ts -t "parse"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project shared`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/shared/vitest.config.ts` -- test framework configuration
- [ ] `packages/shared/src/__tests__/physics.test.ts` -- covers PHYS-01 through PHYS-04, PHYS-07
- [ ] `packages/shared/src/__tests__/collision.test.ts` -- covers PHYS-05, MAPS-01
- [ ] `packages/shared/src/__tests__/ships.test.ts` -- covers PHYS-06
- [ ] `packages/shared/src/__tests__/map.test.ts` -- covers MAPS-02, MAPS-03
- [ ] Framework install: `npm install -D vitest -w packages/shared`

## Sources

### Primary (HIGH confidence)
- [nullspace SubSpace client source code](https://github.com/plushmonkey/nullspace) - Reverse-engineered SubSpace physics: ShipController.cpp (thrust/rotation/afterburner), PlayerManager.cpp (SimulateAxis collision/bounce, SimulatePlayer tick rate). Verified tick rate = 100Hz, no drag, hard speed clamp.
- [SubSpace 1.34 SERVER.CFG](https://github.com/fatrolls/subgame-continuum-subspace-clone/tree/master/Open%20Source%20OLD%20SubSpace%201.34%20SubGame%20Server) - Original ship parameter values (SVS defaults) for all 8 ship types. Verified Warbird, Javelin, Spider values.
- [ASSS Wiki - Ship Settings](http://wiki.minegoboom.com/index.php/Ship_Settings) - Unit definitions for all ship configuration parameters (rotation = 90deg/s/100, speed = pixels/s/10, etc.)
- [npm registry](https://www.npmjs.com/) - Verified current versions: pixi.js 8.17.1, @pixi/tilemap 5.0.2, vite 8.0.1, typescript 5.9.3
- [TWCore SubSpace Protocol](https://www.twcore.org/SubspaceProtocol/) - Position encoding (16-bit, 0-16384 pixels = 1024 tiles), velocity units, direction byte

### Secondary (MEDIUM confidence)
- [Glenn Fiedler - Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) - Fixed timestep accumulator pattern
- [PixiJS v8 Tilemap docs](https://api.pixijs.io/@pixi/tilemap.html) - CompositeTilemap API for PixiJS v8
- [@pixi/tilemap GitHub (pixijs-userland)](https://github.com/pixijs-userland/tilemap) - v5 compatibility with PixiJS v8
- [Continuum Level Editor manual](https://continuumlt.sourceforge.net/manual/) - Tile size = 16 pixels, tileset structure

### Tertiary (LOW confidence)
- Ship radius value (14 pixels / 16 = 0.875 tiles) -- inferred from common SubSpace community knowledge, not directly verified from source code.
- Map dimension of 1024x1024 -- confirmed by protocol (position 0-16384 pixels / 16 = 1024 tiles) and collision bounds check in nullspace (`check > 1023`).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Versions verified against npm registry, PixiJS v8 + @pixi/tilemap v5 compatibility confirmed
- Architecture: HIGH - Fixed-timestep, shared physics, axis-separated collision all verified from nullspace source code
- SubSpace physics: HIGH - Formulas extracted from reverse-engineered C++ source code (nullspace), cross-referenced with SERVER.CFG default values and ASSS wiki unit definitions
- Pitfalls: HIGH - Based on verified SubSpace physics (no drag vs drag is the critical one)

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days -- stable domain, well-understood game mechanics)
