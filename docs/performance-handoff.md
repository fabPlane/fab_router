# Performance experiment handoff — 2026-10-20

The finite performance run ends at cycle 110. No new engine experiment is started in this final cycle. This document records review locations and unresolved validation limits; it does not adopt the rejected projection candidate or claim a new speed gain. No PR was merged by this agent.

## Review inventory

All 13 owned open router PRs below had identical local branch, remote branch and PR head commits at the final-cycle audit. All were ready for review, with automatic merging disabled. The API reported no check runs for these PRs, so green remote CI cannot be claimed. These observations are a dated snapshot, not a guarantee about future checks.

| PR                                                    | Branch                                   | Audited head   |
| ----------------------------------------------------- | ---------------------------------------- | -------------- |
| [#48](https://github.com/fabPlane/fab_router/pull/48) | `agent/fab-router-perf-projection-reuse` | `f6e8b761bca7` |
| [#47](https://github.com/fabPlane/fab_router/pull/47) | `agent/fab-router-perf-search-profile`   | `fcce90c6a936` |
| [#37](https://github.com/fabPlane/fab_router/pull/37) | `agent/fab-router-perf-local-rescue`     | `c90b8512a3f8` |
| [#36](https://github.com/fabPlane/fab_router/pull/36) | `agent/fab-router-perf-sort`             | `6b8dfc3cc856` |
| [#35](https://github.com/fabPlane/fab_router/pull/35) | `agent/fab-router-perf-sweep-bounds`     | `46a3dd5206b4` |
| [#33](https://github.com/fabPlane/fab_router/pull/33) | `agent/fab-router-perf-point`            | `3636f6844845` |
| [#29](https://github.com/fabPlane/fab_router/pull/29) | `agent/fab-router-perf-capsule`          | `6ddc94c6c59c` |
| [#25](https://github.com/fabPlane/fab_router/pull/25) | `agent/fab-router-perf-distance`         | `3a4d39bac8b9` |
| [#23](https://github.com/fabPlane/fab_router/pull/23) | `agent/fab-router-perf-segment`          | `a15502be2bdd` |
| [#21](https://github.com/fabPlane/fab_router/pull/21) | `agent/fab-router-perf-bounds`           | `358227d373f4` |
| [#17](https://github.com/fabPlane/fab_router/pull/17) | `agent/fab-router-perf-grid`             | `25a10169803d` |
| [#10](https://github.com/fabPlane/fab_router/pull/10) | `agent/fab-router-perf-ring`             | `5dfee2687a94` |
| [#4](https://github.com/fabPlane/fab_router/pull/4)   | `agent/fab-router-perf`                  | `08b298955b6e` |

The projection PR's audited head predates this handoff-only follow-up. Its retained experiment and measurements are unchanged. The performance baseline scratch checkout is an unmodified main-based control, not an unpublished optimization.

Consumer [PR #38](https://github.com/fabPlane/fab_pcb/pull/38), branch `agent/router-perf-public-recovery`, was pushed at `80538dda88fe`. Its formatting repair and evidence-verifier fix are already published. All four remote jobs remained queued at audit, including the unit formatting gate. Local format, type and supported router unit checks passed in the earlier repair cycles; remote success remains unconfirmed. Consumer PRs #46 and #49 belong to other topics and were not modified.

## Measurement limits and rejected work

The latest projection experiment has three alternating pairs per case on the same host and cores. Its [complete evidence and reproduction instructions](pr-assets/agent-fab-router-perf-projection-reuse/README.md) preserve all attempts, including the excluded initial overlapping pair. The candidate remains rejected: aggregate time rose 0.54%, with regressions in individual median/p95 measurements. Every valid paired session was byte-identical; this is engine replay evidence, not native DRC certification.

The previous full native strict-left edge-filter experiment used the same 26 cases and three repeats per variant. It was also rejected:

| Metric                           |      Control | Rejected candidate |
| -------------------------------- | -----------: | -----------------: |
| Passed runs / 78                 |           39 |                 39 |
| Cases valid in all three repeats |           13 |                 13 |
| Opens                            |          120 |                120 |
| Introduced native thermal errors |           27 |                 27 |
| Vias                             |         2826 |               2826 |
| Total route length, mm           | 58809.321397 |       58809.321397 |
| Overall median route seconds     |     1.066495 |           1.151887 |
| Overall p95 route seconds        |    13.757288 |          15.034727 |
| Sum of route seconds             |   322.909072 |         363.431232 |

These are historical cycle-94 measurements retained on PR #37, not a current-main baseline or a new final-cycle benchmark. The unchanged thermal findings prevent a clean-quality claim. Rejected index, allocation, heap, visited-table and search microchanges must not be adopted solely from synthetic wins or favorable aggregate timing.

![Retained focused projection timings](pr-assets/agent-fab-router-perf-projection-reuse/chart.png)

## Remaining work

Local recovery in PR #37 stays opt-in and disabled by default. Native thermal findings and near-complete stalls remain unresolved. The latest focused rejection did not trigger new dense-board, ladder or complete slow-acceptance runs. A future engine adoption requires the full paired 26×3 native benchmark, dense and ladder checks, completion/DRC nonregression, and comparable via count and length. Review the historical profile in PR #47 with its sampling and JIT attribution limits before choosing a distinct hotspot.

To verify this branch's retained evidence without routing, from repository root:

```bash
p=docs/pr-assets/agent-fab-router-perf-projection-reuse
PYTHONDONTWRITEBYTECODE=1 python3 "$p/verify.py"
PYTHONDONTWRITEBYTECODE=1 python3 "$p/test_verify.py"
PYTHONDONTWRITEBYTECODE=1 python3 -O "$p/test_verify.py"
bun run typecheck
bun run check:layers
bun run test
```

Older evidence branches may need formatting repair before any future push; preserve checksum-controlled fixture bytes through scoped ignore entries and regenerate manifests when documentation hashes change. No fixture, checker, scoring rule, engine source or consumer pin changes in this final handoff.
