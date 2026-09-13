#!/usr/bin/env bun
/** Thin wrapper: runs the private spec-lint (path from FAB_ROUTER_SPEC_LINT) over the repo. */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const lint = process.env.FAB_ROUTER_SPEC_LINT;
if (!lint || !existsSync(lint)) { console.error("spec:lint: FAB_ROUTER_SPEC_LINT is not set or missing"); process.exit(2); }
const repo = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const r = spawnSync("bun", ["run", lint, "--repo", repo, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
