---
phase: 02-multiplayer-combat
plan: 04
subsystem: networking
tags: [websocket, client-prediction, reconciliation, input-buffering]

requires:
  - phase: 02-01
    provides: "Protocol enums (ClientMsg, ServerMsg), shared types (GameSnapshot, PlayerState, ShipInput)"
  - phase: 01-ship-physics
    provides: "updateShipPhysics, applyWallCollision, ShipState, ShipConfig, TileMap, GameLoop, InputManager"
provides:
  - "NetworkClient: WebSocket connection with JSON message send/receive"
  - "PredictionManager: input buffer with sequence numbers, server reconciliation via physics replay"
  - "Networked game loop: sends inputs each tick, reconciles on server snapshot"
  - "Fire/bomb input capture (Space, Tab/F) with edge detection"
  - "Remote player position tracking from server snapshots"
  - "Local-only fallback mode when server unavailable"
affects: [02-06-remote-rendering, 02-05-server-game-loop, 02-07-integration]

tech-stack:
  added: []
  patterns: ["client-side prediction with server reconciliation", "input sequence numbering for acknowledgment", "optional networking with local fallback"]

key-files:
  created:
    - packages/client/src/network.ts
    - packages/client/src/prediction.ts
  modified:
    - packages/client/src/game-loop.ts
    - packages/client/src/main.ts
    - packages/client/src/input.ts

key-decisions:
  - "Local-only fallback: client catches WebSocket connection error and runs without server for testing"
  - "Server URL configurable via ?server= query parameter, defaults to ws://localhost:3001"
  - "Fire inputs use edge detection (consume on poll) to prevent auto-fire while held"

patterns-established:
  - "Optional networking pattern: GameLoop accepts optional network/prediction, runs local physics either way"
  - "Input recording before send: prediction buffer captures input then sends to server in same tick"
  - "Reconciliation pipeline: server state -> discard acknowledged inputs -> replay unacknowledged through full physics"

requirements-completed: [NETW-02, NETW-03]

duration: 3min
completed: 2026-03-23
---

# Phase 02 Plan 04: Client Networking and Prediction Summary

**WebSocket NetworkClient with client-side prediction and server reconciliation via input replay through shared physics pipeline**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T09:37:56Z
- **Completed:** 2026-03-23T09:40:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- NetworkClient handles WebSocket lifecycle, sending JOIN/INPUT/PING/SHIP_SELECT and dispatching all server message types to handlers
- PredictionManager buffers inputs with sequence numbers and reconciles by replaying unacknowledged inputs through updateShipPhysics + applyWallCollision
- Game loop integrates prediction: every tick records input, sends to server, applies locally; on snapshot reconciles and stores remote players
- Fire (Space) and bomb (Tab/F) inputs with edge-detected polling added to InputManager
- Local-only fallback mode preserved when no server is available

## Task Commits

Each task was committed atomically:

1. **Task 1: NetworkClient and PredictionManager** - `a8df80f` (feat)
2. **Task 2: Integrate networking and prediction into game loop and main** - `0e7966f` (feat)

## Files Created/Modified
- `packages/client/src/network.ts` - NetworkClient: WebSocket connection, message send/receive, server message dispatch
- `packages/client/src/prediction.ts` - PredictionManager: input buffer with seq numbers, reconciliation replay
- `packages/client/src/game-loop.ts` - Added optional network/prediction, onSnapshot reconciliation, remote player tracking
- `packages/client/src/main.ts` - Server connection flow, JOIN on welcome, local fallback
- `packages/client/src/input.ts` - Added fire/bomb edge-detected inputs (Space, Tab/F)

## Decisions Made
- Local-only fallback: client catches WebSocket connection error and runs without server for testing
- Server URL configurable via ?server= query parameter, defaults to ws://localhost:3001
- Fire inputs use edge detection (consume on poll) to prevent auto-fire while held

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in weapons.test.ts (bomb bounce count) -- not related to this plan's changes, not addressed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Client networking ready for server game loop (Plan 05)
- Remote player positions stored from snapshots, ready for rendering (Plan 06)
- NetworkClient and PredictionManager exported for integration testing (Plan 07)

## Self-Check: PASSED

All 5 files verified present. Both task commits (a8df80f, 0e7966f) verified in git log.

---
*Phase: 02-multiplayer-combat*
*Completed: 2026-03-23*
