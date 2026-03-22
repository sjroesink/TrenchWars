# Feature Research

**Domain:** Browser-based multiplayer arena space combat (SubSpace/Continuum remake)
**Researched:** 2026-03-22
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unplayable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Momentum-based ship movement (rotate + thrust) | Core identity of SubSpace; without inertia physics it is not SubSpace | HIGH | Must nail the "feel" -- rotation speed, thrust acceleration, drag coefficients, top speed. This IS the game. Physics tick rate must be consistent (60Hz server-side). |
| Real-time multiplayer (WebSocket) | Single-player space combat is pointless; the whole value is fighting humans | HIGH | Authoritative server, client-side prediction, entity interpolation, lag compensation. WebSocket (not WebRTC) for server-authoritative model. |
| Bullets with travel time | Bullet leading is a core skill in SubSpace; hitscan would ruin the game | MEDIUM | Bullets must be server-authoritative projectiles with consistent speed. Lag compensation needed so shots feel fair. |
| Bombs (bouncing off walls) | Area denial and corridor control are fundamental to Trench Wars gameplay | MEDIUM | Wall collision detection, bounce physics, explosion radius. Bombs are slower but higher damage than bullets. |
| Tile-based map with walls | SubSpace maps define gameplay flow; walls create corridors, choke points, arenas | MEDIUM | 304x304 tile grid (original size). Walls block movement and bullets. Need efficient collision detection for projectiles vs tiles. |
| Multiple ship types (min 3) | Ship diversity creates rock-paper-scissors dynamics and replayability | MEDIUM | Warbird (fast fighter), Javelin (bomber), Spider (front-line fighter). Each must feel fundamentally different in handling, speed, weapons. |
| Energy system | Energy is health AND ammo in SubSpace -- creates risk/reward tension in combat | LOW | Single energy bar depleted by taking damage AND firing weapons. Regenerates over time. Low energy = vulnerable. |
| Kill/death scoreboard | Players need feedback on performance; competitive games require visible stats | LOW | Per-session K/D, updated in real-time. Visible in-game HUD and on tab/overlay. |
| Respawn system | Players die constantly; must get back into action within seconds | LOW | 3-5 second respawn timer, spawn at safe location. No long death screens. |
| Radar/minimap | Players need spatial awareness in large maps; original SubSpace has radar | LOW | Show player positions (team dots), wall outlines, map boundaries. Toggle-able full map view. |
| Ship selection UI | Players must choose and switch ships | LOW | Simple overlay or pre-spawn menu. Show ship stats (speed, energy, weapon type). Allow switching on death. |
| Sound effects (weapons, explosions, thrust) | Silent combat feels broken; audio feedback is essential for game feel | LOW | Spatial audio not required for 2D. Need: bullet fire, bomb fire, explosion, thrust, death, hit confirmation. |
| Instant play (no account required) | IO game standard; friction kills player count. Original SubSpace was drop-in. | LOW | Generate random name or let player type one. No registration wall. Optional accounts later. |

### Differentiators (Competitive Advantage)

Features that set TrenchWars apart from generic IO shooters or other browser games.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Authentic SubSpace physics | No other browser game has SubSpace's specific momentum model; this is what fans want | HIGH | The rotation speed, thrust curves, and drift feel must match or closely approximate original SubSpace. This is the #1 differentiator over generic space IO games. |
| Team arena mode (elimination rounds) | Structured competitive play beyond FFA; mirrors Trench Wars basing format | MEDIUM | Two teams, best-of-N rounds, flag capture or elimination objective. Distinguishes from "just another FFA IO game." |
| Bomb wall-bouncing mechanics | Unique to SubSpace; no modern browser game has this. Creates deep tactical play in corridors. | MEDIUM | Bombs ricochet off walls with predictable angles. Masters use bounces for indirect kills around corners. |
| Modern visual style (neon vector aesthetic) | Original SubSpace looks dated; modern visuals attract new players while preserving gameplay | MEDIUM | Glow effects, particle trails, clean vector ships, dark background with neon highlights. WebGL shaders for bloom/glow. |
| Ship attachment/turret system | Unique SubSpace mechanic where players attach to teammates as gun turrets | HIGH | Defer to v2, but plan architecture for it. Terrier + attached turrets is iconic Trench Wars gameplay. |
| Low-latency netcode with prediction | Smooth gameplay at typical internet latencies makes or breaks retention | HIGH | Client-side prediction, server reconciliation, entity interpolation (100-200ms buffer). This is table stakes for quality but a differentiator in execution -- most IO games have mediocre netcode. |
| Afterburners (speed boost) | Adds skill ceiling -- managing afterburner energy vs combat energy | LOW | Hold shift to boost speed at increased energy cost. Simple mechanic, deep implications. |
| Chat system (team + all) | Social interaction drives retention; original SubSpace had active chat | LOW | Team chat and all chat. Simple text input. Quick messages/macros for combat callouts. |
| Spectator mode | Enables competitive scene, content creation, learning by watching | LOW | Free-cam or follow-player. Shows both teams. Foundation for future tournament/league support. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific project.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Powerup/prize pickups (greens) | Core SubSpace feature, fans expect it | Massively increases complexity: inventory system, powerup spawning, balance across all combinations. Original had "thousands of combinations" which took years to balance. | Defer entirely to v2+. Ship stats are fixed in v1. Focus on core combat feel first. |
| All 8 ship types at launch | Completionism; fans want the full roster | Each ship needs unique handling, weapons, balance testing. 8 ships at launch means none are polished. | Launch with 3 (Warbird, Javelin, Spider). Add ships incrementally when core combat is proven. |
| Persistent accounts and stats | Players want progression and history | Adds auth infrastructure, database, privacy concerns, GDPR. Delays getting to playable game. Session-based play is fine for validation. | Session-based with optional nickname. Accounts in v2 after player base exists. |
| In-game economy / currency | Original has "pub bux" system | Monetization concerns, balance distortion, development overhead. Distracts from core gameplay. | No economy. Pure skill-based gameplay. |
| Matchmaking / skill-based lobby | Modern competitive games have SBMM | Requires large player base to work. With <100 concurrent players, matchmaking creates empty lobbies. Original SubSpace uses persistent arenas, not matchmaking. | Persistent arenas where anyone can join. Let skill diversity be part of the experience (like original). |
| Mobile / touch controls | Wider audience | Rotate+thrust controls are fundamentally keyboard-oriented. Touch adaptation would compromise the control feel that defines the game. Mobile players would have severe disadvantage. | Desktop browser only. Do not compromise controls for mobile. |
| Map editor | Community content creation | Massive feature scope: editor UI, validation, hosting, moderation. Not needed to validate core gameplay. | Ship a few hand-crafted maps. Map editor in v2+ if community demands it. |
| Clan/squad system | Social features drive retention | Database infrastructure, management UI, permissions. Premature before player base exists. | Informal teams via team mode. Formal squads in v2+. |
| Anti-cheat system | Fair play concerns | Complex to build, cat-and-mouse arms race. Server-authoritative model already prevents most cheats. | Server-authoritative physics prevents speed/position hacks. Basic rate limiting on inputs. Wallhacks less impactful in 2D with radar. Address specific cheats as they appear. |
| Weapon upgrades / leveling in-match | Diep.io-style progression feels rewarding | Fundamentally changes SubSpace identity. SubSpace is about skill with fixed loadouts, not RPG progression. Adding levels creates snowball effects that punish new joiners. | Fixed ship stats. All players on equal footing from spawn. |

## Feature Dependencies

```
[Tile-based Map Engine]
    +--requires--> [Collision Detection (walls)]
    |                  +--requires--> [Bomb Wall Bouncing]
    |                  +--requires--> [Ship-Wall Collision]
    +--requires--> [Radar/Minimap]

[Ship Movement Physics]
    +--requires--> [Energy System] (afterburners drain energy)
    +--requires--> [Client-Side Prediction]

[Multiplayer Networking]
    +--requires--> [Client-Side Prediction]
    +--requires--> [Entity Interpolation]
    +--requires--> [Server-Authoritative Physics]
    |                  +--requires--> [Lag Compensation (projectiles)]
    +--requires--> [Game State Sync]
    |                  +--requires--> [Scoreboard]
    |                  +--requires--> [Chat System]

[Weapons (Bullets)]
    +--requires--> [Projectile System]
    +--requires--> [Collision Detection (projectile vs ship)]
    +--requires--> [Hit Detection + Lag Compensation]

[Weapons (Bombs)]
    +--requires--> [Projectile System]
    +--requires--> [Collision Detection (projectile vs wall)] --> [Bounce Physics]
    +--requires--> [Explosion Radius Damage]

[Ship Types]
    +--requires--> [Ship Movement Physics]
    +--requires--> [Weapons System]
    +--requires--> [Ship Selection UI]
    +--requires--> [Energy System]

[Team Arena Mode]
    +--requires--> [Team Assignment System]
    +--requires--> [Round Management (timer, elimination)]
    +--requires--> [Scoreboard (team scores)]
    +--enhances--> [Chat System (team chat)]

[Spectator Mode]
    +--requires--> [Game State Sync]
    +--requires--> [Camera System (follow/free)]

[FFA Deathmatch]
    +--requires--> [Respawn System]
    +--requires--> [Scoreboard]
```

### Dependency Notes

- **Multiplayer Networking requires Client-Side Prediction:** Without prediction, controls feel laggy at any real-world latency. Must be built together, not added later.
- **Bombs require Wall Collision Detection:** Bomb bouncing is meaningless without walls. Map engine must come before bomb mechanics.
- **Team Arena Mode requires Team Assignment:** Need team infrastructure before round-based play. Build FFA first, team mode second.
- **Ship Types require Weapons + Physics:** Each ship is a unique combination of physics parameters and weapon configs. Build one ship fully, then parameterize for others.
- **Spectator Mode requires Game State Sync:** Spectators consume game state without producing input. Low marginal cost once networking works.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate that SubSpace-style combat works in a browser.

- [ ] Single ship type (Warbird) with authentic rotate+thrust physics -- validates the feel
- [ ] Bullet weapons with travel time and server-authoritative hit detection -- validates combat
- [ ] Real-time multiplayer (2+ players in one arena) with client prediction -- validates networking
- [ ] One tile-based map with walls -- validates spatial gameplay
- [ ] Free-for-all deathmatch mode -- simplest game mode, immediate action
- [ ] Energy system (health + ammo) -- core resource management
- [ ] Kill/death scoreboard -- competitive feedback
- [ ] Respawn system -- keeps players in the game
- [ ] Radar/minimap -- spatial awareness
- [ ] Basic sound effects -- game feel
- [ ] No-account instant play -- zero friction entry

### Add After Validation (v1.x)

Features to add once core combat feel is confirmed as fun.

- [ ] Bombs (with wall bouncing) -- adds tactical depth once maps and walls are working
- [ ] Additional ship types (Javelin, Spider) -- adds variety once Warbird feels right
- [ ] Ship selection screen -- needed once multiple ships exist
- [ ] Team vs Team arena mode -- adds structured competitive play
- [ ] Afterburners -- adds skill ceiling to movement
- [ ] Chat system (team + all) -- social glue for retention
- [ ] Spectator mode -- enables competitive community
- [ ] Modern visual effects (glow, particles, trails) -- polish pass

### Future Consideration (v2+)

Features to defer until core game is proven and player base exists.

- [ ] Ship attachment/turret system (Terrier) -- iconic but architecturally complex
- [ ] Additional ship types (Leviathan, Weasel, Lancaster, Shark, Terrier) -- expand roster
- [ ] Powerup pickups (greens/prizes) -- inventory and balance complexity
- [ ] Special weapons (repel, burst, decoy, mines) -- each needs balance work
- [ ] Flag/base capture game mode -- objective-based play
- [ ] Persistent accounts and player stats -- requires auth infrastructure
- [ ] Squad/clan system -- social infrastructure
- [ ] Map editor -- community content tools
- [ ] Multiple arenas/zones -- server scaling
- [ ] Competitive leagues/rankings -- requires stable player base

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Ship movement physics (rotate+thrust+inertia) | HIGH | HIGH | P1 |
| Real-time multiplayer networking | HIGH | HIGH | P1 |
| Client-side prediction + interpolation | HIGH | HIGH | P1 |
| Bullet weapons (travel time) | HIGH | MEDIUM | P1 |
| Tile-based map with walls | HIGH | MEDIUM | P1 |
| Energy system | HIGH | LOW | P1 |
| Respawn system | HIGH | LOW | P1 |
| Kill/death scoreboard | MEDIUM | LOW | P1 |
| Radar/minimap | MEDIUM | LOW | P1 |
| Instant play (no account) | HIGH | LOW | P1 |
| Sound effects | MEDIUM | LOW | P1 |
| Bombs (wall bouncing) | HIGH | MEDIUM | P2 |
| Ship types (Javelin, Spider) | HIGH | MEDIUM | P2 |
| Ship selection UI | MEDIUM | LOW | P2 |
| Team arena mode | HIGH | MEDIUM | P2 |
| Afterburners | MEDIUM | LOW | P2 |
| Modern visual effects (glow, particles) | MEDIUM | MEDIUM | P2 |
| Chat system | MEDIUM | LOW | P2 |
| Spectator mode | LOW | LOW | P2 |
| Ship attachment/turret | MEDIUM | HIGH | P3 |
| Powerup pickups | MEDIUM | HIGH | P3 |
| Special weapons (repel, burst, mines) | MEDIUM | HIGH | P3 |
| Flag capture mode | MEDIUM | MEDIUM | P3 |
| Persistent accounts/stats | LOW | MEDIUM | P3 |
| Squad/clan system | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- game is not playable without these
- P2: Should have, add after core is validated -- adds depth and retention
- P3: Nice to have, future consideration -- expand once player base exists

## Competitor Feature Analysis

| Feature | Original SubSpace/Continuum | IO Games (Diep.io, etc.) | TrenchWars (Our Approach) |
|---------|----------------------------|--------------------------|---------------------------|
| Entry friction | Download client + zone selection | Zero (open URL, play) | Zero -- browser, no account, instant play |
| Movement model | Rotate+thrust with momentum | Varies (mouse-aim, WASD) | Authentic rotate+thrust (SubSpace clone) |
| Ship variety | 8 ships, highly distinct | Class/upgrade trees (Diep.io has 40+ tanks) | 3 ships at launch, distinct playstyles |
| Weapons | Bullets, bombs, mines, repel, burst, decoy, thor | Usually 1 weapon type | Bullets + bombs at launch, specials in v2 |
| Game modes | FFA, CTF, Basing, Dueling, Hockey, Elim | FFA, Teams, Domination | FFA + Team Arena |
| Progression | Powerup pickups, no persistent progression | In-match leveling (Diep.io), none (Agar.io) | None -- pure skill, equal loadouts |
| Social | Chat, squads, leagues, events | Minimal or none | Chat at launch, squads later |
| Visuals | 1997 pixel art sprites | Simple geometric shapes | Modern neon vector aesthetic |
| Netcode | Custom UDP protocol, excellent | Varies widely, often poor | WebSocket with prediction+interpolation |
| Map design | 304x304 tile grid, community-made maps | Procedural or simple arenas | Hand-crafted tile maps (SubSpace style) |
| Player capacity | 100+ per arena | Varies (20-100) | Target 20+ per arena |

## Sources

- [Subspace Continuum Features](https://beginner.getcontinuum.com/features.php) -- official feature list
- [Trench Wars Beginner Guide (Steam)](https://steamcommunity.com/sharedfiles/filedetails/?id=474916946) -- comprehensive mechanics guide
- [SubSpace Wikipedia](https://en.wikipedia.org/wiki/SubSpace_(video_game)) -- game history and mechanics overview
- [Gabriel Gambetta - Client-Side Prediction](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html) -- authoritative netcode reference
- [Gabriel Gambetta - Entity Interpolation](https://www.gabrielgambetta.com/entity-interpolation.html) -- interpolation techniques
- [Diep.io Wikipedia](https://en.wikipedia.org/wiki/Diep.io) -- IO game feature reference
- [IO Games Hub - Best IO Games 2026](https://iogameshub.com/blog/best-lists/best-io-games-2026-top-multiplayer-browser-games-ranked) -- IO game landscape
- [Game Networking Guide 2025](https://generalistprogrammer.com/tutorials/game-networking-complete-multiplayer-guide-2025) -- multiplayer networking patterns

---
*Feature research for: Browser-based multiplayer arena space combat (SubSpace/Continuum remake)*
*Researched: 2026-03-22*
