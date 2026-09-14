#!/usr/bin/env bun
/**
 * Route the fine-pitch fanout fixtures with fab_router and report DRC-clean + completion, to answer
 * "how does fab_router do on the boards the tscircuit router fails DRC on" (docs/router-issues.md).
 * Runs existing fab_router code only — no src changes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeSrj } from "../../src/api.ts";
import type { SimpleRouteJson } from "../../spec/types/srj.ts";

const budget = Number(process.argv[2] ?? "60") * 1000;
const dir = resolve(import.meta.dir, "../../spec/acceptance/boards");
for (const name of ["fabdesk-qfn28-fanout", "fabdesk-usbc-fanout"]) {
  const srj = JSON.parse(readFileSync(resolve(dir, `${name}.srj.json`), "utf8")) as SimpleRouteJson;
  const t0 = Date.now();
  const r = routeSrj(srj, { timeBudgetMs: budget, fanoutEnabled: true, detailedRouter: "tiles" });
  const rep = r.report;
  console.log(JSON.stringify({
    board: name, nets: srj.connections.length,
    ok: r.ok,
    completed: rep?.completed, incomplete: rep?.incompleteAfter,
    addedTracks: rep?.added?.tracks, addedBarrels: rep?.added?.barrels,
    violationsBefore: r.violationsBefore, violationsAdded: r.violationsAdded,
    stoppedBy: rep?.stoppedBy, ms: Date.now() - t0,
  }));
}
