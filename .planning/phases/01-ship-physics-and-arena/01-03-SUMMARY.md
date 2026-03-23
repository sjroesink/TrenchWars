---
phase: 01-ship-physics-and-arena
plan: 03
subsystem: client
tags: [pixijs, vite, game-loop, input, camera, debug, lil-gui, rendering]

# Dependency graph
requires:
  - phase: 01-ship-physics-and-arena
    plan: 01
    provides: "Shared types (ShipState, ShipInput, ShipConfig, TileMap), constants (TICK_RATE, TILE_SIZE), ship configs (WARBIRD)"
  - phase: 01-ship-physics-and-arena
    plan: 02
    provides: "Physics engine (updateShipPhysics), collision (applyWallCollision), map system (parseMap, generateArena)"
provides:
  - "Playable single-player physics sandbox at localhost:3000"
  - "PixiJS v8 renderer with ship sprite and WebGL tilemap"
  - "Fixed-timestep 100Hz game loop with accumulator pattern"
  - "Keyboard input polling (arrow keys + shift for afterburner)"
  - "Camera following ship, clamped to map bounds"
  - "lil-gui debug panel for real-time physics parameter tuning"
affects: [02-multiplayer-combat]

# Tech tracking
tech-stack:
  added: [pixijs-v8, pixi-tilemap, lil-gui, vite]
  patterns: [fixed-timestep-accumulator, raf-render-loop, keyboard-polling, viewport-camera]

key-files:
  created:
    - packages/client/src/main.ts
    - packages/client/src/game-loop.ts
    - packages/client/src/renderer.ts
    - packages/client/src/input.ts
    - packages/client/src/camera.ts
    - packages/client/src/debug.ts
  modified:
    - packages/client/index.html
    - packages/client/vite.config.ts
    - packages/client/package.json

key-decisions:
  - "Used PixiJS Graphics for ship sprite (triangle pointing right) instead of external PNG"
  - "WebGL tilemap rendering with @pixi/tilemap CompositeTilemap for performance"
  - "Camera clamps to map bounds to prevent showing out-of-bounds areas"
  - "Debug panel exposes all ship config params plus bounce factor for real-time tuning"

patterns-established:
  - "Game loop: fixed 100Hz physics tick with RAF rendering and accumulator pattern"
  - "Input: keyboard state map polled each frame, not event-driven per tick"
  - "Rendering: PixiJS v8 async init with Assets API"

requirements-completed: [PHYS-01, PHYS-02, PHYS-03, PHYS-04, PHYS-05, PHYS-06, PHYS-07, MAPS-02]

# Metrics
duration: ~15min
completed: 2026-03-23
---

# Phase 1 Plan 3: Client Rendering and Playable Sandbox Summary

**PixiJS v8 browser client with fixed-timestep game loop, keyboard input, camera tracking, WebGL tilemap rendering, and lil-gui debug panel for real-time physics tuning**

## Performance

- **Duration:** ~15 min (across two sessions with human verification checkpoint)
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files created:** 6
- **Files modified:** 3

## Accomplishments
- Fully playable single-player physics sandbox running at localhost:3000
- Ship rotates, thrusts, drifts with momentum, and bounces off walls -- feels like SubSpace
- Debug panel allows real-time tuning of rotation speed, thrust, max speed, bounce factor, and ship type selection
- Camera smoothly follows ship and stays clamped within arena bounds

## Task Commits

Each task was committed atomically:

1. **Task 1: Game loop, input, camera, and renderer** - `3dfe13a` (feat)
   - Fix commit: `273e2fb` (fix: WebGL error, ship selector, bounce physics)
2. **Task 2: Verify ship movement feels like SubSpace** - Human-verify checkpoint, approved by user

## Files Created/Modified
- `packages/client/src/main.ts` - Entry point: initializes PixiJS, loads arena map, starts game loop
- `packages/client/src/game-loop.ts` - Fixed 100Hz timestep accumulator calling physics + collision each tick
- `packages/client/src/renderer.ts` - PixiJS v8 renderer with ship Graphics sprite and CompositeTilemap
- `packages/client/src/input.ts` - Keyboard state polling for arrow keys and shift (afterburner)
- `packages/client/src/camera.ts` - Viewport tracking ship position, clamped to map bounds
- `packages/client/src/debug.ts` - lil-gui panel for physics parameter tweaking and ship type selection
- `packages/client/index.html` - Game container div for PixiJS canvas
- `packages/client/vite.config.ts` - Added publicDir pointing to project-root assets/
- `packages/client/package.json` - Added pixijs, @pixi/tilemap, lil-gui dependencies

## Decisions Made
- Used PixiJS Graphics (green triangle) for ship sprite rather than loading external PNG -- keeps v1 simple with no asset pipeline
- WebGL-based CompositeTilemap from @pixi/tilemap for efficient arena rendering
- Vite publicDir set to `../../assets` so dev server serves arena map JSON from project root
- Ship selector in debug panel swaps full ShipConfig when changing ship type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed WebGL rendering error and bounce physics**
- **Found during:** Task 1 verification (browser testing)
- **Issue:** WebGL context error on tilemap rendering, ship selector not updating config correctly, bounce factor not applied properly
- **Fix:** Fixed tilemap texture creation, corrected ship selector config swap, applied bounce factor from debug panel
- **Files modified:** packages/client/src/renderer.ts, packages/client/src/debug.ts, packages/client/src/game-loop.ts
- **Verification:** Browser renders correctly, ship selector works, bounces feel right
- **Committed in:** `273e2fb`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for correct rendering. No scope creep.

## Issues Encountered
- PixiJS v8 API differences from v7 required async initialization pattern (planned for, worked as expected)
- WebGL tilemap texture needed explicit creation rather than relying on Graphics-to-texture conversion (fixed in deviation above)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 1 complete: all ship physics, collision, map, and client rendering requirements satisfied
- Shared physics engine ready for server-side reuse in Phase 2 (multiplayer)
- Game loop pattern established for client-side prediction in Phase 2
- Ship configs (Warbird, Javelin, Spider) defined and tunable, ready for ship selection UI in Phase 3

## Self-Check: PASSED

- All 6 key files: FOUND
- Commit 3dfe13a: FOUND
- Commit 273e2fb: FOUND

---
*Phase: 01-ship-physics-and-arena*
*Completed: 2026-03-23*
