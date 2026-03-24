---
phase: 04-production-launch
plan: 01
subsystem: ui
tags: [pixi.js, sprites, ship-rendering, texture-lookup]

# Dependency graph
requires:
  - phase: 01-ship-physics
    provides: "PixiJS renderer with Graphics-based ship rendering"
  - phase: 03-game-experience
    provides: "GlowFilter, visual effects, remote player renderer"
provides:
  - "Ship sprite assets (120 PNGs: 3 ships x 40 rotation frames)"
  - "ShipSpriteManager class for texture loading and frame lookup"
  - "Sprite-based rendering for local and remote players"
affects: [04-production-launch]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Sprite frame lookup by orientation (no PixiJS rotation)", "Asset pre-loading via PixiJS Assets.load()"]

key-files:
  created:
    - "packages/client/src/sprites/ship-sprites.ts"
    - "assets/sprites/ships/warbird/*.png"
    - "assets/sprites/ships/javelin/*.png"
    - "assets/sprites/ships/spider/*.png"
  modified:
    - "packages/client/src/renderer.ts"
    - "packages/client/src/remote-player.ts"
    - "packages/client/src/main.ts"

key-decisions:
  - "Sampled every 10th frame from 400-frame source to get 40 frames (9-degree increments)"
  - "Sprites placed in assets/ directory (Vite publicDir) not packages/client/public/"
  - "Sprite frame lookup replaces PixiJS rotation -- texture swap is the rotation"

patterns-established:
  - "Ship sprite frame lookup: Math.round(orientation * 40) % 40"
  - "ShipSpriteManager passed through Renderer to RemotePlayerRenderer"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 04 Plan 01: Ship Sprites Summary

**SubSpace ship sprites (Warbird/Javelin/Spider) with 40-frame rotation lookup replacing Graphics triangles**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T13:51:42Z
- **Completed:** 2026-03-24T13:56:20Z
- **Tasks:** 2
- **Files modified:** 124

## Accomplishments
- 120 ship sprite PNGs (3 ships x 40 frames) extracted from SubSpace source and placed in assets directory
- ShipSpriteManager pre-loads all textures for synchronous frame lookup during render
- Local and remote player rendering replaced from Graphics triangles to Sprite objects with texture swap

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy sprites and create ShipSpriteManager** - `d85c745` (feat)
2. **Task 2: Replace Graphics triangles with sprites** - `04061d1` (feat)

## Files Created/Modified
- `packages/client/src/sprites/ship-sprites.ts` - ShipSpriteManager with loadAll() and getTexture() API
- `assets/sprites/ships/warbird/*.png` - 40 Warbird rotation frames (144x144 RGBA)
- `assets/sprites/ships/javelin/*.png` - 40 Javelin rotation frames
- `assets/sprites/ships/spider/*.png` - 40 Spider rotation frames
- `packages/client/src/renderer.ts` - Sprite replaces Graphics triangle, texture lookup replaces rotation
- `packages/client/src/remote-player.ts` - Sprite pool replaces Graphics pool
- `packages/client/src/main.ts` - ShipSpriteManager loading and injection

## Decisions Made
- Source has 400 frames per ship; sampled every 10th (0, 10, 20...390) to get 40 frames at 9-degree increments matching plan spec
- Sprites placed in `assets/` (project-level Vite publicDir) rather than `packages/client/public/` which is not served
- Sprite texture swap used instead of PixiJS rotation -- the frame IS the rotation, providing pixel-perfect SubSpace appearance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved sprites from packages/client/public/ to assets/**
- **Found during:** Task 2 (Vite build verification)
- **Issue:** Vite config sets publicDir to `../../assets`, not the default `public/`. Sprites in `packages/client/public/` were not included in build output.
- **Fix:** Moved all sprite directories from `packages/client/public/sprites/ships/` to `assets/sprites/ships/`
- **Files modified:** 120 PNG files relocated
- **Verification:** `vite build` output includes sprites in dist/sprites/ships/
- **Committed in:** 04061d1 (Task 2 commit)

**2. [Rule 1 - Bug] Adjusted frame sampling from 400-frame source**
- **Found during:** Task 1 (sprite copying)
- **Issue:** Plan assumed 40 source frames but source directories contain 400 frames each (wbroll_0.png through wbroll_399.png)
- **Fix:** Sampled every 10th frame (indices 0, 10, 20...390) to produce 40 output frames matching the plan's rotation granularity
- **Files modified:** Copy script logic only (no code files affected)
- **Verification:** 40 PNGs per ship type confirmed in target directories
- **Committed in:** d85c745 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct asset serving and frame selection. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ship sprites render correctly for all three ship types
- Build verified: TypeScript compiles clean, Vite build includes sprites
- Ready for remaining production launch tasks

---
*Phase: 04-production-launch*
*Completed: 2026-03-24*
