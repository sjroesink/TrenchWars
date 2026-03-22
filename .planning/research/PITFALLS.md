# Domain Pitfalls

**Domain:** Browser-based real-time multiplayer space combat game (SubSpace/Continuum remake)
**Researched:** 2026-03-22

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: TCP Head-of-Line Blocking Kills Combat Feel

**What goes wrong:** WebSocket runs over TCP, which guarantees ordered delivery. When a single packet is lost, ALL subsequent packets are held until retransmission completes. In a fast-paced combat game with momentum-based physics, this causes periodic freezes of 50-200ms -- enough to make ship movement feel unresponsive and aiming impossible. Players will describe the game as "laggy" even on good connections.

**Why it happens:** Developers default to WebSocket because it is simple and well-documented. TCP head-of-line blocking is invisible during local development (localhost has zero packet loss) and only manifests under real network conditions with 1-5% packet loss.

**Consequences:** Combat feels unresponsive at any non-trivial latency. Players leave. Switching transport protocol late requires rearchitecting the entire networking layer.

**Prevention:** Plan for WebRTC DataChannels (unreliable/unordered mode) from the start for position/velocity updates and combat actions. Use WebSocket only for reliable messages (chat, scoreboard, arena join/leave). The signaling handshake adds complexity but is a one-time cost. WebRTC RTT clusters around 40-50ms vs WebSocket's 80-90ms in real conditions. Design the message protocol with transport-agnostic abstractions so you can start with WebSocket-only for development simplicity, then add WebRTC as an optimization -- but architect the abstraction layer from day one.

**Detection:** Test with network condition simulation (Chrome DevTools throttling, or `tc netem` on a Linux test server) early. If the game stutters at 2% packet loss, you have this problem.

**Phase relevance:** Must be addressed in the networking foundation phase. The transport abstraction layer is architectural -- retrofitting it is painful.

**Confidence:** HIGH (multiple authoritative sources: [Gaffer on Games](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/), [Web Game Dev - WebRTC](https://www.webgamedev.com/backend/webrtc), [Rune - WebRTC vs WebSockets](https://developers.rune.ai/blog/webrtc-vs-websockets-for-multiplayer-games))

---

### Pitfall 2: Variable Timestep Physics Causes Ship Movement Divergence

**What goes wrong:** Using `requestAnimationFrame`'s variable delta time directly for physics updates causes ship positions to differ between client and server, and between clients running at different frame rates. A ship thrusting for "the same duration" arrives at different positions depending on whether the machine runs at 60fps or 144fps. This breaks client-side prediction, causes constant rubber-banding corrections, and makes the game feel unreliable.

**Why it happens:** The naive approach is to multiply velocity by `deltaTime` each frame. This seems correct but accumulates floating-point error differently at different frame rates. SubSpace's physics (thrust, rotation, momentum, wall bouncing at 80% speed) are particularly sensitive because small position errors compound through momentum.

**Consequences:** Client prediction never matches server state. Ships teleport/rubber-band constantly. Bullet hit detection becomes unreliable. The core "feel" of SubSpace movement is destroyed.

**Prevention:** Use a fixed-timestep physics simulation on both client and server (e.g., 60 updates/second at exactly 16.667ms per tick). On the client, accumulate real elapsed time and step the physics simulation in fixed increments, interpolating the visual rendering for the remainder. On the server, use the same fixed timestep. This is the "Fix Your Timestep" pattern from Glenn Fiedler. Both client and server must use identical physics code -- share the simulation as a common module.

**Detection:** Run two clients side-by-side with different frame rate caps (60fps vs 144fps). If a ship following identical inputs ends up in different positions, you have this problem.

**Phase relevance:** Must be correct in the physics/movement foundation phase. Retrofitting fixed timestep into variable timestep physics requires rewriting the entire simulation.

**Confidence:** HIGH ([Glenn Fiedler's Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/), [Isaac Sukin - JS Game Loops](https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing))

---

### Pitfall 3: Naive Client-Side Prediction Without Reconciliation

**What goes wrong:** Client-side prediction (applying inputs locally before server confirmation) is implemented, but server reconciliation is not. When the server's authoritative state arrives and differs from the client's predicted state, the ship snaps to the corrected position. This creates constant visible teleportation that is worse than having no prediction at all.

**Why it happens:** Client-side prediction is well-documented and conceptually simple. Server reconciliation (replaying unacknowledged inputs on top of the server's corrected state) is harder to implement and less well-explained. Developers implement the first half and stop.

**Consequences:** Ship movement feels terrible -- either delayed (no prediction) or jerky (prediction without reconciliation). Players perceive the game as broken.

**Prevention:** Implement the full Gabriel Gambetta netcode stack as a unit:
1. **Client-side prediction**: Apply inputs immediately on client
2. **Server reconciliation**: When server state arrives, rewind to that state and replay all inputs the server hasn't yet acknowledged (using input sequence numbers)
3. **Entity interpolation**: Render other players' ships by interpolating between the two most recent server snapshots (showing them slightly in the past, typically one server tick behind)

All three must work together. Do not ship prediction without reconciliation. Keep a buffer of recent inputs (tagged with sequence numbers) on the client. When the server acknowledges input N, discard inputs 1..N and re-simulate N+1..current on top of the server state.

**Detection:** Play the game with 80ms artificial latency. If your own ship visibly snaps/jumps, reconciliation is broken. If other ships move in discrete jumps rather than smoothly, interpolation is broken.

**Phase relevance:** Core networking phase. These three systems are interdependent and must be designed together.

**Confidence:** HIGH ([Gabriel Gambetta - Client-Server Architecture](https://www.gabrielgambetta.com/client-server-game-architecture.html), [Gabriel Gambetta - Prediction & Reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html), [Gabriel Gambetta - Entity Interpolation](https://www.gabrielgambetta.com/entity-interpolation.html))

---

### Pitfall 4: Trusting the Client in an Authoritative Server Architecture

**What goes wrong:** The project specifies an authoritative server, but in practice developers leak authority to the client for convenience. Common leaks: client sends "I hit player X" instead of "I fired at angle Y"; client sends position updates instead of inputs; client reports its own health/score. Any client-authoritative data is trivially exploitable via browser DevTools.

**Why it happens:** It is much simpler to have the client compute outcomes and report them. The authoritative approach requires the server to simulate the entire game world, which is more complex. Under time pressure, developers take shortcuts.

**Consequences:** Speed hacks, teleportation, infinite health, aimbot -- all trivially achievable by modifying JavaScript in the browser console. Browser games are uniquely vulnerable because the entire client code is inspectable and modifiable. A single cheater ruins the experience for everyone in the arena.

**Prevention:** The server must:
- Accept ONLY raw inputs (thrust on/off, rotation direction, fire pressed) with timestamps
- Run its own physics simulation to determine positions
- Perform its own hit detection for bullets/bombs
- Validate all inputs against physical constraints (e.g., reject movement faster than max thrust, reject firing faster than weapon cooldown)
- Never trust client-reported positions, health, scores, or hit claims
- Rate-limit inputs to prevent input flooding

The client should be treated as a dumb terminal that sends inputs and renders server state (with prediction for responsiveness).

**Detection:** Open browser DevTools and try to modify game state variables. If you can give yourself infinite health or teleport by changing JavaScript variables, the server is not truly authoritative.

**Phase relevance:** Must be the foundational design principle from the very first networking code. Bolting on server authority after building client-authoritative code requires a complete rewrite.

**Confidence:** HIGH ([Mirror Networking - Cheats](https://mirror-networking.gitbook.io/docs/security/cheating), [Genieee - HTML5 Game Security](https://genieee.com/top-security-risks-in-html5-multiplayer-games-and-how-to-fix-them/))

---

### Pitfall 5: Node.js Game Loop Timing and GC Pauses

**What goes wrong:** The server game loop uses `setInterval(tick, 16)` for a 60Hz tick rate. Node.js timers are only accurate to ~16ms and can drift significantly. Worse, V8 garbage collection pauses of 10-50ms randomly interrupt the game loop, causing tick bunching (multiple ticks fire in rapid succession after a GC pause). This creates inconsistent physics simulation on the server, which propagates to all clients as jitter.

**Why it happens:** JavaScript was not designed for deterministic real-time simulation. `setInterval` is adequate for UI updates but not for physics engines. GC is non-deterministic and developers don't notice it during low-load testing.

**Consequences:** Server physics becomes inconsistent under load. Ships periodically stutter for all players simultaneously (since the server is authoritative). The problem gets worse as player count increases (more objects = more GC pressure).

**Prevention:**
- Use a high-resolution timer loop instead of `setInterval`: measure elapsed time with `process.hrtime.bigint()` or `performance.now()` and step the simulation in fixed increments (same accumulator pattern as the client)
- Minimize per-tick allocations: reuse objects, use object pools for bullets/explosions, avoid creating new arrays/objects in the hot path
- Consider `--max-old-space-size` and `--expose-gc` flags for manual GC scheduling during natural pauses (between rounds)
- Profile with `--trace-gc` to understand GC frequency and duration under load
- If GC pauses remain problematic at scale, consider writing the game simulation in Rust/C++ compiled to a native Node addon, keeping Node only for networking

**Detection:** Log tick duration and inter-tick intervals. If you see ticks taking >5ms or inter-tick gaps >25ms (for a 16ms target), you have timing issues. Load test with 20+ simulated players.

**Phase relevance:** Server architecture phase. The game loop implementation is foundational.

**Confidence:** HIGH ([node-game-loop](https://github.com/timetocode/node-game-loop), [RisingStack - Node.js GC](https://blog.risingstack.com/node-js-at-scale-node-js-garbage-collection/))

---

## Moderate Pitfalls

### Pitfall 6: Sending Full Game State Every Tick

**What goes wrong:** The server broadcasts the complete game state (all player positions, velocities, rotations, bullet positions, etc.) to every client on every tick. With 20 players, 8 ship properties each, and bullets in flight, this quickly exceeds bandwidth limits. At 60 ticks/second, even modest state sizes become prohibitive.

**Prevention:**
- **Delta compression**: Send only properties that changed since the client's last acknowledged snapshot
- **Interest management / spatial culling**: Only send updates for entities within a player's radar range or viewport (relevant for large maps)
- **Binary serialization**: Use ArrayBuffer/DataView or a binary format (FlatBuffers, MessagePack) instead of JSON. A position update in JSON is ~80 bytes; in binary it is ~12 bytes
- **Reduce tick rate for distant entities**: Full 60Hz updates for nearby ships, 10Hz for distant ones
- **Quantize values**: Ship angle can be a uint16 (0-65535) instead of a float64

**Detection:** Monitor WebSocket bandwidth per client. If it exceeds 50KB/s with 20 players, optimization is needed.

**Phase relevance:** Networking optimization phase, after core networking works. Start with full state for simplicity, but architect with delta compression in mind.

**Confidence:** HIGH ([Gaffer on Games - State Synchronization](https://gafferongames.com/post/state_synchronization/), [Gaffer on Games - Snapshot Compression](https://gafferongames.com/post/snapshot_compression/))

---

### Pitfall 7: Shared Physics Code Divergence Between Client and Server

**What goes wrong:** The client and server each have their own implementation of ship physics. Over time, bug fixes or tweaks are applied to one but not the other. The implementations gradually diverge, causing client prediction to never match server state. Every frame, reconciliation corrects the position, creating persistent jitter.

**Prevention:**
- Extract all physics/simulation code into a shared module that is imported identically by client and server (e.g., a shared TypeScript package in a monorepo)
- Physics code must be pure functions with no dependency on client-only or server-only APIs (no `window`, no `process`)
- Run the same test suite against the shared physics to verify determinism
- Never duplicate physics logic -- if you find yourself writing the same calculation twice, refactor into the shared module

**Detection:** Run identical input sequences through client and server physics independently. Compare output states. Any divergence means the code has drifted.

**Phase relevance:** Project structure phase. The monorepo/shared-code architecture must be established before any physics code is written.

**Confidence:** HIGH (well-established pattern in multiplayer game development)

---

### Pitfall 8: Ignoring the SubSpace "Feel" in Favor of Technical Correctness

**What goes wrong:** The game is technically functional -- ships move, bullets fire, multiplayer works -- but the movement doesn't "feel" like SubSpace. The rotation speed is wrong, thrust acceleration is off, momentum decay is too fast or too slow, bullets don't inherit ship velocity correctly. Players who know SubSpace will immediately feel the difference and leave.

**Why it happens:** Developers focus on networking, rendering, and architecture (the hard technical problems) and treat physics tuning as a polish task. But SubSpace's identity IS its physics feel. A technically perfect game with wrong-feeling physics is a failed SubSpace remake.

**Consequences:** The core value proposition fails. The game might work as "a space shooter" but fails as "a SubSpace remake."

**Prevention:**
- Study SubSpace physics parameters early: rotation speed, thrust acceleration, max speed, bullet speed, bullet inherit velocity percentage, bomb bounce factor (80% of initial speed off walls), ship drag/friction coefficients
- Reference the SubSpace settings file format (`.cfg` files from server zones) which explicitly defines all physics parameters
- Build a single-player physics playground before any networking code -- get one ship feeling right before adding complexity
- Have SubSpace/Continuum players playtest the physics specifically (not just the game overall) in the earliest possible phase
- The original game uses integer math for positions (in pixels) with sub-pixel precision stored as fixed-point. Consider whether to replicate this or use floating-point with careful tuning

**Detection:** Load up Continuum, play Trench Wars for 30 minutes, then immediately play your game. The difference should be minimal. If it feels "off," the physics parameters need tuning.

**Phase relevance:** The very first phase. Ship movement feel must be validated before building networking, rendering, or anything else on top of it.

**Confidence:** HIGH (domain-specific knowledge from [SubSpace Wikipedia](https://en.wikipedia.org/wiki/SubSpace_(video_game)), [SubSpace reverse engineering](https://sharvil.nanavati.net/projects/subspace/))

---

### Pitfall 9: Canvas Rendering Performance at Scale

**What goes wrong:** Using Canvas 2D for rendering works fine with 2-3 ships but degrades badly with 20+ ships, hundreds of bullets, glow effects, and particle systems. Draw calls accumulate, fillRect/arc calls are not batched, and the per-frame JavaScript overhead of iterating over every entity becomes a bottleneck. Firefox performance is notably worse than Chrome for Canvas/WebGL workloads.

**Prevention:**
- Use WebGL (via a library like PixiJS) instead of raw Canvas 2D for rendering. WebGL batches draw calls and uses GPU acceleration natively
- Even with WebGL: minimize state changes, batch sprites by texture atlas, avoid per-frame object allocation for render lists
- Use spatial partitioning to cull off-screen entities from the render pass
- Profile rendering separately from game logic: use `performance.mark()` and Chrome DevTools Performance panel
- Be aware that high-DPI displays (4K) can halve frame rates. Consider rendering at a lower internal resolution and scaling up

**Detection:** Run with 20 simulated ships and 100 bullets. If frame time exceeds 8ms (leaving no room for physics + networking), rendering optimization is needed.

**Phase relevance:** Rendering foundation phase. Choosing Canvas 2D vs WebGL (or a library) is an early architectural decision.

**Confidence:** MEDIUM (based on multiple reports of Canvas 2D performance issues at scale, but the specific threshold depends on implementation: [PixiJS issue #4789](https://github.com/pixijs/pixijs/issues/4789), [HTML5GameDevs forums](https://www.html5gamedevs.com/topic/31441-i-am-stuck-in-low-fps/))

---

### Pitfall 10: WebSocket Connection Management and Reconnection

**What goes wrong:** Players lose WebSocket connections due to mobile network switches, ISP hiccups, laptop sleep/wake, or browser tab backgrounding. The game treats a disconnect as permanent -- the player loses their ship, score, and arena position. Players must rejoin from scratch, which is infuriating in a persistent arena game.

**Prevention:**
- Implement connection state machine: CONNECTED -> DISCONNECTING -> RECONNECTING -> CONNECTED
- Assign session tokens on first connect. On reconnect, client presents the token and the server restores state (ship position, score, team assignment)
- Keep disconnected player state alive on the server for a grace period (30-60 seconds). Their ship can be made invulnerable or removed, but state persists
- Implement heartbeat/ping-pong to detect dead connections proactively (don't wait for TCP timeout, which can take minutes)
- Handle browser tab backgrounding: `requestAnimationFrame` stops when tabs are hidden. Use `document.visibilitychange` to detect this and pause client-side prediction, resync on return

**Detection:** Test by killing the WebSocket connection mid-game (Network tab in DevTools), then reopening. If the player experience is not seamless, reconnection logic needs work.

**Phase relevance:** Networking phase, but can be added incrementally after basic connectivity works.

**Confidence:** MEDIUM (common web application pattern, well-documented)

---

## Minor Pitfalls

### Pitfall 11: JSON Message Serialization Overhead

**What goes wrong:** Using JSON for all network messages (the path of least resistance in JavaScript) adds substantial overhead: property names are repeated in every message, numbers are transmitted as strings, and parsing allocates new objects that pressure the GC.

**Prevention:** Use binary serialization for high-frequency messages (position updates, inputs). Keep JSON for low-frequency messages (chat, arena join) where readability aids debugging. ArrayBuffer + DataView is zero-dependency and sufficient. Define a simple binary protocol: message type byte + fixed-layout fields.

**Detection:** Profile serialization/deserialization time and measure message sizes. If encoding takes >0.5ms per tick or messages exceed 200 bytes for a simple position update, switch to binary.

**Phase relevance:** Networking optimization phase.

**Confidence:** HIGH

---

### Pitfall 12: Tile Map Collision Detection Performance

**What goes wrong:** Checking bullet and ship collisions against every wall tile in a 304x304 map on every physics tick becomes a bottleneck, especially with multiple bullets in flight. Naive O(n*m) collision between n entities and m wall tiles kills server performance.

**Prevention:**
- Pre-process the tile map into a spatial data structure (grid-based spatial hash matching tile size is natural and trivial for tile maps)
- Only check collision against tiles near each entity (the 3x3 grid around the entity's current tile position)
- For bullets: use raycasting along the bullet's trajectory to find wall intersection rather than discrete position checks (prevents bullets tunneling through thin walls at high speed)

**Detection:** Profile the collision detection function under load. If it consumes >2ms per tick with 20 players and active combat, optimize.

**Phase relevance:** Physics/map phase.

**Confidence:** HIGH (standard game development practice)

---

### Pitfall 13: Not Planning for Arena Isolation

**What goes wrong:** Building the server as a monolith where all players share one game loop. This means a bug or performance issue in one arena affects all players. It also makes scaling to multiple arenas difficult without a complete restructuring.

**Prevention:** Design each arena as an isolated game instance from the start: its own game loop, its own entity state, its own tick. Arenas can run in the same Node process (each as a class instance) or in separate worker threads / processes. The key is logical isolation so that one arena crashing or lagging doesn't affect others.

**Detection:** If you cannot spin up a second arena without duplicating the entire server, the architecture is too coupled.

**Phase relevance:** Server architecture phase.

**Confidence:** MEDIUM

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Ship movement/physics | Variable timestep (Pitfall 2), wrong feel (Pitfall 8) | Fixed timestep from day one; build physics playground first |
| Networking foundation | TCP head-of-line (Pitfall 1), no reconciliation (Pitfall 3), trusting client (Pitfall 4) | Transport abstraction layer; implement full prediction/reconciliation/interpolation stack; server-authoritative from start |
| Server architecture | GC pauses (Pitfall 5), monolithic arenas (Pitfall 13) | High-res timer loop with object pooling; arena isolation |
| Rendering | Canvas performance (Pitfall 9) | Use WebGL/PixiJS; profile at target entity count early |
| Optimization | Full state broadcasts (Pitfall 6), JSON overhead (Pitfall 11) | Delta compression + binary serialization; can be deferred but architect for it |
| Shared code | Physics divergence (Pitfall 7) | Monorepo with shared physics module from project start |
| Multiplayer polish | Disconnect handling (Pitfall 10) | Session tokens + grace period; test with real network conditions |
| Map/collision | Tile collision perf (Pitfall 12) | Spatial partitioning; raycast for fast-moving projectiles |

## Sources

- [Gaffer on Games - What Every Programmer Needs to Know About Game Networking](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/)
- [Gaffer on Games - State Synchronization](https://gafferongames.com/post/state_synchronization/)
- [Gaffer on Games - Snapshot Compression](https://gafferongames.com/post/snapshot_compression/)
- [Gaffer on Games - Floating Point Determinism](https://gafferongames.com/post/floating_point_determinism/)
- [Gabriel Gambetta - Client-Server Game Architecture](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- [Gabriel Gambetta - Client-Side Prediction and Server Reconciliation](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html)
- [Gabriel Gambetta - Entity Interpolation](https://www.gabrielgambetta.com/entity-interpolation.html)
- [Web Game Dev - WebRTC](https://www.webgamedev.com/backend/webrtc)
- [Web Game Dev - Prediction & Reconciliation](https://www.webgamedev.com/backend/prediction-reconciliation)
- [Rune - WebRTC vs WebSockets](https://developers.rune.ai/blog/webrtc-vs-websockets-for-multiplayer-games)
- [Rune - Web Game Performance Optimization](https://developers.rune.ai/blog/web-game-performance-optimization)
- [Rune - Building Scalable Multiplayer Architecture](https://developers.rune.ai/blog/building-a-scalable-multiplayer-game-architecture)
- [Isaac Sukin - JavaScript Game Loops and Timing](https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing)
- [node-game-loop - Accurate Game Loop for Node.js](https://github.com/timetocode/node-game-loop)
- [RisingStack - Node.js Garbage Collection](https://blog.risingstack.com/node-js-at-scale-node-js-garbage-collection/)
- [Hathora - Scalable WebSocket Architecture](https://blog.hathora.dev/scalable-websocket-architecture/)
- [Mirror Networking - Cheats & Anticheats](https://mirror-networking.gitbook.io/docs/security/cheating)
- [Genieee - Top Security Risks in HTML5 Multiplayer Games](https://genieee.com/top-security-risks-in-html5-multiplayer-games-and-how-to-fix-them/)
- [SubSpace Wikipedia](https://en.wikipedia.org/wiki/SubSpace_(video_game))
- [SubSpace Reverse Engineering](https://sharvil.nanavati.net/projects/subspace/)
- [SubSpace Continuum History](https://danluu.com/subspace-history/)
