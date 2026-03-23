# Requirements: TrenchWars

**Defined:** 2026-03-22
**Core Value:** Two or more players can connect to a persistent arena and engage in real-time space combat with responsive controls that capture the feel of SubSpace/Continuum.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Ship Physics

- [x] **PHYS-01**: Ship rotates left/right with arrow keys at configurable rotation speed
- [x] **PHYS-02**: Ship thrusts forward with up arrow, applying force in facing direction
- [x] **PHYS-03**: Ship maintains momentum and drifts when not thrusting (inertia)
- [x] **PHYS-04**: Ship has configurable drag that gradually slows it over time
- [x] **PHYS-05**: Ship bounces off tile walls on collision
- [x] **PHYS-06**: Physics parameters match authentic SubSpace feel (rotation speed, thrust, drag coefficients)
- [x] **PHYS-07**: Ship can activate afterburner for temporary speed boost consuming energy

### Combat

- [x] **CMBT-01**: Player can fire bullets with spacebar that travel in ship's facing direction
- [x] **CMBT-02**: Bullets have travel time and speed (not hitscan)
- [x] **CMBT-03**: Bullets damage other players on hit and are destroyed
- [x] **CMBT-04**: Player can fire bombs that bounce off walls
- [x] **CMBT-05**: Bombs deal area damage on impact with a player or after timeout
- [x] **CMBT-06**: Player dies when health reaches zero
- [x] **CMBT-07**: Kill and death counts are tracked per player
- [x] **CMBT-08**: Player respawns at a random safe location after death
- [x] **CMBT-09**: Server performs lag-compensated hit detection for fair combat

### Ships

- [x] **SHIP-01**: Warbird is available — fast, agile fighter with standard bullets
- [x] **SHIP-02**: Javelin is available — slower, powerful bombs, higher damage
- [x] **SHIP-03**: Spider is available — medium speed, mines-ready platform (bombs for v1)
- [x] **SHIP-04**: Each ship type has distinct stats (speed, rotation, health, energy, fire rate)
- [x] **SHIP-05**: Player can select ship type before entering the arena

### Networking

- [x] **NETW-01**: Authoritative server validates all game state (positions, hits, damage)
- [x] **NETW-02**: Client-side prediction provides responsive local controls despite latency
- [x] **NETW-03**: Server reconciliation corrects client predictions when they diverge
- [x] **NETW-04**: Entity interpolation renders remote players smoothly between server updates
- [x] **NETW-05**: Player can reconnect to an active session after disconnect

### Game Modes

- [ ] **MODE-01**: Free-for-all deathmatch: all players fight, kills tracked on scoreboard
- [ ] **MODE-02**: Team arena: 2 teams compete in elimination rounds
- [ ] **MODE-03**: Players can spectate an active arena without participating

### Maps

- [x] **MAPS-01**: Tile-based map system with walls and open space
- [x] **MAPS-02**: At least one playable arena map designed for 10-20 players
- [x] **MAPS-03**: Map data loads from a defined format (tilemap)

### UI & Experience

- [ ] **UIEX-01**: Ship selection screen where player picks ship type
- [ ] **UIEX-02**: In-game HUD showing health, energy, and kill/death count
- [ ] **UIEX-03**: Scoreboard/leaderboard visible during gameplay
- [ ] **UIEX-04**: Minimap/radar showing player positions on the map
- [ ] **UIEX-05**: Text chat between players in the same arena
- [x] **UIEX-06**: Audio effects for engine thrust, weapon fire, and explosions
- [x] **UIEX-07**: Modern 2D visual style with vector graphics and glow/neon effects
- [ ] **UIEX-08**: No account or registration required to start playing

### Infrastructure

- [ ] **INFR-01**: Game server hosted publicly and accessible via browser
- [ ] **INFR-02**: Server supports 20+ concurrent players at 60fps simulation
- [ ] **INFR-03**: Multiple arena rooms can run simultaneously

## v2 Requirements

### Extended Combat

- **XCBT-01**: Mines — place stationary explosive traps on the map
- **XCBT-02**: Special weapons — repel, burst, decoy abilities
- **XCBT-03**: Powerup pickups (greens) spawning randomly on the map
- **XCBT-04**: Additional ship types (Leviathan, Terrier, Weasel, Lancaster, Shark)

### Game Modes

- **XMOD-01**: Flag/base capture game mode
- **XMOD-02**: Custom game settings per arena (ship restrictions, score limits)

### Map Editor

- **XMAP-01**: In-browser map editor to create custom arenas
- **XMAP-02**: Share and load community-created maps

### Accounts & Progression

- **XACC-01**: Player accounts with persistent stats
- **XACC-02**: Leaderboards across sessions
- **XACC-03**: Player profiles with match history

## Out of Scope

| Feature | Reason |
|---------|--------|
| Desktop client (Electron) | Browser-only for maximum accessibility |
| Matchmaking system | Persistent arena model, players join directly |
| Mobile support | Desktop browser focus, controls require keyboard |
| 3D graphics | 2D top-down is core to the SubSpace identity |
| Voice chat | Text chat sufficient for v1, complexity not justified |
| Modding/scripting API | Focus on core game, modding is v3+ territory |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PHYS-01 | Phase 1 | Complete |
| PHYS-02 | Phase 1 | Complete |
| PHYS-03 | Phase 1 | Complete |
| PHYS-04 | Phase 1 | Complete |
| PHYS-05 | Phase 1 | Complete |
| PHYS-06 | Phase 1 | Complete |
| PHYS-07 | Phase 1 | Complete |
| MAPS-01 | Phase 1 | Complete |
| MAPS-02 | Phase 1 | Complete |
| MAPS-03 | Phase 1 | Complete |
| NETW-01 | Phase 2 | Complete |
| NETW-02 | Phase 2 | Complete |
| NETW-03 | Phase 2 | Complete |
| NETW-04 | Phase 2 | Complete |
| NETW-05 | Phase 2 | Complete |
| CMBT-01 | Phase 2 | Complete |
| CMBT-02 | Phase 2 | Complete |
| CMBT-03 | Phase 2 | Complete |
| CMBT-04 | Phase 2 | Complete |
| CMBT-05 | Phase 2 | Complete |
| CMBT-06 | Phase 2 | Complete |
| CMBT-07 | Phase 2 | Complete |
| CMBT-08 | Phase 2 | Complete |
| CMBT-09 | Phase 2 | Complete |
| SHIP-01 | Phase 2 | Complete |
| SHIP-02 | Phase 2 | Complete |
| SHIP-03 | Phase 2 | Complete |
| SHIP-04 | Phase 2 | Complete |
| SHIP-05 | Phase 2 | Complete |
| MODE-01 | Phase 3 | Pending |
| MODE-02 | Phase 3 | Pending |
| MODE-03 | Phase 3 | Pending |
| UIEX-01 | Phase 3 | Pending |
| UIEX-02 | Phase 3 | Pending |
| UIEX-03 | Phase 3 | Pending |
| UIEX-04 | Phase 3 | Pending |
| UIEX-05 | Phase 3 | Pending |
| UIEX-06 | Phase 3 | Complete |
| UIEX-07 | Phase 3 | Complete |
| UIEX-08 | Phase 3 | Pending |
| INFR-01 | Phase 4 | Pending |
| INFR-02 | Phase 4 | Pending |
| INFR-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
