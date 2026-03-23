---
phase: 02-multiplayer-combat
plan: 02
subsystem: physics
tags: [weapons, bullets, bombs, projectiles, collision, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-multiplayer-combat/01
    provides: "WeaponConfig, ProjectileState types, weapon constants, collision functions"
provides:
  - "createBullet, createBomb pure functions for projectile creation"
  - "updateProjectile with axis-separated wall collision"
  - "checkProjectileHit AABB overlap with self-hit exclusion"
  - "calculateBombDamage linear falloff"
affects: [02-multiplayer-combat/03, 02-multiplayer-combat/04]

# Tech tracking
tech-stack:
  added: []
  patterns: [axis-separated projectile collision, bomb bounce mechanics, linear damage falloff]

key-files:
  created:
    - packages/shared/src/weapons.ts
    - packages/shared/src/__tests__/weapons.test.ts
  modified:
    - packages/shared/src/index.ts

key-decisions:
  - "Projectile radius 0.1 tiles for collision detection (small hitbox, matching SubSpace feel)"
  - "Bomb recoil returned as separate values rather than mutating ship state (pure function)"
  - "Axis-separated collision for projectiles matches ship physics approach"

patterns-established:
  - "Weapon functions return status strings ('active', 'wall_explode') for caller to handle"
  - "createBomb returns { projectile, recoilVx, recoilVy } tuple for caller to apply recoil"

requirements-completed: [CMBT-01, CMBT-02, CMBT-03, CMBT-04, CMBT-05]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 02 Plan 02: Weapon Physics Summary

**Deterministic bullet/bomb physics with TDD: velocity inheritance, wall bounce mechanics, AABB hit detection, and linear bomb damage falloff**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T09:37:53Z
- **Completed:** 2026-03-23T09:41:12Z
- **Tasks:** 2 (TDD red + green)
- **Files modified:** 3

## Accomplishments
- 18 unit tests covering all weapon behavior: creation, movement, wall collision, hit detection, damage calculation
- createBullet correctly inherits ship velocity + heading * bulletSpeed
- Bombs bounce correct number of times (bouncesRemaining decrements per wall hit)
- Bullets destroyed immediately on wall collision (no bouncing)
- Self-hit excluded from checkProjectileHit (ownerId === playerId)
- Bomb area damage uses linear falloff: full at center, zero at blast radius edge
- All functions exported from shared package index

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - Write failing tests** - `9936616` (test)
2. **Task 2: GREEN - Implement weapon physics** - `08cd821` (feat)

_No refactor commit needed - code was clean from the start._

## Files Created/Modified
- `packages/shared/src/weapons.ts` - Pure functions: createBullet, createBomb, updateProjectile, checkProjectileHit, calculateBombDamage
- `packages/shared/src/__tests__/weapons.test.ts` - 18 tests covering all weapon behaviors
- `packages/shared/src/index.ts` - Added weapon function exports

## Decisions Made
- Projectile radius set to 0.1 tiles (small hitbox matching SubSpace behavior)
- Bomb recoil returned as separate values rather than mutating ship state, maintaining pure function contract
- Axis-separated collision for projectiles (X then Y) matches the ship physics approach from Phase 01

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test positions too close to walls**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Test bomb/bullet starting at x=1.05 with radius 0.1 had AABB overlapping wall tile [0,1] after X-axis bounce restore, causing double-bounce
- **Fix:** Moved test positions from x=1.05 to x=1.5, safely clear of wall overlap after position restore
- **Files modified:** packages/shared/src/__tests__/weapons.test.ts
- **Verification:** All 18 tests pass
- **Committed in:** 08cd821 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test setup)
**Impact on plan:** Test data fix only, no impact on implementation or scope.

## Issues Encountered
None beyond the test position fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Weapon physics ready for integration into game loop (Plan 03/04)
- All functions are pure and deterministic, suitable for client-side prediction and server authoritative simulation
- Exported from shared package for use by both client and server

---
*Phase: 02-multiplayer-combat*
*Completed: 2026-03-23*
