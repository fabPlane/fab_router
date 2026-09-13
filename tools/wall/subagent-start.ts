#!/usr/bin/env bun
/** SubagentStart hook: append one ledger line per spawned agent to evidence/agent-sessions.jsonl. */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

let input: Record<string, unknown> = {};
try { input = JSON.parse(readFileSync(0, "utf8")); } catch { /* empty */ }
const cwd = String(input.cwd ?? process.cwd());
const g = (args: string[]) => { const r = spawnSync("git", args, { cwd, encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : ""; };
const common = g(["rev-parse", "--git-common-dir"]);
const root = common ? dirname(resolve(cwd, common)) : (process.env.CLAUDE_PROJECT_DIR ?? cwd);
const line = {
  ts: new Date().toISOString(),
  agent_type: input.agent_type ?? "",
  agent_id: input.agent_id ?? "",
  session_id: input.session_id ?? "",
  cwd,
  head: g(["rev-parse", "HEAD"]),
  spec_tree: g(["rev-parse", "HEAD:spec"]),
};
try {
  mkdirSync(resolve(root, "evidence"), { recursive: true });
  appendFileSync(resolve(root, "evidence/agent-sessions.jsonl"), JSON.stringify(line) + "\n");
} catch { /* best effort */ }
process.exit(0);
