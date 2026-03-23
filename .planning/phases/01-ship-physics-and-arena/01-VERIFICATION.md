---
phase: 01-ship-physics-and-arena
verified: 2026-03-23T08:00:00Z
status: human_needed
score: 9/10 must-haves verified
re_verification: false
human_verification:
  - test: "Open browser at localhost:3000 and fly the ship"
    expected: "Ship rotates with arrow keys, thrusts in facing direction, drifts indefinitely when thrust released (no slowdown), bounces off walls, Shift activates afterburner draining energy, debug panel is visible"
    why_human: "Visual rendering, feel of momentum/no-drag, and subjective SubSpace authenticity cannot be verified programmatically (MAPS-02, PHYS-06 feel, PHYS-07 visual)"
---

# Phase 1: Ship Physics and Arena — Verification Report

**Phase Goal:** Implement ship physics matching SubSpace defaults and render a playable arena. Player flies a single ship with rotation, thrust, momentum, wall bounce, and afterburner in a tile-based arena.
**Verified:** 2026-03-23
**Status:** human_needed — all automated checks pass; human browser test required for visual/feel criteria
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Player can rotate and thrust with arrow keys; ship drifts with momentum when thrust stops | VERIFIED | `input.ts` maps ArrowLeft/Right/Up; `physics.ts` applies rotation and thrust; `applyThrust` returns early on no input (zero drag confirmed, no `0.99` or drag multiply found in physics.ts) |
| 2 | Ship bounces off tile walls and cannot pass through them | VERIFIED | `collision.ts` exports `simulateAxis` and `applyWallCollision`; axis-separated X-then-Y approach; velocity negated by `bounceFactor`; `game-loop.ts` calls `applyWallCollision` every physics tick |
| 3 | A complete arena map with walls and corridors loads and renders in the browser | VERIFIED (automated) / NEEDS HUMAN (visual) | `arena.json` exists: 200x200, 40,000 tiles, valid JSON, perimeter walls present; `renderer.ts` draws visible wall tiles as rectangles using camera-culled viewport loop; `main.ts` fetches `/maps/arena.json` and calls `parseMap` |
| 4 | Ship movement feels authentically like SubSpace (rotation speed, thrust, drag all match the original game's character) | NEEDS HUMAN | SVS conversion values verified by 62 passing unit tests; no drag code found; human confirmation of feel required per VALIDATION.md |
| 5 | Afterburner activates on keypress, visibly boosting speed and draining energy | VERIFIED (logic) / NEEDS HUMAN (visual) | `input.ts` maps ShiftLeft/ShiftRight to `afterburner`; `physics.ts` uses `config.maxThrust`/`config.maxSpeed` when `input.afterburner && state.energy > 0`; `updateEnergy` drains at `afterburnerCost` rate; unit tests confirm drain (120 energy/s for WARBIRD) and fallback to normal thrust at energy=0 |

**Score:** 3/5 fully automated + 2/5 need human browser verification

---

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `package.json` | VERIFIED | Contains `"workspaces": ["packages/*"]`; monorepo root confirmed |
| `packages/shared/src/types.ts` | VERIFIED | Exports `ShipState`, `ShipInput`, `ShipConfig`, `TileMap` — all 4 interfaces present with all required fields |
| `packages/shared/src/constants.ts` | VERIFIED | `TICK_RATE=100`, `TICK_DT=1/TICK_RATE`, `TILE_SIZE=16`, `MAP_SIZE=1024`, `DEFAULT_BOUNCE_FACTOR=1.0` all present |
| `packages/shared/src/ships.ts` | VERIFIED | Imports `ShipConfig` from `./types`; exports `WARBIRD`, `JAVELIN`, `SPIDER` via `convertShip()`; SVS raw values correct; unit tests confirm WARBIRD.rotation=0.525, WARBIRD.speed=12.5625 |
| `packages/shared/vitest.config.ts` | VERIFIED | Contains `defineConfig` with `test.include: ['src/**/*.test.ts']` |

#### Plan 02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/shared/src/physics.ts` | VERIFIED | Exports `applyRotation`, `applyThrust`, `clampSpeed`, `updateEnergy`, `updateShipPhysics`; no drag code found (grepped for `0.99`, `drag`, `friction`, `*= 0.` — all clean) |
| `packages/shared/src/collision.ts` | VERIFIED | Exports `isWallAt`, `isCollidingWithWalls`, `simulateAxis`, `applyWallCollision`; imports `ShipState`, `TileMap`; bounce uses `-bounceFactor` negation |
| `packages/shared/src/map.ts` | VERIFIED | Exports `parseMap` (validates width, height, tiles, length check) and `generateTestArena` (2-tile border, cross walls with gaps, quadrant structures) |
| `assets/maps/arena.json` | VERIFIED | 200x200 map, 40,000 tiles (matches width*height), valid JSON, starts with wall tiles at perimeter |

#### Plan 03 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/client/src/game-loop.ts` | VERIFIED | Exports `GameLoop` class; fixed-timestep `accumulator` pattern; `TICK_DT` from shared; calls `updateShipPhysics` and `applyWallCollision` in the while loop; uses `requestAnimationFrame` |
| `packages/client/src/renderer.ts` | VERIFIED | Imports `Application`, `Graphics`, `Container` from `pixi.js`; imports `ShipState`, `TILE_SIZE` from shared; viewport-culled wall tile rendering; ship sprite rotation set to `state.orientation * Math.PI * 2`; `worldToScreen` used for ship position |
| `packages/client/src/input.ts` | VERIFIED | Exports `InputManager`; maps `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ShiftLeft`, `ShiftRight`; `poll()` returns `ShipInput` |
| `packages/client/src/camera.ts` | VERIFIED | Exports `Camera`; `update()` clamps to map bounds; `worldToScreen()` converts tile coords to pixels |
| `packages/client/src/debug.ts` | VERIFIED | Imports `GUI` from `lil-gui`; exposes rotation, thrust, maxSpeed, bounce factor sliders; ship selector dropdown; live display of speed/position/energy/FPS |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ships.ts` | `types.ts` | `import type { ShipConfig }` | WIRED | Line 1: `import type { ShipConfig } from './types'` |
| `physics.ts` | `types.ts` | `import { ShipState, ShipInput, ShipConfig }` | WIRED | Line 1: `import type { ShipState, ShipInput, ShipConfig } from './types'` |
| `collision.ts` | `types.ts` | `import { TileMap, ShipState }` | WIRED | Line 1: `import type { ShipState, TileMap } from './types'` |
| `map.ts` | `types.ts` | `import { TileMap }` | WIRED | Line 1: `import type { TileMap } from './types'` |
| `game-loop.ts` | `physics.ts` | calls `updateShipPhysics` each tick | WIRED | Line 92: `updateShipPhysics(this.shipState, input, this.shipConfig, TICK_DT)` inside accumulator while loop |
| `game-loop.ts` | `collision.ts` | calls `applyWallCollision` each tick | WIRED | Lines 93-99: `applyWallCollision(...)` called immediately after `updateShipPhysics` in every tick |
| `renderer.ts` | `types.ts` | reads `ShipState` for sprite position/rotation | WIRED | Line 44: `render(state: ShipState, camera: Camera)` — uses `state.orientation` and `state.x/y` |
| `main.ts` | `game-loop.ts` | creates and starts `GameLoop` | WIRED | Lines 36-43: `new GameLoop({...})` then `gameLoop.start()` |
| `main.ts` | arena.json | `fetch('/maps/arena.json')` then `parseMap` | WIRED | Lines 12-14: fetches map, passes to `parseMap`, result used throughout |

All 9 key links WIRED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PHYS-01 | 01-02, 01-03 | Ship rotates left/right with arrow keys at configurable rotation speed | SATISFIED | `applyRotation` in `physics.ts`; `ArrowLeft`/`ArrowRight` in `input.ts`; 5 rotation unit tests pass |
| PHYS-02 | 01-02, 01-03 | Ship thrusts forward with up arrow, applying force in facing direction | SATISFIED | `applyThrust` uses `Math.cos/sin(orientation * 2PI)`; `ArrowUp` mapped; 4 thrust tests pass |
| PHYS-03 | 01-02, 01-03 | Ship maintains momentum and drifts when not thrusting (inertia) | SATISFIED | `applyThrust` returns early when `!input.thrust` — no drag, no decay; 2 inertia tests explicitly verify `vx/vy` unchanged with no input |
| PHYS-04 | 01-02, 01-03 | Ship has configurable drag that gradually slows it over time | PARTIALLY SATISFIED — see note | Research doc (01-RESEARCH.md line 25) explicitly documents that SubSpace has NO drag and uses a hard speed clamp (`Truncate`) instead. The implementation follows SubSpace authentically: zero drag, hard speed cap via `clampSpeed`. REQUIREMENTS.md marks this Complete and the ROADMAP Success Criteria do not mention drag. The requirement text is misleading but the implementation is correct for authentic SubSpace behavior. |
| PHYS-05 | 01-02, 01-03 | Ship bounces off tile walls on collision | SATISFIED | `simulateAxis` restores position and negates velocity by `bounceFactor`; 3 bounce/collision tests pass |
| PHYS-06 | 01-01 | Physics parameters match authentic SubSpace feel | SATISFIED (automated) / NEEDS HUMAN (feel) | `convertShip()` uses documented SVS formulas; 18 unit tests verify exact SVS converted values (WARBIRD.rotation=0.525, speed=12.5625, etc.); subjective feel requires human confirmation |
| PHYS-07 | 01-02, 01-03 | Ship can activate afterburner for temporary speed boost consuming energy | SATISFIED (logic) / NEEDS HUMAN (visual) | ShiftLeft/ShiftRight mapped; `maxThrust`/`maxSpeed` used when afterburner active; energy drain at 120/s verified by test; energy=0 fallback verified |
| MAPS-01 | 01-02 | Tile-based map system with walls and open space | SATISFIED | `TileMap` interface with `tiles: number[]`; `isWallAt` checks `tile !== 0`; `generateTestArena` creates perimeter + corridors + rooms |
| MAPS-02 | 01-03 | At least one playable arena map designed for 10-20 players | SATISFIED (automated) / NEEDS HUMAN (visual) | `arena.json` is 200x200 with corridors and open spaces; renders in browser via `renderer.ts`; visual quality requires human check |
| MAPS-03 | 01-02 | Map data loads from a defined format (tilemap) | SATISFIED | `parseMap` validates JSON `{width, height, tiles}`; validates `tiles.length === width*height`; 4 map tests pass |

**Note on PHYS-04:** The requirement as written ("configurable drag") conflicts with authentic SubSpace physics (zero drag, hard speed clamp). The research document, plan, and implementation all consciously chose the correct SubSpace behavior over the requirement's wording. The REQUIREMENTS.md traceability table marks it Complete. This is a documentation inconsistency, not an implementation gap. No code change needed.

---

### Anti-Patterns Found

Scanned all 9 key source files for TODO/FIXME/placeholder/empty implementations/drag code.

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| `physics.ts` | Drag/decay check | INFO | Comments say "NOT drag" and "Does NOT apply any drag or decay" — documentation of intentional zero-drag design, not a bug |
| All files | TODO/FIXME/placeholder | CLEAN | None found |
| All files | `return null` / empty stubs | CLEAN | None found |
| `main.ts` | `console.log` | INFO | Single `console.log('TrenchWars client started')` — informational only, not a stub |

No blockers. No warnings.

---

### Human Verification Required

#### 1. Arena Renders and Ship is Playable

**Test:** Run `npx vite --config packages/client/vite.config.ts` from the project root, open http://localhost:3000
**Expected:** Dark background; arena map renders with visible blue-gray wall tiles forming corridors; a green arrow-shaped ship sprite is visible at starting position (100, 100); no JavaScript errors in console
**Why human:** Visual rendering cannot be verified programmatically

#### 2. Ship Physics Feel Matches SubSpace

**Test:** With the browser open, press Arrow Keys (Left/Right to rotate, Up to thrust). Release thrust and observe the ship.
**Expected:** Ship rotates smoothly; thrusting accelerates in the facing direction; when thrust is released the ship continues at the same speed indefinitely (zero slowdown, zero drift decay); arrow keys prevent page scrolling
**Why human:** "Feels like SubSpace" is a subjective comparison requiring live interaction

#### 3. Wall Bounce

**Test:** Fly the ship into a wall tile.
**Expected:** Ship bounces off the wall cleanly (velocity reversed on collision axis); ship does not pass through walls or get stuck inside them
**Why human:** Requires live physics interaction in browser

#### 4. Afterburner Visual and Energy

**Test:** Hold Shift while pressing Up arrow.
**Expected:** Ship accelerates noticeably faster (maxThrust vs. normal thrust); energy value in the debug panel decreases while Shift is held; energy recharges when Shift is released
**Why human:** Requires live observation of debug panel during gameplay

#### 5. Debug Panel

**Test:** Observe the lil-gui panel in the browser; adjust the Rotation Speed slider.
**Expected:** Floating debug panel is visible with Physics folder (Rotation Speed, Thrust Power, Max Speed, Afterburner sliders, Bounce Factor) and Display folder (FPS, Speed, X, Y, Energy, Orientation); changing Rotation Speed slider causes ship to rotate faster/slower in real-time; Ship dropdown switches between Warbird/Javelin/Spider
**Why human:** UI interaction and real-time parameter binding require live testing

#### 6. Camera Follows Ship and Stays In Bounds

**Test:** Thrust toward the edge of the arena map.
**Expected:** Camera follows the ship; camera stops scrolling at map edges (ship can approach but camera does not show gray/empty space outside the map boundary)
**Why human:** Requires live spatial observation

---

### Test Infrastructure Verification

- `npx vitest run` — **62 tests passing across 4 test files** (ships.test.ts, physics.test.ts, collision.test.ts, map.test.ts)
- `npx tsc --noEmit -p packages/shared/tsconfig.json` — **exit 0, no errors**
- `npx tsc --noEmit -p packages/client/tsconfig.json` — **exit 0, no errors**
- `arena.json` — **valid JSON, 200x200, 40,000 tiles, width*height match confirmed**
- All commits from SUMMARYs verified in git log (7bcd4c3, 44f2bff, b690b5b, 51a887c, 4a59d05, 9d3f6c7, fb78a7a, 3dfe13a, 273e2fb)

---

### Gaps Summary

No gaps blocking the phase goal. All automated checks pass:

- All 9 key artifacts exist and are substantive (no stubs, no placeholders)
- All 9 key links are wired with live code (not just imports — actual calls)
- Zero drag code confirmed (intentional, authentic SubSpace behavior)
- 62 unit tests green
- TypeScript compilation clean across both packages
- arena.json is valid and correctly sized

The only outstanding items are 6 human verification checks required to confirm the browser experience works as intended. These are behavioral/visual checks that cannot be done programmatically. The SUMMARY indicates human verification was already performed by the user (Task 2 of Plan 03 was a human-verify checkpoint that was approved), but that approval is not verifiable from this report — the human checks are listed above for confirmaton.

**PHYS-04 note:** The requirement text says "configurable drag" but SubSpace has no drag. The implementation correctly uses a hard speed clamp (zero drag), which is the authentic SubSpace behavior documented in the research. REQUIREMENTS.md marks PHYS-04 as Complete. This is a documentation inconsistency in the requirement wording, not an implementation gap.

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
