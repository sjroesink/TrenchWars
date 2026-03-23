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
| **Config file** | packages/shared/vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit -p packages/shared/tsconfig.json && npx tsc --noEmit -p packages/client/tsconfig.json` |
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
| 02-01-01 | 01 | 1 | NETW-01 | unit | `npx vitest run packages/server/src` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | NETW-02 | unit | `npx vitest run packages/server/src` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | CMBT-01,CMBT-02 | unit | `npx vitest run packages/shared/src/weapons.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | CMBT-03,CMBT-04 | unit | `npx vitest run packages/shared/src/weapons.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | NETW-03,NETW-04 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | CMBT-05,CMBT-06 | manual | Browser test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/server/vitest.config.ts` — vitest config for server package
- [ ] `packages/server/src/*.test.ts` — stubs for networking tests
- [ ] `packages/shared/src/weapons.test.ts` — stubs for weapon mechanics

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
