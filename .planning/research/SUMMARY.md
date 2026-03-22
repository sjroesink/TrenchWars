# Project Research Summary

**Project:** TrenchWars
**Domain:** Browser-based real-time multiplayer arena space combat (SubSpace/Continuum remake)
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

TrenchWars is a browser-based remake of SubSpace/Continuum's Trench Wars zone -- a fast-paced 2D multiplayer space combat game with momentum-based ship movement, projectile weapons, and tile-based arena maps. Experts build this type of game with an authoritative server architecture: the server runs the true physics simulation, clients send only inputs, and client-side prediction with server reconciliation provides responsive feel despite network latency. The entire physics and collision system must be shared code between client and server, structured as a TypeScript monorepo. The recommended stack is PixiJS for WebGL rendering, Colyseus for the game server framework, and custom physics (not a library) since SubSpace's movement model is simple but specific.

The recommended approach is to build in layers following architectural dependencies: shared physics first, then server game loop, then client rendering, then networking, then combat. The single most important thing to get right early is the ship movement "feel" -- SubSpace's identity IS its physics, and a technically perfect game with wrong-feeling movement is a failed remake. Build a single-player physics playground before any networking code and validate with SubSpace players.

The key risks are: (1) TCP head-of-line blocking making combat feel laggy under real network conditions -- mitigate by designing a transport abstraction layer from day one that can later support WebRTC DataChannels; (2) variable timestep physics causing client-server divergence and rubber-banding -- mitigate with fixed-timestep simulation from the start; (3) implementing prediction without reconciliation, which produces worse results than no prediction at all -- implement the full Gambetta netcode stack (prediction + reconciliation + interpolation) as a unit, never partially.

## Key Findings

### Recommended Stack

The stack is TypeScript throughout, with a monorepo (npm workspaces) holding three packages: shared, client, and server. This structure is non-negotiable because client-side prediction requires identical physics code on both sides. See [STACK.md](./STACK.md) for full rationale and alternatives considered.

**Core technologies:**
- **PixiJS v8** (rendering) -- fastest 2D WebGL renderer, 3x smaller than Phaser, gives full control over the render pipeline for custom netcode integration
- **Colyseus v0.17** (game server) -- purpose-built Node.js multiplayer framework with room-based architecture, delta-compressed state sync, and automatic reconnection
- **Custom physics** (no library) -- SubSpace physics are ~200 lines of vector math; a general physics engine adds unused complexity and hurts deterministic client/server simulation
- **TypeScript v5.7** (language) -- type safety across network boundaries prevents desync bugs; shared types for messages and game state
- **Vite v6** (build) -- fast HMR for iterating on game feel; use v6 for stability, not bleeding-edge v8
- **howler.js** (audio) -- focused SFX library that handles WebAudio quirks and autoplay policies

### Expected Features

The MVP must validate that SubSpace-style combat works in a browser. Feature scope is deliberately narrow -- get one ship feeling perfect before expanding. See [FEATURES.md](./FEATURES.md) for the full prioritization matrix and dependency graph.

**Must have (table stakes -- P1):**
- Momentum-based ship movement (rotate + thrust with inertia) -- this IS the game
- Real-time multiplayer with client-side prediction and entity interpolation
- Bullet weapons with travel time and server-authoritative hit detection
- One tile-based map with walls and collision
- Free-for-all deathmatch mode
- Energy system (unified health + ammo)
- Kill/death scoreboard, respawn system, radar/minimap
- Basic sound effects
- Instant play with no account required

**Should have (differentiators -- P2):**
- Bombs with wall-bouncing mechanics -- unique to SubSpace, deep tactical play
- Additional ship types (Javelin, Spider) -- variety after Warbird is perfected
- Team arena mode (elimination rounds) -- structured competitive play
- Modern neon vector visual effects (glow, particles, trails)
- Chat system, afterburners, spectator mode

**Defer (v2+):**
- Ship attachment/turret system, powerup pickups, special weapons, persistent accounts, squad system, map editor, all 8 ship types, flag capture mode

**Anti-features (do not build):**
- Mobile/touch controls (compromises the keyboard control feel that defines the game)
- In-match weapon leveling (destroys SubSpace's skill-based identity)
- Matchmaking/SBMM (requires large player base; use persistent arenas instead)

### Architecture Approach

The architecture follows the standard authoritative-server-with-client-prediction pattern used by all competitive multiplayer games. The server runs a fixed-timestep game loop (60Hz simulation, 20-30Hz snapshot broadcast), processes player inputs, steps physics, resolves combat, and broadcasts state. Clients send inputs with sequence numbers, predict locally using shared physics, reconcile on server snapshots, and interpolate remote entities. See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed data flow diagrams and component responsibilities.

**Major components:**
1. **Shared physics module** -- ship movement, collision detection, ship configs, protocol types; imported identically by client and server
2. **Server game loop + world state** -- fixed-timestep authoritative simulation; processes input queues, steps physics, resolves combat, serializes snapshots
3. **Client predictor + interpolator** -- runs shared physics locally for instant feedback; reconciles with server state; interpolates remote entities between snapshots
4. **Client renderer** -- PixiJS WebGL pipeline; draws ships, projectiles, map, effects, HUD; decoupled from physics tick rate
5. **Network layer** -- WebSocket transport with binary protocol; transport-agnostic abstraction to allow future WebRTC upgrade

### Critical Pitfalls

The top 5 pitfalls from [PITFALLS.md](./PITFALLS.md), all rated HIGH confidence:

1. **TCP head-of-line blocking** -- WebSocket over TCP causes 50-200ms freezes on packet loss. Design a transport abstraction layer from day one; start with WebSocket, plan WebRTC DataChannels for position/combat updates later. Test with network simulation early.
2. **Variable timestep physics** -- Using rAF delta time causes client/server divergence and rubber-banding. Use fixed-timestep simulation (Glenn Fiedler's "Fix Your Timestep" pattern) on both sides from the start.
3. **Prediction without reconciliation** -- Half-implementing netcode is worse than no prediction. Implement the full Gambetta stack (prediction + reconciliation + interpolation) as a single unit.
4. **Trusting the client** -- Browser games are trivially exploitable. Server must accept only raw inputs, run its own physics and hit detection, and validate all inputs against physical constraints.
5. **Node.js GC pauses disrupting game loop** -- setInterval is not accurate enough; GC pauses cause tick bunching. Use high-resolution timer loop with accumulator pattern; minimize per-tick allocations with object pooling.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Shared Foundation and Ship Physics

**Rationale:** Everything depends on the shared physics module. The architecture research identifies it as the first build dependency. The pitfalls research warns that SubSpace's "feel" must be validated before anything else -- a technically perfect game with wrong physics is a failed remake.
**Delivers:** Monorepo structure, shared physics module (thrust, rotation, momentum, drag), collision detection (ship-wall), single-ship physics playground running in browser.
**Addresses:** Momentum-based ship movement (P1), tile-based map with walls (P1), energy system (P1)
**Avoids:** Variable timestep (Pitfall 2), physics divergence (Pitfall 7), ignoring SubSpace feel (Pitfall 8)

### Phase 2: Server Game Loop and Networking Foundation

**Rationale:** Architecture research shows the server game loop depends on shared physics, and networking depends on the game loop. The networking pitfalls (TCP HOL, prediction without reconciliation, trusting client) must all be addressed together at the architectural level.
**Delivers:** Authoritative server with fixed-timestep game loop, WebSocket transport with abstraction layer, input processing, snapshot broadcasting, client-side prediction with full reconciliation, entity interpolation.
**Addresses:** Real-time multiplayer (P1), client-side prediction + interpolation (P1)
**Avoids:** TCP HOL blocking (Pitfall 1), prediction without reconciliation (Pitfall 3), trusting client (Pitfall 4), GC pauses (Pitfall 5)

### Phase 3: Combat System

**Rationale:** Weapons and combat depend on both physics (projectile trajectories, collision) and networking (server-authoritative hit detection, lag compensation). Must come after phases 1 and 2.
**Delivers:** Bullet weapons with travel time, server-authoritative hit detection, damage/energy system, kill tracking, respawn system, projectile rendering.
**Addresses:** Bullet weapons (P1), energy system (P1), respawn system (P1), kill/death scoreboard (P1)
**Avoids:** Tile collision performance (Pitfall 12) -- use spatial partitioning for projectile-wall collision

### Phase 4: Game Experience and Polish

**Rationale:** HUD, audio, radar, and visual effects are low-complexity features that depend on the core game working. Grouping them into a polish phase avoids premature optimization and keeps earlier phases focused.
**Delivers:** Radar/minimap, scoreboard HUD, sound effects, instant play (no-account entry), ship selection (single ship for now), basic visual effects.
**Addresses:** Radar/minimap (P1), scoreboard (P1), sound effects (P1), instant play (P1)
**Avoids:** Canvas rendering performance (Pitfall 9) -- validate PixiJS performance at target entity count

### Phase 5: Extended Combat and Ship Variety

**Rationale:** Bombs and additional ships build on the proven combat system. Bombs require wall collision (Phase 1) and the projectile system (Phase 3). Additional ships are parameterized variants of the Warbird.
**Delivers:** Bomb weapons with wall bouncing, Javelin and Spider ship types, ship selection UI, afterburners.
**Addresses:** Bombs (P2), ship types (P2), ship selection UI (P2), afterburners (P2)

### Phase 6: Team Play and Social Features

**Rationale:** Team mode requires all individual gameplay systems to be working. Chat and spectator mode are social features that drive retention after core gameplay is proven.
**Delivers:** Team arena mode (elimination rounds), team assignment, chat system (team + all), spectator mode.
**Addresses:** Team arena mode (P2), chat system (P2), spectator mode (P2)

### Phase 7: Optimization and Production Readiness

**Rationale:** Optimization should come after features stabilize. Delta compression, binary protocol optimization, reconnection handling, and deployment infrastructure.
**Delivers:** Delta-compressed snapshots, binary protocol optimization, reconnection with session tokens, Docker deployment, production monitoring.
**Avoids:** Full state broadcasts (Pitfall 6), JSON overhead (Pitfall 11), disconnect handling (Pitfall 10)

### Phase Ordering Rationale

- **Phases 1-2 are strictly ordered by dependency:** shared physics must exist before the server can use it; the server must exist before networking can connect to it.
- **Phase 3 depends on both 1 and 2:** combat needs physics for projectile simulation and networking for authoritative hit detection.
- **Phase 4 is independent of 3** and could theoretically be parallelized, but grouping polish after combat ensures the core game loop is working before investing in UX.
- **Phases 5-6 add breadth** to a working game. They are ordered by dependency (bombs need wall collision before team mode needs bombs).
- **Phase 7 is deliberately last** because optimization before stability wastes effort. The architecture is designed to support these optimizations (transport abstraction, Colyseus delta encoding), so deferring them is safe.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Networking):** The transport abstraction layer design (WebSocket now, WebRTC later) needs careful interface design. Colyseus's built-in state sync may or may not be sufficient for the binary protocol needs -- evaluate whether to use Colyseus schema or a custom binary protocol.
- **Phase 3 (Combat):** Lag compensation for projectile hit detection is the hardest networking problem. Research server-side hit validation approaches (rewind-and-check vs. favor-the-shooter).
- **Phase 5 (Bombs):** Wall-bounce physics and explosion radius damage are domain-specific. Reference original SubSpace .cfg files for exact bounce coefficients.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Physics):** Well-documented fixed-timestep patterns (Fiedler, Gambetta). SubSpace physics parameters available from reverse engineering sources.
- **Phase 4 (Polish):** Standard PixiJS rendering, howler.js audio, HTML overlay for HUD. No novel engineering.
- **Phase 6 (Teams/Social):** Standard room-based team assignment in Colyseus. Chat is trivial over existing WebSocket.
- **Phase 7 (Optimization):** Well-documented patterns for delta compression, binary serialization, reconnection.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended technologies are mature, well-documented, and widely used for this exact type of project. PixiJS v8 and Colyseus v0.17 are current stable releases. |
| Features | HIGH | SubSpace mechanics are thoroughly documented. MVP scope is conservative and well-scoped. Anti-features are clearly identified. |
| Architecture | HIGH | Authoritative server with client prediction is the industry-standard pattern for this genre, documented extensively by Gambetta and Fiedler. |
| Pitfalls | HIGH | All critical pitfalls are well-known in game networking literature with established prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Colyseus schema vs custom binary protocol:** STACK.md recommends Colyseus with its built-in schema serialization, but PITFALLS.md and ARCHITECTURE.md emphasize binary protocols and warn against JSON. Evaluate during Phase 2 whether Colyseus's @colyseus/schema (which IS binary with delta compression) meets performance needs, or whether a fully custom protocol is needed. Recommendation: start with Colyseus schema, benchmark, and replace only if insufficient.
- **Server simulation tick rate:** STACK.md says 20Hz, FEATURES.md says 60Hz, ARCHITECTURE.md says 60Hz sim / 20-30Hz broadcast. The correct answer is 60Hz simulation with 20-30Hz snapshot send rate, but this needs explicit confirmation during Phase 2 implementation.
- **WebRTC timeline:** PITFALLS.md identifies TCP HOL blocking as critical but the recommended stack is WebSocket-only (Colyseus). The mitigation is a transport abstraction layer, but the actual WebRTC implementation is not scoped in any phase. This is acceptable if WebSocket proves sufficient at target player counts (20 players), but should be monitored during playtesting.
- **SubSpace physics parameter accuracy:** The exact physics constants (rotation speed, thrust acceleration, drag, bullet speed, bounce factor) need to be extracted from original SubSpace .cfg files or reverse-engineering sources. This is a research task for Phase 1.

## Sources

### Primary (HIGH confidence)
- [Gabriel Gambetta - Client-Server Game Architecture](https://www.gabrielgambetta.com/client-server-game-architecture.html) -- authoritative server pattern, prediction, reconciliation, interpolation
- [Gaffer on Games - Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) -- fixed timestep simulation pattern
- [Gaffer on Games - Game Networking](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/) -- networking fundamentals
- [Colyseus Documentation](https://docs.colyseus.io/) -- server framework API and patterns
- [PixiJS Official](https://pixijs.com/) -- rendering library documentation

### Secondary (MEDIUM confidence)
- [Web Game Dev - Prediction & Reconciliation](https://www.webgamedev.com/backend/prediction-reconciliation) -- browser-specific netcode patterns
- [Rune Developer Blog](https://developers.rune.ai/blog/) -- WebRTC vs WebSocket comparison, performance optimization
- [Hathora Blog - Scalable WebSocket Architecture](https://blog.hathora.dev/scalable-websocket-architecture/) -- scaling patterns
- [SubSpace Reverse Engineering](https://sharvil.nanavati.net/projects/subspace/) -- original game physics parameters

### Tertiary (LOW confidence)
- [SubSpace Wikipedia](https://en.wikipedia.org/wiki/SubSpace_(video_game)) -- general game history and mechanics overview
- [Trench Wars Steam Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=474916946) -- gameplay mechanics description

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
