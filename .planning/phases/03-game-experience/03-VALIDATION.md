---
phase: 03
slug: game-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
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

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HUD displays energy bar and kill/death | UIEX-01 | Visual layout check | Play game, verify HUD elements visible |
| Radar shows other players | UIEX-04 | Visual rendering | Open 2 tabs, verify dots on minimap |
| Glow/bloom visual effects | UIEX-07 | Aesthetic judgment | Verify neon glow on ships and projectiles |
| Sound effects play correctly | UIEX-08 | Audio output | Thrust, fire, explosion sounds audible |
| Team arena elimination rounds | MODE-02 | Multi-player flow | Play team match through to completion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
