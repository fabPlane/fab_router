#!/usr/bin/env bun
/**
 * Import-boundary check. Modules under src/ are ordered in layers; a module may import only from
 * its own layer or a lower one. `spec/types` may be imported by anyone. Cycles across layers fail.
 *
 *   geom -> layout -> lattice -> drc -> route -> pipeline -> {dsn, ses, srj} -> api -> cli
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const ORDER: string[][] = [["geom"], ["layout"], ["lattice"], ["drc"], ["route"], ["pipeline"], ["dsn", "ses", "srj"], ["api"], ["cli"]];
const rank = new Map<string, number>();
ORDER.forEach((names, i) => names.forEach((n) => rank.set(n, i)));

function layerOf(file: string): string | undefined {
  const rel = relative(resolve(root, "src"), file);
  if (rel.startsWith("..")) return undefined;
  const top = rel.split("/")[0]!;
  if (top.endsWith(".ts")) return top.replace(/\.ts$/, ""); // src/api.ts, src/cli.ts
  return top;
}
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) { const p = join(dir, e); statSync(p).isDirectory() ? walk(p, out) : p.endsWith(".ts") && out.push(p); }
  return out;
}
const transpiler = new Bun.Transpiler({ loader: "ts" });
let bad = 0, files = 0;
for (const f of walk(resolve(root, "src"))) {
  files++;
  const from = layerOf(f);
  if (from === undefined) continue;
  const fromRank = rank.get(from);
  if (fromRank === undefined) { console.log(`unknown layer '${from}' for ${relative(root, f)} (add it to ORDER)`); bad++; continue; }
  for (const imp of transpiler.scanImports(readFileSync(f, "utf8"))) {
    if (!imp.path.startsWith(".")) continue;
    const target = resolve(dirname(f), imp.path);
    if (target.includes("/spec/types")) continue;
    const to = layerOf(target);
    if (to === undefined) continue;
    const toRank = rank.get(to);
    if (toRank === undefined) { console.log(`unknown layer '${to}' imported by ${relative(root, f)}`); bad++; continue; }
    if (toRank > fromRank) { console.log(`layer violation: ${relative(root, f)} (${from}) imports ${imp.path} (${to})`); bad++; }
  }
}
console.log(`check:layers: ${files} file(s), ${bad} violation(s)`);
process.exit(bad ? 1 : 0);
