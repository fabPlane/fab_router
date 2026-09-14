// SPIKE I17 measurement runner (temporary). Routes each target board with detailedNegotiation on
// (and once off, for the M9-loop comparison) under a generous budget, appending one JSON line per
// run to tools/acceptance/i17-logs/results.jsonl inside the checkout.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readDsn, route, checkDrc } from "../../src/api.ts";

const boards = [
  ["bm07", "Issue508-DAC2020_bm07.dsn"],
  ["cm5-carrier", "cm5-carrier.dsn"],
  ["green14seg", "Issue034-Green14SegLED.dsn"],
  ["bm01", "Issue508-DAC2020_bm01.dsn"],
] as const;
const budgetS = Number(process.argv[2] ?? "240");
const modes = (process.argv[3] ?? "dn").split(",");   // "dn", "off", or "dn,off"
const dir = new URL("../../spec/acceptance/boards/", import.meta.url).pathname;
const out = new URL("../../tools/acceptance/i17-logs/results.jsonl", import.meta.url).pathname;
mkdirSync(new URL("../../tools/acceptance/i17-logs/", import.meta.url).pathname, { recursive: true });
writeFileSync(out, "");

for (const [name, file] of boards) {
  const text = readFileSync(dir + file, "latin1");
  for (const mode of modes) {
    const dn = mode === "dn";
    const read = readDsn(text);
    if (!read.ok) { console.log("parse fail", file); continue; }
    const layout = read.layout;
    const passInc: number[] = [];
    const passClock: number[] = [];
    const t0 = Date.now();
    let last = t0;
    const report = route(layout, {
      detailedNegotiation: dn,
      timeBudgetMs: budgetS * 1000,
      maxPasses: 1000,
      maxStagnantPasses: dn ? 100000 : 3,
      optimizerEnabled: false,
    }, {
      onPass: (e) => { const n = Date.now(); passInc.push(e.incomplete); passClock.push(n - last); last = n; },
    });
    const after = checkDrc(layout).counts;
    const rec = {
      board: name, file, mode,
      incompleteBefore: report.incompleteBefore,
      incompleteAfter: report.incompleteAfter,
      bestSeen: passInc.length ? Math.min(...passInc) : report.incompleteAfter,
      passes: report.passes,
      wallClockMs: report.wallClockMs,
      violationsAdded: report.violationsAdded,
      stoppedBy: report.stoppedBy,
      drcViolationsAfter: after.violations,
      firstPassMs: passClock[0] ?? null,
      medianPassMs: passClock.length ? [...passClock].sort((a, b) => a - b)[Math.floor(passClock.length / 2)] : null,
      passIncSeries: passInc,
    };
    appendFileSync(out, JSON.stringify(rec) + "\n");
    console.log(`${name} ${mode}: after=${report.incompleteAfter} best=${rec.bestSeen} passes=${report.passes} ${(report.wallClockMs / 1000).toFixed(0)}s vAdded=${report.violationsAdded} stop=${report.stoppedBy}`);
  }
}
console.log("DONE");
