# TrenchWars

## What This Is

A browser-based multiplayer space combat game inspired by SubSpace/Continuum's Trench Wars zone. Players pilot ships in persistent arenas with classic rotate-and-thrust controls, fighting in free-for-all deathmatch and team arena modes. Modern 2D visuals with clean vector graphics and glow effects, fully playable in any modern browser with no installation required.

## Core Value

Two or more players can connect to a persistent arena and engage in real-time space combat with responsive controls that capture the feel of SubSpace/Continuum.

## Requirements

### Validated

- [x] Classic rotate+thrust ship controls (arrow keys to rotate/thrust) — Validated in Phase 1: ship-physics-and-arena
- [x] 3 ship types: Warbird (fast fighter), Javelin (bomber), Spider (mine layer) — Validated in Phase 1: configs with SVS-converted values
- [x] Tile-based maps with walls and open space — Validated in Phase 1: 200x200 arena with corridors
- [x] Browser-only client (Canvas/WebGL, no installation) — Validated in Phase 1: PixiJS WebGL renderer
- [x] Real-time multiplayer combat in persistent arenas — Validated in Phase 2: WebSocket server + client prediction
- [x] Bullets and bombs as weapon systems — Validated in Phase 2: TW competitive values, rear gun Javelin
- [x] Ship selection screen — Validated in Phase 2: overlay with 1/2/3 keys
- [x] Respawn system after death — Validated in Phase 2: safe location respawn

### Active

- [ ] Classic rotate+thrust ship controls (spacebar to shoot — weapons done, needs polish)
- [ ] Free-for-all deathmatch mode
- [ ] Team vs Team arena mode (2 teams, elimination rounds)
- [ ] Persistent arena: players join a zone and play immediately
- [ ] Modern 2D visual style (vector-like graphics, glow effects, neon-on-dark)
- [ ] Publicly hosted and playable by anyone
- [ ] Scoreboard and kill tracking
- [ ] Radar/minimap showing player positions

### Out of Scope

- Map editor — deferred to v2+
- Mines weapon — deferred (Spider starts with bombs, mines added later)
- Special weapons (repel, burst, decoy) — v2+
- Powerup pickups (greens/prizes) — v2+
- All 8 original ship types — v1 has 3 (Warbird, Javelin, Spider)
- Matchmaking system — players join arenas directly
- Desktop client / Electron wrapper — browser only
- Persistent player stats/accounts — v2+
- Flag/base capture game mode — v2+

## Context

SubSpace (1997) / Continuum is a top-down 2D multiplayer space shooter with unique physics: ships rotate and thrust like Asteroids, with momentum and inertia. Trench Wars is the most popular zone, known for team-based combat in narrow corridors.

Key gameplay feel to capture:
- **Momentum-based movement**: Ships don't stop instantly, you drift and must counter-thrust
- **Rotation speed matters**: Turning to face your opponent is a skill
- **Bullet leading**: Bullets have travel time, you must predict enemy movement
- **Bombs bounce off walls**: Area denial and corridor control
- **Ship diversity**: Each ship feels fundamentally different, not just stat tweaks

The original game uses tile-based maps (304x304 tiles) with walls, open space, and special tiles.

## Constraints

- **Platform**: Browser-only, must work on modern Chrome/Firefox/Edge
- **Network**: Authoritative server model for fair multiplayer (prevent cheating)
- **Performance**: Must handle 20+ simultaneous players at 60fps
- **Latency**: Client-side prediction and interpolation for smooth gameplay at <150ms ping

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Classic rotate+thrust controls | Core identity of SubSpace, what makes it unique vs other shooters | ✓ Phase 1 |
| Persistent arena (not lobby/matchmaking) | Matches original game feel, lower friction to play | — Pending |
| Browser-only (no Electron) | Maximum accessibility, zero install barrier | ✓ Phase 1 |
| Modern 2D visuals (not retro pixel) | Fresh take while preserving gameplay essence | — Pending |
| Authoritative server | Required for fair public multiplayer | ✓ Phase 2 |
| TW competitive settings | Use published TW values, not generic SVS defaults | ✓ Phase 2 |
| Javelin rear gun | Negative bullet speed = fires backward (TW-authentic) | ✓ Phase 2 |

---
*Last updated: 2026-03-23 after Phase 2 completion*
