Full **unchanged-production** native verification, same 26 cases × 3 repeats, same host and cores 12–19, compared with cycle 26. All 78 sessions, pass outcomes, opens, new errors, via counts and lengths match exactly. Production source, inputs, settings, runtime, checker and execution order match.

| Native metric | Prior control | Current unchanged production |
| --- | ---: | ---: |
| Passed / valid 3-of-3 cases | 39/78 / 13/26 | 39/78 / 13/26 |
| Opens | 120 | 120 |
| New native errors | 27 | 27 |
| Attempt median / p95 seconds | 1.121 / 18.307 | 1.105 / 16.325 |
| Total route seconds | 391.930 | 387.039 |

The 27 existing thermal errors remain unresolved: **not native DRC clean**. Shared-host timings overlap required tests; no speed gain claimed. [Per-case median/p95, quality, vias and length](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/region-checks/native-tables.md).
