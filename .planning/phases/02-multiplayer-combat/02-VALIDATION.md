---
phase: 02
slug: multiplayer-combat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already configured in Phase 1) |
| **Config file** | packages/shared/vitest.config.ts, packages/server/vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit -p packages/shared/tsconfig.json && npx tsc --noEmit -p packages/client/tsconfig.json && npx tsc --noEmit -p packages/server/tsconfig.json` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | NETW-01, SHIP-01 | unit | `npx tsc --noEmit -p packages/shared/tsconfig.json && npx tsc --noEmit -p packages/server/tsconfig.json` | N/A (scaffold) | ⬜ pending |
| 02-01-02 | 01 | 1 | SHIP-02, SHIP-03, SHIP-04 | unit | `npx vitest run --project shared && npx tsc --noEmit -p packages/shared/tsconfig.json` | N/A (protocol) | ⬜ pending |
| 02-02-01 | 02 | 2 | CMBT-01, CMBT-02, CMBT-03 | unit/tdd | `npx vitest run packages/shared/src/__tests__/weapons.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | NETW-01, CMBT-06, CMBT-07 | unit | `npx vitest run packages/server/src/__tests__/player-manager.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | CMBT-08, NETW-01 | unit/integration | `npx vitest run packages/server/src/__tests__/ && npx tsc --noEmit -p packages/server/tsconfig.json` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | NETW-02, NETW-03 | compile | `npx tsc --noEmit -p packages/client/tsconfig.json` | N/A | ⬜ pending |
| 02-04-02 | 04 | 2 | NETW-02, NETW-03 | compile | `npx tsc --noEmit -p packages/client/tsconfig.json` | N/A | ⬜ pending |
| 02-05-01 | 05 | 4 | CMBT-09 | unit/tdd | `npx vitest run packages/server/src/__tests__/lag-compensation.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 4 | CMBT-03, CMBT-09 | unit/tdd | `npx vitest run packages/server/src/__tests__/hit-detection.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 4 | NETW-04 | compile | `npx tsc --noEmit -p packages/client/tsconfig.json` | N/A | ⬜ pending |
| 02-06-02 | 06 | 4 | NETW-04, CMBT-02 | compile | `npx tsc --noEmit -p packages/client/tsconfig.json` | N/A | ⬜ pending |
| 02-07-01 | 07 | 5 | SHIP-05, NETW-05 | unit | `npx vitest run packages/server/src/__tests__/reconnect.test.ts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 02-07-02 | 07 | 5 | ALL | manual | Browser test (human-verify checkpoint) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/server/vitest.config.ts` — vitest config for server package (created in Plan 01)
- [ ] `packages/shared/src/__tests__/weapons.test.ts` — weapon mechanics tests (created in Plan 02 TDD)
- [ ] `packages/server/src/__tests__/player-manager.test.ts` — player manager tests (created in Plan 03)
- [ ] `packages/server/src/__tests__/game-server.test.ts` — game server tests (created in Plan 03)
- [ ] `packages/server/src/__tests__/lag-compensation.test.ts` — lag compensation tests (created in Plan 05)
- [ ] `packages/server/src/__tests__/hit-detection.test.ts` — hit detection tests (created in Plan 05)
- [ ] `packages/server/src/__tests__/reconnect.test.ts` — reconnect tests (created in Plan 07)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two players see each other moving smoothly | NETW-03 | Requires two browser windows | Open two tabs, both should see each other |
| Bullets hit remote players | CMBT-05 | Visual + timing dependent | Fire at other player, confirm damage |
| Bombs bounce off walls and deal area damage | CMBT-06 | Visual physics check | Fire bomb near wall, confirm bounce + splash |
| Respawn at safe location | CMBT-08 | Requires death sequence | Die, confirm respawn away from enemies |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
