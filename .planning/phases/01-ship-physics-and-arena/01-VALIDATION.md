---
phase: 1
slug: ship-physics-and-arena
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PHYS-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | PHYS-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | PHYS-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | PHYS-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | PHYS-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | PHYS-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-07 | 01 | 1 | PHYS-07 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | MAPS-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | MAPS-02 | manual | browser check | N/A | ⬜ pending |
| 01-02-03 | 02 | 1 | MAPS-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` — install test framework
- [ ] `packages/shared/tests/physics.test.ts` — stubs for PHYS-01 through PHYS-07
- [ ] `packages/shared/tests/tilemap.test.ts` — stubs for MAPS-01, MAPS-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ship movement feels like SubSpace | PHYS-06 | Subjective feel comparison | Open browser, fly ship, compare rotation/thrust/drift to original SubSpace |
| Arena map renders correctly | MAPS-02 | Visual rendering check | Open browser, verify map tiles render with walls and corridors |
| Afterburner visual effect | PHYS-07 | Visual effect validation | Press afterburner key, verify speed boost and energy drain visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
