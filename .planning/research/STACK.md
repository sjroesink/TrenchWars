# Technology Stack

**Project:** TrenchWars (Browser-based SubSpace/Continuum remake)
**Researched:** 2026-03-22

## Recommended Stack

### Rendering Engine

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PixiJS | ^8.16.0 | 2D WebGL/Canvas rendering | Fastest 2D renderer in JS. 3x smaller and 2x faster than Phaser for pure rendering. We need a rendering library, not a game framework -- the game logic runs on an authoritative server, so Phaser's built-in physics/scenes/input management is wasted weight. PixiJS gives maximum control over the render pipeline for custom netcode integration. | HIGH |
| @pixi/tilemap | ^4.x | Tile-based map rendering | Purpose-built for large tilemaps with WebGL batching. Handles the 304x304 tile maps from SubSpace with good performance. Supports texture atlases for efficient GPU uploads. | HIGH |

**Why not Phaser:** Phaser is a full game framework (1.2MB) with built-in physics, scene management, and input handling. For a multiplayer game with an authoritative server, the client is a "dumb renderer" that displays server state. Phaser's game loop and physics fight against this architecture. PixiJS (450KB) lets us own the game loop and integrate client-side prediction cleanly.

**Why not raw Canvas2D:** We need glow effects, particle systems, and smooth rendering of 20+ ships at 60fps. WebGL (via PixiJS) handles this with GPU acceleration. Canvas2D would struggle with the neon-on-dark aesthetic.

### Networking / Multiplayer Server

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Colyseus | ^0.17.8 | Authoritative game server framework | Purpose-built for real-time multiplayer games on Node.js. Room-based architecture maps perfectly to arena zones. Built-in state synchronization with delta compression. Automatic reconnection in v0.17. TypeScript-first. Most mature open-source option for this exact use case. | HIGH |

**Why not geckos.io (WebRTC/UDP):** Geckos.io offers UDP-like transport via WebRTC DataChannels, which is theoretically better for fast-paced games. However: (1) WebRTC connection establishment is complex and fragile, (2) geckos.io has much smaller community/ecosystem than Colyseus, (3) Colyseus's delta-compressed state sync over WebSocket is fast enough for 20 players at 20 tick rate, (4) WebRTC adds NAT traversal complexity for deployment. The latency difference is marginal for the player counts we target.

**Why not raw WebSocket + ws:** Building state synchronization, room management, matchmaking, reconnection, and serialization from scratch is months of work. Colyseus provides all of this battle-tested. The abstraction cost is minimal -- Colyseus rooms are just classes where you write game logic.

**Why not Socket.IO:** Socket.IO adds overhead (HTTP long-polling fallback, auto-reconnection with backoff) that conflicts with game networking needs. Colyseus uses raw WebSocket under the hood, which is leaner. Socket.IO is designed for web apps, not games.

### Physics

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom physics (no library) | N/A | Ship movement, collision detection | SubSpace physics are simple and specific: rotate-and-thrust with momentum, axis-aligned tile collisions, circular bullet hitboxes. This is ~200 lines of vector math, not a general rigid-body simulation. A physics library (Matter.js, Planck.js) adds 100KB+ of unused features and makes deterministic server/client simulation harder to synchronize. | HIGH |

**Why not Matter.js or Planck.js:** These are general-purpose rigid-body engines. SubSpace ships don't interact with joints, springs, stacking, or continuous collision. The physics are: velocity += thrust * direction; position += velocity; velocity *= drag; plus AABB tile collision and circle-circle projectile collision. A full physics engine is overkill and makes deterministic replay harder.

### Language / Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TypeScript | ^5.7 | Shared game logic between client and server | Type safety across network boundaries is critical. Shared types for messages, game state, and physics constants prevent desync bugs. The entire stack is TypeScript. | HIGH |
| Node.js | ^22 LTS | Server runtime | Colyseus runs on Node.js. V22 LTS is current stable with good performance. Single language across client and server enables shared code. | HIGH |

### Build Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vite | ^6.x | Dev server + bundler | Sub-50ms HMR for rapid iteration on game feel. Native TypeScript support via esbuild transpilation. Simple config. Industry standard for new projects in 2025-2026. | HIGH |

**Why not Webpack:** Slower builds, more complex config. No advantage for a greenfield project.

### Deployment / Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Docker | latest | Container packaging | Reproducible server deployment. Colyseus server + static client assets in a single container or docker-compose. | HIGH |
| Nginx | latest | Reverse proxy + static file serving | Serves client bundle, proxies WebSocket connections to Colyseus. SSL termination. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| @colyseus/schema | ^2.x (bundled with Colyseus 0.17) | Binary state serialization | Always -- defines all synchronized game state. Automatic delta encoding. | HIGH |
| @colyseus/monitor | ^0.17.x | Server admin dashboard | Development and production monitoring of rooms, players, messages. | MEDIUM |
| howler.js | ^2.2 | Audio playback | Sound effects (weapons, explosions, thrust). Handles WebAudio API quirks and autoplay policies. Small, focused, no bloat. | MEDIUM |
| stats.js | ^0.17 | FPS/performance monitoring | Development only. Lightweight performance overlay. | LOW |
| dat.gui or lil-gui | latest | Debug parameter tweaking | Development only. Tune ship physics, weapon stats, visual effects in real-time without code changes. | LOW |

## Shared Code Strategy

A critical architectural decision: the physics simulation must run identically on server and client for client-side prediction to work.

```
packages/
  shared/          # Shared between client and server
    physics.ts     # Ship movement, collision detection
    constants.ts   # Ship stats, weapon properties, map tile types
    types.ts       # Message types, state interfaces
  client/          # PixiJS renderer, input handling, prediction
  server/          # Colyseus rooms, authoritative game loop
```

Use a monorepo with npm workspaces. The `shared` package is imported by both client and server. No framework-specific code in shared -- just pure math and type definitions.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Renderer | PixiJS v8 | Phaser 3.80+ | Framework overhead, fights authoritative server pattern |
| Renderer | PixiJS v8 | Raw Canvas2D | No GPU acceleration for glow/particle effects at scale |
| Networking | Colyseus 0.17 | geckos.io 3.0 | WebRTC complexity, smaller community, marginal latency benefit |
| Networking | Colyseus 0.17 | Raw WebSocket (ws) | Rebuilding state sync, rooms, reconnection from scratch |
| Networking | Colyseus 0.17 | Socket.IO | Designed for web apps not games, unnecessary overhead |
| Physics | Custom | Matter.js | Overkill for simple thrust/momentum, hurts determinism |
| Physics | Custom | Planck.js (Box2D port) | Same -- too heavy for the physics we need |
| Bundler | Vite 6 | Webpack 5 | Slower, more complex, no upside for greenfield |
| Audio | howler.js | Tone.js | Tone.js is for music synthesis, not game SFX |

## Version Verification

| Technology | Verified Source | Last Check |
|------------|----------------|------------|
| PixiJS 8.16.0+ | npm registry, pixijs.com/blog | 2026-03-22 |
| Colyseus 0.17.8 | npm registry, colyseus.io/blog | 2026-03-22 |
| Vite 6.x (Vite 8 exists but uses Rolldown, bleeding edge) | vite.dev | 2026-03-22 |
| Node.js 22 LTS | nodejs.org | 2026-03-22 |

**Note on Vite version:** Vite 8 (released early 2026) replaces esbuild+Rollup with Rolldown (Rust-based). It is very new. Vite 6.x is the safer choice for stability. Upgrade to Vite 8 once it matures.

## Installation

```bash
# Initialize monorepo
mkdir trench-wars && cd trench-wars
npm init -y

# Client
npm init -y -w packages/client
npm install pixi.js@^8.16.0 @pixi/tilemap howler@^2.2 -w packages/client
npm install -D vite@^6 typescript@^5.7 -w packages/client

# Server
npm init -y -w packages/server
npm install colyseus@^0.17.8 @colyseus/monitor -w packages/server
npm install -D typescript@^5.7 tsx -w packages/server

# Shared
npm init -y -w packages/shared
npm install -D typescript@^5.7 -w packages/shared

# Dev tools (root)
npm install -D lil-gui stats.js -w packages/client
```

## Key Technical Constraints

1. **Tick rate:** Server should run physics at 20Hz (50ms intervals). Clients render at 60fps and interpolate between server states. This balances server CPU with smooth visuals.

2. **State size:** With 20 players, each having position (x,y), velocity (vx,vy), rotation, ship type, and health, the state per tick is ~40 bytes/player = 800 bytes. With Colyseus delta encoding, most ticks send far less. WebSocket can handle this easily.

3. **Client-side prediction:** The client runs the same physics code as the server (from `shared/physics.ts`) to predict local player movement. Server corrections are reconciled by replaying inputs from the last acknowledged server state.

4. **Map format:** 304x304 tile grid stored as a flat Uint8Array. Tiles are: empty (0), wall (1), and potentially special types later. Loaded once on room join, not synchronized per tick.

## Sources

- [PixiJS Official Blog - v8.16.0](https://pixijs.com/blog/8.12.0)
- [PixiJS vs Phaser Comparison](https://dev.to/ritza/phaser-vs-pixijs-for-making-2d-games-2j8c)
- [Colyseus Official Site](https://colyseus.io/)
- [Colyseus 0.17 Release Blog](https://colyseus.io/blog/colyseus-017-is-here/)
- [Colyseus Documentation](https://docs.colyseus.io/)
- [geckos.io GitHub](https://github.com/geckosio/geckos.io)
- [Gabriel Gambetta - Client-Side Prediction](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html)
- [Gabriel Gambetta - Entity Interpolation](https://www.gabrielgambetta.com/entity-interpolation.html)
- [@pixi/tilemap GitHub](https://github.com/pixijs/tilemap)
- [Vite Official Docs](https://vite.dev/guide/features)
- [JS Game Rendering Benchmark](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [SubSpace Wikipedia](https://en.wikipedia.org/wiki/SubSpace_(video_game))
