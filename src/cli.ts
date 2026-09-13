/**
 * `src/cli.ts` — command line front end (spec/api/contract.md "CLI").
 *
 *   bun run src/cli.ts route <in.dsn> -o <out.ses> [--rules f] [--set k=v]... [--json report.json]
 *   bun run src/cli.ts drc <in.dsn>
 *   bun run src/cli.ts stats <in.dsn>
 *
 * Exit 0 on success, 2 on parse failure, 3 on an R-1 breach (router-added violations).
 * `--set k=v` sets a RouteSettings field: numbers and booleans are parsed, `layers.<Sheet>.<field>`
 * addresses a per-Sheet override, anything else is kept as a string.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { RouteSettings, SheetOverride } from "../spec/types/settings.ts";
import { applyRules, checkDrc, layoutStats, readDsn, readRules, route, writeSes } from "./api.ts";

interface Args { command: string; input?: string; out?: string | undefined; rules?: string | undefined; json?: string | undefined; sets: string[] }

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? "", sets: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-o" || a === "--out") args.out = argv[++i];
    else if (a === "--rules") args.rules = argv[++i];
    else if (a === "--json") args.json = argv[++i];
    else if (a === "--set") args.sets.push(argv[++i] ?? "");
    else if (!args.input) args.input = a;
  }
  return args;
}

function parseValue(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v)) return Number(v);
  return v;
}

export function settingsFromSets(sets: readonly string[]): Partial<RouteSettings> {
  const s: Partial<RouteSettings> = {};
  for (const kv of sets) {
    const eq = kv.indexOf("=");
    if (eq < 0) continue;
    const key = kv.slice(0, eq), value = parseValue(kv.slice(eq + 1));
    const m = /^layers\.(.+)\.(active|preferDir|alongCost|againstCost)$/.exec(key);
    if (m) {
      const layers = (s.layers ??= {});
      const o: SheetOverride = layers[m[1]!] ?? {};
      (o as unknown as Record<string, unknown>)[m[2]!] = value;
      layers[m[1]!] = o;
      continue;
    }
    if (key === "ignoreNetGroups") { s.ignoreNetGroups = String(value).split(",").filter(Boolean); continue; }
    (s as unknown as Record<string, unknown>)[key] = value;
  }
  return s;
}

function usage(): number {
  console.error("usage: cli.ts route <in.dsn> -o <out.ses> [--rules f] [--set k=v]... [--json report.json] | drc <in.dsn> | stats <in.dsn>");
  return 1;
}

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  if (!args.input || !["route", "drc", "stats"].includes(args.command)) return usage();
  const text = readFileSync(args.input, "utf8");
  const read = readDsn(text, { name: args.input.replace(/^.*\//, "") });
  if (!read.ok) {
    console.error(`parse failure: ${read.error.message} (line ${read.error.line}, column ${read.error.column})`);
    for (const d of read.diagnostics) console.error(`  ${d.level}: ${d.code}: ${d.message}`);
    return 2;
  }
  let layout = read.layout;
  if (args.rules) {
    const rr = readRules(readFileSync(args.rules, "utf8"));
    if (!rr.ok) { console.error(`rules failure: ${rr.error.message}`); return 2; }
    layout = applyRules(layout, rr.rules);
  }
  if (args.command === "drc") {
    const r = checkDrc(layout);
    console.log(JSON.stringify(r, null, 2));
    return 0;
  }
  if (args.command === "stats") {
    console.log(JSON.stringify(layoutStats(layout), null, 2));
    return 0;
  }
  const before = layoutStats(layout);
  const report = route(layout, settingsFromSets(args.sets), {
    onLog: (level, message) => console.error(`${level}: ${message}`),
  });
  const after = layoutStats(layout);
  if (args.out) writeFileSync(args.out, writeSes(layout));
  if (args.json) writeFileSync(args.json, JSON.stringify({ report, statsBefore: before, statsAfter: after }, null, 2));
  console.log(`passes ${report.passes}, incomplete ${report.incompleteBefore} -> ${report.incompleteAfter}, added ${report.added.tracks} tracks / ${report.added.barrels} barrels, violations added ${report.violationsAdded}, stopped by ${report.stoppedBy}`);
  return report.violationsAdded > 0 ? 3 : 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
