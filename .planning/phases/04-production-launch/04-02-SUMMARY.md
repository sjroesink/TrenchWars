---
phase: 04-production-launch
plan: 02
subsystem: infra
tags: [websocket, multi-room, arena, room-manager, room-select]

# Dependency graph
requires:
  - phase: 02-core-networking
    provides: GameServer, PlayerManager, WeaponManager, protocol
  - phase: 03-game-experience
    provides: GameMode, FFAMode, chat, HUD
provides:
  - ArenaRoom class with independent game loop, player/weapon management
  - RoomManager for multi-room routing and player assignment
  - Room selection UI overlay for clients
  - ROOM_LIST and ROOM_JOIN protocol messages
affects: [04-production-launch]

# Tech tracking
tech-stack:
  added: []
  patterns: [room-based architecture, thin WebSocket router, per-room game loops]

key-files:
  created:
    - packages/server/src/arena-room.ts
    - packages/server/src/room-manager.ts
    - packages/client/src/ui/room-select.ts
  modified:
    - packages/server/src/game-server.ts
    - packages/shared/src/protocol.ts
    - packages/shared/src/types.ts
    - packages/shared/src/index.ts
    - packages/client/src/network.ts
    - packages/client/src/main.ts
    - packages/server/src/__tests__/game-server.test.ts
    - packages/server/src/__tests__/chat.test.ts

key-decisions:
  - "GameServer becomes thin WebSocket router -- all game logic moves to ArenaRoom"
  - "RoomManager creates 2 default FFA rooms on startup"
  - "Auto-assign players to first non-full room when no roomId specified"
  - "Room selection auto-skips when only one room has space"

patterns-established:
  - "Room-based architecture: ArenaRoom owns PlayerManager, WeaponManager, LagCompensation, GameMode"
  - "Message routing: GameServer parses messages, delegates to room via playerRoomMap lookup"

requirements-completed: [INFR-03]

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 04 Plan 02: Multi-Room Support Summary

**ArenaRoom abstraction with independent game loops, RoomManager routing, and room selection UI for simultaneous arena instances**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T13:51:03Z
- **Completed:** 2026-03-24T13:57:57Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Extracted per-room state into ArenaRoom class with own tick loop, player/weapon management
- Created RoomManager with 2 default FFA rooms, player routing, and room listing
- Refactored GameServer into thin WebSocket router delegating to ArenaRoom instances
- Added room selection UI overlay with clickable cards and keyboard shortcuts
- Extended protocol with ROOM_LIST and ROOM_JOIN message types

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ArenaRoom and RoomManager, refactor GameServer** - `f3274c3` (feat)
2. **Task 2: Room selection UI and client protocol** - `eacefd6` (feat)

## Files Created/Modified
- `packages/server/src/arena-room.ts` - Self-contained arena room with own game loop, player/weapon management
- `packages/server/src/room-manager.ts` - Creates, lists, and routes players to rooms
- `packages/client/src/ui/room-select.ts` - Room selection UI overlay with cards and auto-select
- `packages/server/src/game-server.ts` - Refactored to thin WebSocket router
- `packages/shared/src/protocol.ts` - Added ROOM_LIST, ROOM_JOIN message types
- `packages/shared/src/types.ts` - Added RoomInfo interface
- `packages/shared/src/index.ts` - Exported RoomInfo type
- `packages/client/src/network.ts` - Added requestRoomList(), onRoomList, roomId in sendJoin
- `packages/client/src/main.ts` - Room selection flow before ship selection
- `packages/server/src/__tests__/game-server.test.ts` - Updated for room-based architecture
- `packages/server/src/__tests__/chat.test.ts` - Updated to test via ArenaRoom

## Decisions Made
- GameServer becomes thin WebSocket router -- all game logic (tick, physics, weapons, scoring) moves to ArenaRoom instances
- RoomManager creates 2 default FFA rooms on startup (Arena 1, Arena 2, each max 20 players)
- Auto-assign players to first non-full room when client omits roomId (backward compatible)
- Room selection UI auto-skips when only one room has available space (avoids unnecessary click)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing tests for new architecture**
- **Found during:** Task 1 (ArenaRoom and RoomManager creation)
- **Issue:** Existing game-server.test.ts and chat.test.ts accessed GameServer.playerManager/weaponManager which no longer exist
- **Fix:** Updated tests to access room-based properties via roomManager.getRoom()
- **Files modified:** packages/server/src/__tests__/game-server.test.ts, packages/server/src/__tests__/chat.test.ts
- **Verification:** All 78 tests pass
- **Committed in:** f3274c3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test update was necessary for correctness after refactoring. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Multi-room infrastructure ready for scaling
- Room-based architecture enables future room types (team arena, practice) by adding rooms to RoomManager
- Client flow supports room selection before gameplay

---
*Phase: 04-production-launch*
*Completed: 2026-03-24*
