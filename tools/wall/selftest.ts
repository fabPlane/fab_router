#!/usr/bin/env bun
/**
 * Wall self-test.
 *
 *   bun run wall:selftest              offline: feed synthetic tool calls through the hook and
 *                                      assert each rule fires (no evidence is written).
 *   bun run wall:selftest -- --probe-check <ISO-ts>
 *                                      after the orchestrator has run the live probe
 *                                      (docs/tasks/wall-probe.md) with a real implementer agent:
 *                                      assert the expected denials were logged since <ISO-ts>.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const args = process.argv.slice(2);

if (args[0] === "--probe-check") {
  const since = args[1] ?? "1970-01-01T00:00:00Z";
  const log = resolve(root, "evidence/wall-denials.jsonl");
  const lines = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const recent = lines.filter((l) => l.ts >= since && l.agent_type === "implementer");
  const want = ["B-TRAVERSE", "P-OUT", "B-ESCAPE", "W-SCOPE"]; // T-PATH/T-WORD are covered offline: naming a denylisted term in the probe would fail spec-lint
  let ok = true;
  for (const w of want) {
    const hit = recent.some((l) => l.rule === w);
    console.log(`${hit ? "ok  " : "MISS"} ${w}`);
    if (!hit) ok = false;
  }
  console.log(`${recent.length} implementer denial(s) since ${since}`);
  process.exit(ok ? 0 : 1);
}

const P = root;
type Case = [name: string, expect: "allow" | "deny", input: Record<string, unknown>, rule?: string];
const call = (agent_type: string | undefined, tool_name: string, tool_input: Record<string, unknown>) =>
  ({ ...(agent_type ? { agent_type } : {}), cwd: P, tool_name, tool_input });
// A path outside this checkout under the user's home; the hook must refuse it for isolated roles.
const OUTSIDE = `${process.env.HOME}/projects/somewhere-else/x.ts`;
const cases: Case[] = [
  ["impl Read outside checkout", "deny", call("implementer", "Read", { file_path: OUTSIDE }), "P-OUT"],
  ["impl Read spec", "allow", call("implementer", "Read", { file_path: `${P}/spec/README.md` })],
  ["impl Bash traverse", "deny", call("implementer", "Bash", { command: "cat ../../x" }), "B-TRAVERSE"],
  ["impl Bash curl", "deny", call("implementer", "Bash", { command: "curl http://x" }), "B-ESCAPE"],
  ["impl Bash git push", "deny", call("implementer", "Bash", { command: "git push origin main" }), "B-ESCAPE"],
  ["impl Bash git commit", "allow", call("implementer", "Bash", { command: "git add -A && git commit -m x" })],
  ["impl Write spec", "deny", call("implementer", "Write", { file_path: `${P}/spec/x.md`, content: "x" }), "W-SCOPE"],
  ["impl Write src", "allow", call("implementer", "Write", { file_path: `${P}/src/x.ts`, content: "x" })],
  ["impl Bash write spec", "deny", call("implementer", "Bash", { command: "cat > spec/x.md <<EOF\nx\nEOF" }), "W-SCOPE"],
  ["impl Bash write src", "allow", call("implementer", "Bash", { command: "mkdir -p src/geom && cat > src/geom/x.ts <<EOF\nx\nEOF" })],
  ["impl Agent", "deny", call("implementer", "Agent", { prompt: "x", subagent_type: "Explore" }), "A-SPAWN"],
  ["impl WebFetch", "deny", call("implementer", "WebFetch", { url: "https://example.com" }), "B-ESCAPE"],
  ["impl ~ path", "deny", call("implementer", "Bash", { command: "ls ~/projects" }), "P-OUT"],
  ["impl bun toolchain", "allow", call("implementer", "Bash", { command: "ls $HOME/.bun/bin" })],
  ["orch Write src", "deny", call(undefined, "Write", { file_path: `${P}/src/x.ts`, content: "x" }), "W-SCOPE"],
  ["orch Write spec", "allow", call(undefined, "Write", { file_path: `${P}/spec/x.md`, content: "x" })],
  ["orch Bash mkdir src", "deny", call(undefined, "Bash", { command: "mkdir -p src/geom" }), "W-SCOPE"],
  ["orch Bash read src", "allow", call(undefined, "Bash", { command: "cat src/x.ts | head" })],
  ["orch Agent impl bad prompt", "deny", call(undefined, "Agent", { prompt: "build it", subagent_type: "implementer" }), "A-PROMPT"],
  ["orch Agent impl missing task", "deny", call(undefined, "Agent", { prompt: "Task: docs/tasks/nope.md", subagent_type: "implementer" }), "A-PROMPT"],
  ["orch Agent Explore", "allow", call(undefined, "Agent", { prompt: "look", subagent_type: "Explore" })],
  ["curator Write src", "deny", call("spec-curator", "Write", { file_path: `${P}/src/x.ts`, content: "x" }), "W-SCOPE"],
  ["curator Write docs/PLAN", "deny", call("spec-curator", "Write", { file_path: `${P}/docs/PLAN.md`, content: "x" }), "W-SCOPE"],
  ["curator Write spec", "allow", call("spec-curator", "Write", { file_path: `${P}/spec/formats/dsn.md`, content: "x" })],
  ["verifier Write evidence", "allow", call("verifier", "Write", { file_path: `${P}/evidence/reports/M2.md`, content: "x" })],
  ["verifier Write src", "deny", call("verifier", "Write", { file_path: `${P}/src/x.ts`, content: "x" }), "V-RO"],
  ["verifier Bash tee src", "deny", call("verifier", "Bash", { command: "bun test | tee src/out.txt" }), "V-RO"],
  ["verifier Bash tee evidence", "allow", call("verifier", "Bash", { command: "bun test 2>&1 | tee evidence/reports/M2.log" })],
];
// Worktree simulation: an agent whose cwd is a worktree under .claude/worktrees/ must see its own
// spec/ and src/ as spec/ and src/, not as .claude/worktrees/<name>/spec/.
const WT = `${P}/.claude/worktrees/selftest-sim`;
const wcall = (agent_type: string, tool_name: string, tool_input: Record<string, unknown>) => ({ agent_type, cwd: WT, tool_name, tool_input });
cases.push(["impl worktree Write src", "allow", wcall("implementer", "Write", { file_path: `${WT}/src/geom/x.ts`, content: "x" })]);
cases.push(["impl worktree Write spec", "deny", wcall("implementer", "Write", { file_path: `${WT}/spec/x.md`, content: "x" }), "W-SCOPE"]);
cases.push(["curator worktree Edit spec", "allow", wcall("spec-curator", "Edit", { file_path: `${WT}/spec/formats/dsn.md`, old_string: "a", new_string: "b" })]);
cases.push(["curator worktree Write src", "deny", wcall("spec-curator", "Write", { file_path: `${WT}/src/x.ts`, content: "x" }), "W-SCOPE"]);
// The denylist itself is private; add its first path and word as cases when the config is reachable.
const cfgPath = process.env.FAB_ROUTER_WALL_CONFIG;
if (cfgPath && existsSync(cfgPath)) {
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cases.push(["impl Read denylisted path", "deny", call("implementer", "Read", { file_path: `/x/${cfg.paths[0]}/y` }), "T-PATH"]);
  cases.push(["impl Grep denylisted word", "deny", call("implementer", "Grep", { pattern: cfg.words[0], path: "src" }), "T-WORD"]);
}
let pass = 0, fail = 0;
const env = { ...process.env, CLAUDE_PROJECT_DIR: P, FAB_ROUTER_WALL_DRYRUN: "1" };
for (const [name, expect, input, rule] of cases) {
  const r = spawnSync("bun", ["run", resolve(P, "tools/wall/pretooluse.ts")], { input: JSON.stringify(input), encoding: "utf8", env });
  const got = r.stdout.trim() ? "deny" : "allow";
  const gotRule = /wall rule ([A-Z-]+)/.exec(r.stdout)?.[1];
  const ok = got === expect && (!rule || rule === gotRule);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got}${gotRule ? " " + gotRule : ""}${ok ? "" : ` (expected ${expect} ${rule ?? ""})`}`);
}
// fail-closed check
const r = spawnSync("bun", ["run", resolve(P, "tools/wall/pretooluse.ts")], {
  input: JSON.stringify(call("implementer", "Read", { file_path: `${P}/spec/README.md` })), encoding: "utf8",
  env: { ...env, FAB_ROUTER_WALL_CONFIG: "" } });
const closed = /CONFIG-MISSING/.test(r.stdout); closed ? pass++ : fail++;
console.log(`${closed ? "ok  " : "FAIL"} isolated role fails closed without config`);
console.log(`wall:selftest ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
