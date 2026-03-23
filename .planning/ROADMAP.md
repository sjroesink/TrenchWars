# Roadmap: TrenchWars

## Overview

TrenchWars goes from zero to a publicly playable browser space combat game in four phases. Phase 1 nails the ship movement feel that defines SubSpace -- if the physics are wrong, nothing else matters. Phase 2 builds the full multiplayer combat loop with authoritative networking, weapons, and ship variety. Phase 3 layers on game modes, UI polish, and the audiovisual experience that makes it feel like a real game. Phase 4 puts it on the internet for anyone to play.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Ship Physics and Arena** - Momentum-based ship movement and tile-based arena with wall collision, playable as a single-player physics sandbox (completed 2026-03-23)
- [ ] **Phase 2: Multiplayer Combat** - Authoritative server, client prediction, weapons, ship types, and real-time combat between multiple players
- [ ] **Phase 3: Game Experience** - Game modes, HUD, scoreboard, radar, audio, visual polish, chat, and ship selection flow
- [ ] **Phase 4: Production Launch** - Public hosting, performance at scale, and multi-arena support

## Phase Details

### Phase 1: Ship Physics and Arena
**Goal**: A player can fly a ship around a tile-based arena in their browser and it feels like SubSpace
**Depends on**: Nothing (first phase)
**Requirements**: PHYS-01, PHYS-02, PHYS-03, PHYS-04, PHYS-05, PHYS-06, PHYS-07, MAPS-01, MAPS-02, MAPS-03
**Success Criteria** (what must be TRUE):
  1. Player can rotate and thrust a ship with arrow keys, and the ship drifts with momentum when thrust stops
  2. Ship bounces off tile walls and cannot pass through them
  3. A complete arena map with walls and open corridors is loaded and rendered in the browser
  4. Ship movement feels authentically like SubSpace (rotation speed, thrust, drag all match the original game's character)
  5. Afterburner activates on keypress, visibly boosting speed and draining energy
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md -- Scaffold monorepo, define types/constants/ship configs, set up test and dev infrastructure
- [ ] 01-02-PLAN.md -- Implement physics engine, wall collision, and map system with TDD
- [ ] 01-03-PLAN.md -- Wire client rendering, input, game loop, and debug tools for playable sandbox

### Phase 2: Multiplayer Combat
**Goal**: Multiple players can connect to the same arena and fight each other in real-time with responsive controls and fair hit detection
**Depends on**: Phase 1
**Requirements**: NETW-01, NETW-02, NETW-03, NETW-04, NETW-05, CMBT-01, CMBT-02, CMBT-03, CMBT-04, CMBT-05, CMBT-06, CMBT-07, CMBT-08, CMBT-09, SHIP-01, SHIP-02, SHIP-03, SHIP-04, SHIP-05
**Success Criteria** (what must be TRUE):
  1. Two or more players in separate browser windows see each other moving smoothly in the same arena
  2. Player can fire bullets that travel across the arena and damage other players on hit
  3. Player can fire bombs that bounce off walls and deal area damage
  4. A killed player respawns at a safe location and can immediately continue fighting
  5. Three distinct ship types (Warbird, Javelin, Spider) are playable with noticeably different handling and combat characteristics
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Game Experience
**Goal**: The game has structured modes, complete UI, audiovisual polish, and feels like a finished product rather than a tech demo
**Depends on**: Phase 2
**Requirements**: MODE-01, MODE-02, MODE-03, UIEX-01, UIEX-02, UIEX-03, UIEX-04, UIEX-05, UIEX-06, UIEX-07, UIEX-08
**Success Criteria** (what must be TRUE):
  1. Player can join a free-for-all deathmatch and see their kills and deaths on a live scoreboard
  2. Players can join a team arena match with elimination rounds and a winning team is declared
  3. Player sees a HUD with health, energy, and kill/death counts while playing
  4. Player can see a radar/minimap showing other players' positions on the map
  5. Game has engine thrust, weapon fire, and explosion sound effects, and ships render with modern neon/glow visual style
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Production Launch
**Goal**: Anyone on the internet can open a URL and immediately start playing with no installation or account required
**Depends on**: Phase 3
**Requirements**: INFR-01, INFR-02, INFR-03
**Success Criteria** (what must be TRUE):
  1. Game is accessible via a public URL in any modern browser with no installation or account creation
  2. Server maintains 60fps simulation with 20+ concurrent players without degradation
  3. Multiple arena rooms can run simultaneously, and players can choose which to join
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ship Physics and Arena | 3/3 | Complete   | 2026-03-23 |
| 2. Multiplayer Combat | 0/3 | Not started | - |
| 3. Game Experience | 0/3 | Not started | - |
| 4. Production Launch | 0/1 | Not started | - |
