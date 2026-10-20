Full unchanged-production native verification: same 26 cases × 3 repeats, host and cores 12–19, compared with cycle 28. All 78 sessions, pass outcomes, opens, new errors, vias and lengths match exactly. All 91 production source files, inputs, settings, runtime, checker and execution order match. This sweep does not invoke the research proposal and is not evidence of native safety for its new copper.

| Native metric | Prior control | Current unchanged production |
| --- | ---: | ---: |
| Passed / valid 3-of-3 cases | 39/78 / 13/26 | 39/78 / 13/26 |
| Opens | 120 | 120 |
| New native errors | 27 | 27 |
| Attempt median / p95 seconds | 1.118 / 20.329 | 1.109 / 16.532 |
| Total route seconds | 393.773 | 383.787 |

The 27 existing thermal errors remain unresolved: **not native DRC clean**. Shared-host timings overlap tests; no speed gain claimed. [Per-case median/p95, quality, vias and length](https://github.com/fabPlane/fab_router/blob/agent/fab-router-perf-local-rescue/docs/pr-assets/agent-fab-router-perf-local-rescue/visibility-checks/native-tables.md).
