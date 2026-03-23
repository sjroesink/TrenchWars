---
phase: 03-game-experience
plan: 02
subsystem: ui
tags: [hud, kill-feed, scoreboard, energy-bar, overlays, html-css]

requires:
  - phase: 03-game-experience
    provides: "GameMode types, SCORE_UPDATE protocol message, GameSnapshot with kills/deaths"
provides:
  - "HUD overlay with energy bar (color-coded thresholds) and K/D counter"
  - "KillFeed overlay with 5-entry max and 5-second auto-fade"
  - "Scoreboard overlay toggled by Tab, sorted by kills, local player highlighted"
  - "Network handlers for SCORE_UPDATE, CHAT, GAME_STATE messages"
  - "sendChat method on NetworkClient"
  - "Bomb key remapped from Tab to F-only, Tab reserved for scoreboard"
affects: [03-game-experience, 04-polish]

tech-stack:
  added: []
  patterns: ["HTML/CSS overlay pattern for game UI (fixed position, pointer-events: none, z-index layering)"]

key-files:
  created:
    - packages/client/src/ui/hud.ts
    - packages/client/src/ui/kill-feed.ts
    - packages/client/src/ui/scoreboard.ts
  modified:
    - packages/client/src/input.ts
    - packages/client/src/network.ts
    - packages/client/src/game-loop.ts
    - packages/client/src/main.ts

key-decisions:
  - "HTML/CSS overlays positioned via fixed positioning over PixiJS canvas with pointer-events: none"
  - "Energy bar color thresholds: >=50% green, >=25% amber, <25% red"
  - "Kill feed entries auto-fade after 5s with 500ms CSS transition, max 5 visible"
  - "Scoreboard uses z-index 300 (above HUD at 100) to overlay all game elements"
  - "Tab key remapped from bomb to scoreboard toggle; bomb fires on F key only"

patterns-established:
  - "UI overlay pattern: create fixed-position div container, append children, document.body.appendChild"
  - "Player name resolution via Map<string, string> populated from PLAYER_JOIN events"

requirements-completed: [UIEX-01, UIEX-02, UIEX-03]

duration: 6min
completed: 2026-03-23
---

# Phase 03 Plan 02: HUD and Scoreboard Summary

**Energy bar, K/D counter, kill feed, and Tab-toggled scoreboard as HTML/CSS overlays wired into game loop and network handlers**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T16:10:36Z
- **Completed:** 2026-03-23T16:16:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- HUD overlay with energy bar (color-coded green/amber/red) and K/D counter updating each frame
- Kill feed at top-right showing last 5 kills with killer/victim names and weapon icons, auto-fading after 5 seconds
- Scoreboard overlay toggled by holding Tab, showing all players sorted by kills with local player highlighted
- Network client extended with SCORE_UPDATE, CHAT, and GAME_STATE message handlers plus sendChat method
- Bomb key remapped from Tab+F to F-only, freeing Tab for scoreboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Build HUD, Kill Feed, and Scoreboard UI components** - `6804291` (feat)
2. **Task 2: Wire UI into game loop and network, remap bomb key** - `d849442` (feat, included in parallel 03-03 commit)

## Files Created/Modified
- `packages/client/src/ui/hud.ts` - Energy bar and K/D counter HTML overlay
- `packages/client/src/ui/kill-feed.ts` - Kill feed with timed auto-fade entries
- `packages/client/src/ui/scoreboard.ts` - Tab-toggled scoreboard with player ranking
- `packages/client/src/input.ts` - Tab remapped to scoreboard, bomb on F-only, isScoreboardHeld()
- `packages/client/src/network.ts` - Added onScoreUpdate/onChat/onGameState handlers, sendChat method
- `packages/client/src/game-loop.ts` - HUD.update() called each frame, kills/deaths tracked from snapshots
- `packages/client/src/main.ts` - HUD/KillFeed/Scoreboard instantiated, kill feed wired to onDeath, scoreboard to onScoreUpdate

## Decisions Made
- HTML/CSS overlays positioned via fixed positioning over PixiJS canvas with pointer-events: none
- Energy bar color thresholds: >=50% green (#00ff88), >=25% amber (#ffaa00), <25% red (#ff3333)
- Kill feed max 5 entries with 5-second auto-fade using CSS opacity transition
- Scoreboard z-index 300 (above HUD z-index 100), centered on screen
- Tab key remapped from bomb fire to scoreboard toggle; bomb fires on F key only
- Player names tracked via Map populated from PLAYER_JOIN events for kill feed name resolution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 changes committed as part of parallel 03-03 plan**
- **Found during:** Task 2
- **Issue:** Parallel plan 03-03 (Radar/Chat) was executed concurrently and committed changes to the same files (input.ts, network.ts, game-loop.ts, main.ts). Task 2 edits were applied to files that already contained both 03-02 and 03-03 changes.
- **Fix:** Verified all Task 2 acceptance criteria are met in the committed state. No separate commit needed -- changes are already in `d849442`.
- **Files modified:** input.ts, network.ts, game-loop.ts, main.ts
- **Verification:** All grep acceptance checks pass, TypeScript compiles, 77 server tests pass

---

**Total deviations:** 1 (parallel plan merge)
**Impact on plan:** No functional impact. All planned changes present and verified.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- HUD, kill feed, and scoreboard overlays ready for visual polish in Phase 04
- Score update pipeline complete from server through network to scoreboard
- Tab key freed for scoreboard, enabling future keybind expansion

---
*Phase: 03-game-experience*
*Completed: 2026-03-23*
