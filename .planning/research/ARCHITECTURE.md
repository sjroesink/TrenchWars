# Architecture Research

**Domain:** Browser-based real-time multiplayer space combat game
**Researched:** 2026-03-22
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  Input     │  │  Renderer │  │  Predictor │  │  Network    │  │
│  │  Handler   │  │  (Canvas/ │  │  (Local    │  │  Client     │  │
│  │           │  │  WebGL)   │  │  Sim)      │  │  (WebSocket)│  │
│  └─────┬─────┘  └─────▲─────┘  └──┬───▲────┘  └──┬────▲─────┘  │
│        │              │           │   │           │    │         │
│        └──────────────┼───────────┘   │           │    │         │
│                       └───────────────┘           │    │         │
├───────────────────────────────────────────────────┼────┼─────────┤
│                    WebSocket Transport             │    │         │
│              (inputs up, snapshots down)           │    │         │
└───────────────────────────────────────────────────┼────┼─────────┘
                                                    │    │
┌───────────────────────────────────────────────────┼────┼─────────┐
│                    GAME SERVER (Node.js)           │    │         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──▼────┴───────┐ │
│  │  Physics  │  │  Game     │  │  Combat   │  │  Network      │ │
│  │  Engine   │  │  Loop     │  │  System   │  │  Server       │ │
│  │  (Shared) │  │  (Fixed   │  │  (Damage, │  │  (WebSocket)  │ │
│  │          │  │  Timestep)│  │  Collision)│  │               │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───────────────┘ │
│        │              │              │                           │
│  ┌─────┴──────────────┴──────────────┴─────────────────────┐     │
│  │                  World State (Authoritative)             │     │
│  │  Players[] | Projectiles[] | Map | Scores               │     │
│  └─────────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                    SHARED CODE (TypeScript)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Physics  │  │ Ship     │  │ Collision│  │ Protocol │        │
│  │ Sim      │  │ Config   │  │ Detection│  │ Types    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Game Loop (Server)** | Fixed-timestep authoritative simulation at 60Hz | `setInterval` or custom loop with accumulator pattern; processes inputs, steps physics, resolves combat, broadcasts snapshots |
| **Physics Engine (Shared)** | Momentum-based ship movement, thrust/rotation, projectile trajectories | Custom TypeScript module shared between client and server; deterministic with fixed dt |
| **Combat System** | Damage calculation, collision detection (ship-bullet, ship-wall, bomb-wall bounce) | Server-side authoritative; uses spatial partitioning (grid) for broad phase |
| **Network Server** | Accept connections, receive player inputs, broadcast world state snapshots | WebSocket server (ws library on Node.js); binary protocol for bandwidth efficiency |
| **Network Client** | Send inputs with sequence numbers, receive snapshots, trigger reconciliation | Browser WebSocket API; input buffer for unacknowledged inputs |
| **Predictor (Client)** | Run local physics simulation immediately on input so movement feels instant | Same shared physics code as server; replays unacknowledged inputs on reconciliation |
| **Renderer** | Draw the game world: ships, bullets, map, effects, HUD | Canvas 2D or WebGL; interpolates between snapshots for other entities |
| **Input Handler** | Capture keyboard state, package as input commands with timestamps | Polls key state each client tick; sends input packets at network send rate |
| **World State** | Single source of truth for all entity positions, velocities, health, scores | Plain TypeScript objects/arrays on server; serialized to binary for network |

## Recommended Project Structure

```
trench-wars/
├── packages/
│   ├── shared/              # Shared code (client + server)
│   │   ├── physics.ts       # Ship movement, thrust, rotation, momentum
│   │   ├── collision.ts     # Collision detection (broad + narrow phase)
│   │   ├── ships.ts         # Ship type definitions (Warbird, Javelin, Spider)
│   │   ├── weapons.ts       # Bullet/bomb properties, trajectory math
│   │   ├── map.ts           # Tile map loading, wall queries
│   │   ├── constants.ts     # Tick rate, arena size, physics constants
│   │   └── protocol.ts      # Message types, serialization/deserialization
│   │
│   ├── server/              # Authoritative game server
│   │   ├── main.ts          # Entry point, WebSocket server setup
│   │   ├── game-loop.ts     # Fixed-timestep game loop (60Hz)
│   │   ├── arena.ts         # Arena/room management, player join/leave
│   │   ├── combat.ts        # Damage resolution, kill tracking
│   │   ├── snapshot.ts      # State serialization, delta compression
│   │   ├── input-queue.ts   # Per-player input buffer with sequence numbers
│   │   └── network.ts       # WebSocket connection management
│   │
│   └── client/              # Browser client
│       ├── main.ts          # Entry point, connects to server
│       ├── renderer.ts      # Canvas/WebGL rendering pipeline
│       ├── input.ts         # Keyboard capture, input packaging
│       ├── predictor.ts     # Client-side prediction + reconciliation
│       ├── interpolator.ts  # Entity interpolation for remote players
│       ├── camera.ts        # Viewport tracking, minimap
│       ├── hud.ts           # Scoreboard, health, ship select UI
│       ├── effects.ts       # Explosions, thrust trails, glow effects
│       ├── audio.ts         # Sound effects
│       └── network.ts       # WebSocket client, message handling
│
├── assets/
│   ├── maps/                # Tile map data files
│   └── sounds/              # Audio files
│
├── package.json             # Monorepo root (npm workspaces)
└── tsconfig.json            # Shared TypeScript config
```

### Structure Rationale

- **packages/shared/:** The single most important architectural decision. Physics, collision, ship config, and protocol types must be identical on client and server. A shared package enforced by the monorepo guarantees this. Client-side prediction only works if the client runs the exact same simulation code as the server.
- **packages/server/:** Authoritative game logic that never ships to browsers. Contains the game loop, combat resolution, and snapshot broadcasting. Kept lean -- no rendering, no UI.
- **packages/client/:** Everything browser-specific: rendering, input capture, prediction/interpolation, and UI. Imports from shared but never from server.
- **Monorepo with workspaces:** TypeScript monorepo (npm workspaces or turborepo) allows shared code to be imported directly without publishing packages. Simple and well-supported.

## Architectural Patterns

### Pattern 1: Authoritative Server with Client-Side Prediction

**What:** The server runs the true game simulation. Clients send inputs (not positions). The client also runs the same simulation locally for instant feedback. When the server's authoritative state arrives, the client reconciles by accepting the server state and re-applying any inputs the server has not yet processed.

**When to use:** Always, for this project. This is non-negotiable for a competitive multiplayer shooter on the public internet.

**Trade-offs:**
- PRO: Prevents cheating (server validates all inputs, never trusts client positions)
- PRO: Responsive feel despite network latency (player sees their own movement instantly)
- CON: Requires shared simulation code between client and server
- CON: Reconciliation can cause visual "snapping" if client and server diverge significantly

**Example:**
```typescript
// Client sends input with sequence number
interface PlayerInput {
  seq: number;        // Monotonically increasing
  tick: number;       // Server tick this input targets
  rotation: number;   // -1, 0, 1 (left, none, right)
  thrust: boolean;
  fire: boolean;
}

// Client prediction loop
function onLocalInput(input: PlayerInput) {
  // 1. Send to server
  socket.send(serialize(input));
  // 2. Save in pending buffer
  pendingInputs.push(input);
  // 3. Apply locally using shared physics
  applyInput(localPlayerState, input, TICK_DT);
}

// On server snapshot received
function onServerSnapshot(snapshot: Snapshot) {
  // 1. Accept server's authoritative state
  localPlayerState = snapshot.playerState;
  // 2. Discard inputs server has acknowledged
  pendingInputs = pendingInputs.filter(i => i.seq > snapshot.lastProcessedSeq);
  // 3. Re-apply unacknowledged inputs
  for (const input of pendingInputs) {
    applyInput(localPlayerState, input, TICK_DT);
  }
}
```

### Pattern 2: Entity Interpolation for Remote Players

**What:** Other players (not the local player) are rendered slightly in the past, interpolating smoothly between the two most recent server snapshots. This eliminates jitter from irregular snapshot arrival.

**When to use:** For rendering all entities except the local player (who uses prediction).

**Trade-offs:**
- PRO: Smooth, jitter-free movement for all remote entities
- PRO: Only uses real server data, no extrapolation guesswork
- CON: Remote entities are displayed ~2 server ticks in the past (e.g., ~66ms at 30Hz send rate)
- CON: Requires buffering at least 2 snapshots before rendering

**Example:**
```typescript
// Interpolate between two snapshots
function interpolateEntity(prev: EntityState, next: EntityState, t: number): EntityState {
  return {
    x: prev.x + (next.x - prev.x) * t,
    y: prev.y + (next.y - prev.y) * t,
    rotation: lerpAngle(prev.rotation, next.rotation, t),
    // ...other fields
  };
}
```

### Pattern 3: Fixed-Timestep Game Loop with Decoupled Rendering

**What:** The server simulation runs at a fixed rate (e.g., 60Hz, dt=16.67ms). The client renders at the display's refresh rate (typically 60fps via requestAnimationFrame) but the physics simulation uses the same fixed timestep as the server. An accumulator pattern bridges real time and simulation time.

**When to use:** Always. This is the foundation for deterministic physics and correct prediction.

**Trade-offs:**
- PRO: Physics behavior is identical regardless of frame rate
- PRO: Client and server produce matching results (required for prediction)
- CON: Slight complexity in the game loop accumulator logic

### Pattern 4: Binary Protocol over WebSocket

**What:** Use a compact binary format for network messages instead of JSON. Snapshot data (positions, velocities, rotations for 20+ entities at 20-30Hz) would be enormous as JSON.

**When to use:** From the start. The network protocol is a foundational decision that is painful to change later.

**Trade-offs:**
- PRO: 5-10x smaller payloads than JSON for game state
- PRO: Lower CPU cost for serialization/deserialization
- CON: Harder to debug (not human-readable); mitigate with debug logging layer

## Data Flow

### Input Flow (Client to Server)

```
[Keyboard State Polled]
    |
    v
[Input Packaged: seq, tick, rotation, thrust, fire]
    |
    +---> [Apply Locally via Shared Physics] ---> [Render Predicted State]
    |
    v
[Send via WebSocket to Server]
    |
    v
[Server Input Queue (per player)]
    |
    v
[Server Game Loop processes input at correct tick]
    |
    v
[Server World State updated authoritatively]
```

### Snapshot Flow (Server to Clients)

```
[Server Game Loop completes tick]
    |
    v
[Serialize World State to Snapshot]
    |  (include: all entity positions/velocities/health,
    |   per-client: lastProcessedInputSeq)
    v
[Broadcast via WebSocket to all clients]
    |
    v
[Client receives snapshot]
    |
    +---> [Local Player: Reconcile (accept state, replay pending inputs)]
    |
    +---> [Remote Players: Push to interpolation buffer]
    |
    v
[Renderer interpolates remote entities, draws predicted local player]
```

### Combat Flow

```
[Player presses fire]
    |
    +---> [Client: spawn predicted bullet locally]
    |
    v
[Server: validate fire input, spawn authoritative bullet]
    |
    v
[Server: step bullet physics each tick]
    |
    v
[Server: collision check (bullet-ship, bullet-wall, bomb-wall bounce)]
    |
    +---> [Hit: apply damage, broadcast kill event]
    +---> [Miss/wall: remove bullet or bounce bomb]
    |
    v
[Snapshot includes bullet positions; clients render]
```

### Key Data Flows

1. **Player Movement:** Input captured at client tick rate -> sent to server -> server applies at simulation tick -> result in next snapshot -> client reconciles. Local player sees instant movement via prediction; remote players appear interpolated ~66ms behind.

2. **Projectile Lifecycle:** Fire input -> server spawns bullet with position/velocity -> bullet travels via server physics each tick -> collision checked each tick -> bullet appears in snapshots -> clients render. Client may spawn a predicted bullet for visual feedback, but server is authoritative on hits.

3. **Player Join/Leave:** WebSocket connect -> server assigns player ID, default ship, spawn position -> first snapshot includes new player -> all clients render new ship. On disconnect, server removes from state, next snapshot omits them.

4. **Map Data:** Loaded once at connection time (not streamed). Server and client load the same tile map. Server uses it for wall collision; client uses it for rendering and local prediction collision.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-20 players (single arena) | Single Node.js process handles everything. No optimization needed. Game loop, WebSocket server, and state all in one process. This is the v1 target. |
| 20-60 players (multiple arenas) | Multiple arena instances within one process, each with its own game loop and state. Players are assigned to an arena on join. Still single process. |
| 60-200 players (multiple servers) | Arena instances across multiple server processes. A lightweight lobby/router service directs players to the correct server. Each arena process is independent -- no cross-arena state sharing needed. |
| 200+ players | Horizontal scaling with load balancer routing WebSocket connections by arena ID to the correct server process. At this scale, consider moving to a cloud game server platform (Hathora, Rivet, or container-per-arena on Fly.io). |

### Scaling Priorities

1. **First bottleneck: CPU on the game loop.** The server simulates all physics and collision every tick. At 60Hz with 20 players and their projectiles, this is lightweight. It becomes a concern around 50+ entities with complex collision. Mitigation: spatial partitioning (grid-based broad phase), reduce snapshot send rate to 20-30Hz while simulating at 60Hz.

2. **Second bottleneck: Bandwidth.** Each snapshot goes to every player. With 20 players, 30 snapshots/sec, ~200 bytes per entity: ~120KB/s per client outbound. Manageable. At higher counts, use delta compression (only send what changed since last acknowledged snapshot).

## Anti-Patterns

### Anti-Pattern 1: Trusting Client Positions

**What people do:** Client sends "I am at position (x, y)" instead of "I pressed thrust."
**Why it's wrong:** Any player can modify their client to teleport, speed-hack, or clip through walls. The server cannot validate a position claim.
**Do this instead:** Client sends inputs only (rotation, thrust, fire). Server applies inputs to its authoritative simulation using shared physics code. Server determines resulting position.

### Anti-Pattern 2: JSON for Game State Networking

**What people do:** `JSON.stringify` the entire game state and send it every tick.
**Why it's wrong:** For 20 entities with position, velocity, rotation, health -- JSON is 2-5KB per snapshot. At 30Hz that is 60-150KB/s per client. Wasteful, high parse overhead, and includes field names redundantly.
**Do this instead:** Define a binary protocol. Use DataView/ArrayBuffer or a library like flatbuffers. Fixed-size entity records (e.g., 24 bytes each) reduce snapshots to ~500 bytes for 20 entities.

### Anti-Pattern 3: Variable Timestep Physics

**What people do:** Use `deltaTime` from `requestAnimationFrame` for physics calculations.
**Why it's wrong:** Client and server will compute different results because their frame rates differ. Client-side prediction diverges from server, causing constant correction snapping.
**Do this instead:** Fixed timestep (e.g., 1/60th second) for all physics on both client and server. Decouple rendering from physics with an accumulator pattern.

### Anti-Pattern 4: Sending Snapshots at Simulation Rate

**What people do:** Broadcast a snapshot every simulation tick (60Hz).
**Why it's wrong:** Doubles bandwidth for marginal visual improvement. Entity interpolation already smooths between snapshots.
**Do this instead:** Simulate at 60Hz, send snapshots at 20-30Hz. Clients interpolate between received snapshots. This is industry standard -- even competitive FPS games simulate at 60-128Hz but send at 20-64Hz.

### Anti-Pattern 5: Rendering Other Players with Prediction (Extrapolation)

**What people do:** Predict where other players will be based on their last known velocity.
**Why it's wrong:** Players change direction unpredictably. Extrapolation causes entities to overshoot, then snap back when the real position arrives. Looks worse than slight delay.
**Do this instead:** Entity interpolation (render in the past using real data). Accept ~66ms of visual delay for remote entities in exchange for smooth, accurate rendering.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Static file hosting (client assets) | CDN or static server serves HTML/JS/CSS/assets | Separate from game server; Nginx, Caddy, or cloud CDN |
| WebSocket reverse proxy | Traefik or Nginx proxies WSS connections to game server | Needed for TLS termination and routing in production |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client <-> Server | WebSocket (binary frames) | Inputs upstream, snapshots downstream. Connection-oriented, one socket per player. |
| Shared <-> Client | TypeScript import | Compile-time dependency only. Shared code bundled into client build. |
| Shared <-> Server | TypeScript import | Compile-time dependency only. Shared code imported directly by server. |
| Renderer <-> Game State | Direct read | Renderer reads interpolated/predicted state each frame. No event system needed. |
| Input Handler <-> Predictor | Function call | Input packaged, passed to predictor for local application, and to network for sending. |
| Arena <-> Arena | None | Arenas are fully independent. No cross-arena communication needed for v1. |

## Build Order (Dependencies)

The architecture has clear dependency layers that dictate build order:

1. **Shared physics + protocol** -- Everything depends on this. Ship movement math, collision detection, message types. Build and test this first in isolation.

2. **Server game loop + world state** -- Depends on shared physics. A headless server that simulates ships and projectiles with no networking. Validate physics are correct.

3. **Client renderer + input** -- Can be built in parallel with #2. Render a single ship, capture input, move it locally using shared physics. No networking yet.

4. **Network layer (both sides)** -- Connect client to server. Send inputs, receive snapshots. At this point you have a working multiplayer prototype.

5. **Client-side prediction + reconciliation** -- Requires working network layer. Add input buffering, sequence numbers, reconciliation logic.

6. **Entity interpolation** -- Requires snapshots flowing. Smooth rendering of remote players.

7. **Combat system** -- Requires physics and networking working. Add projectiles, collision, damage, kills.

8. **Game modes, HUD, polish** -- Scoring, teams, ship selection, respawn, minimap, effects.

## Sources

- [Gabriel Gambetta - Client-Server Game Architecture](https://www.gabrielgambetta.com/client-server-game-architecture.html) -- Definitive 4-part series on authoritative server architecture, prediction, interpolation, and lag compensation
- [Gabriel Gambetta - Client-Side Prediction and Server Reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html) -- Detailed explanation with live demo
- [Gabriel Gambetta - Entity Interpolation](https://www.gabrielgambetta.com/entity-interpolation.html) -- How to render remote entities smoothly
- [Web Game Dev - Prediction and Reconciliation](https://www.webgamedev.com/backend/prediction-reconciliation) -- Browser-specific patterns and library recommendations
- [Colyseus Framework](https://colyseus.io/) -- Reference architecture for Node.js multiplayer game servers
- [Snapshot Interpolation Library](https://github.com/geckosio/snapshot-interpolation) -- JavaScript implementation of snapshot interpolation
- [Hathora - Scalable WebSocket Architecture](https://blog.hathora.dev/scalable-websocket-architecture/) -- WebSocket scaling patterns for game servers
- [Multiplayer Networking Resources](https://github.com/0xFA11/MultiplayerNetworkingResources) -- Curated list of game networking references

---
*Architecture research for: Browser-based real-time multiplayer space combat game (SubSpace/Continuum remake)*
*Researched: 2026-03-22*
