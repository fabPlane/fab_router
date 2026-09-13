#!/usr/bin/env bun
/**
 * The wall. PreToolUse hook for every tool call in this project.
 *
 * Roles are taken from the hook input's `agent_type`:
 *   implementer | verifier  -> isolated: may only touch this checkout; may never reference the
 *                              reference workspace or anything on the private denylist.
 *   spec-curator            -> tainted: may read anything, may write only spec/ and docs/tasks/S-*.
 *   (anything else / main)  -> orchestrator: may read anything, may never write src/, test/,
 *                              tools/acceptance/.
 *
 * The denylist lives OUTSIDE the repository (FAB_ROUTER_WALL_CONFIG). If it is missing, isolated
 * roles are denied everything (fail closed) and a CONFIG-MISSING event is logged.
 *
 * Every denial is appended to evidence/wall-denials.jsonl (rule id only) and, with the matched
 * text, to the private full log named in the config. See docs/WALL.md for the rule table.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type Role = "implementer" | "verifier" | "spec-curator" | "orchestrator";

interface HookInput {
  session_id?: string; cwd?: string; tool_name?: string; tool_input?: Record<string, unknown>;
  agent_id?: string; agent_type?: string; hook_event_name?: string;
}
interface Config { paths: string[]; words: string[]; fullDenyLog?: string; bannedTermsFile?: string }

const HOME = process.env.HOME ?? "";
const raw = readFileSync(0, "utf8");
let input: HookInput = {};
try { input = JSON.parse(raw); } catch { /* fall through with empty input */ }

const agentType = (input.agent_type ?? "").trim();
const role: Role =
  agentType === "implementer" || agentType === "verifier" || agentType === "spec-curator" ? agentType : "orchestrator";
const isolated = role === "implementer" || role === "verifier";
const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};
const cwd = input.cwd ?? process.cwd();
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? cwd;

function mainRoot(): string {
  // The main checkout (evidence lives there even when a worktree is in use).
  const r = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8" });
  if (r.status === 0) {
    const common = resolve(cwd, r.stdout.trim());
    return dirname(common);
  }
  return projectDir;
}

function deny(rule: string, detail: string): never {
  const root = safe(mainRoot, projectDir);
  const ts = new Date().toISOString();
  const dry = process.env.FAB_ROUTER_WALL_DRYRUN === "1";
  if (!dry) try {
    mkdirSync(resolve(root, "evidence"), { recursive: true });
    appendFileSync(resolve(root, "evidence/wall-denials.jsonl"),
      JSON.stringify({ ts, agent_type: agentType || "main", agent_id: input.agent_id ?? "main", tool, rule }) + "\n");
  } catch { /* never block on logging */ }
  if (!dry) try {
    if (cfg?.fullDenyLog) appendFileSync(cfg.fullDenyLog,
      JSON.stringify({ ts, agent_type: agentType || "main", agent_id: input.agent_id ?? "main", tool, rule, detail, cwd }) + "\n");
  } catch { /* private log is best-effort */ }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `wall rule ${rule}: ${reasonText(rule)}`,
    },
  }));
  process.exit(0);
}
function reasonText(rule: string): string {
  switch (rule) {
    case "T-PATH": case "T-WORD": return "this role may not reference material outside the wall";
    case "P-OUT": case "P-SYMLINK": case "B-TRAVERSE": return "this role may only touch its own checkout";
    case "B-ESCAPE": return "network, symlink and remote commands are not available to this role";
    case "W-SCOPE": return "write outside this role's write set (see docs/WALL.md)";
    case "A-PROMPT": return "implementer/verifier prompts must be exactly 'Task: docs/tasks/<name>.md' and the file must pass spec-lint";
    case "A-SPAWN": return "this role may not spawn agents";
    case "V-RO": return "the verifier is read-only outside evidence/";
    case "CONFIG-MISSING": return "wall configuration is unavailable; isolated roles fail closed";
    default: return "denied";
  }
}
function safe<T>(f: () => T, fallback: T): T { try { return f(); } catch { return fallback; } }

// ---- config -----------------------------------------------------------------------------------
let cfg: Config | undefined;
const cfgPath = process.env.FAB_ROUTER_WALL_CONFIG;
if (cfgPath && existsSync(cfgPath)) {
  try { cfg = JSON.parse(readFileSync(cfgPath, "utf8")); } catch { cfg = undefined; }
}
if (!cfg && isolated) deny("CONFIG-MISSING", cfgPath ?? "(unset)");

// ---- helpers ----------------------------------------------------------------------------------
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach((x) => strings(x, out));
  return out;
}
const allStrings = strings(ti);
const joined = allStrings.join("\n");

function expand(tok: string): string {
  return tok.replace(/^~(?=\/|$)/, HOME).replace(/^\$HOME(?=\/|$)/, HOME).replace(/^\$\{HOME\}/, HOME)
    .replace(/^\$CLAUDE_PROJECT_DIR/, projectDir).replace(/^\$\{CLAUDE_PROJECT_DIR\}/, projectDir);
}
function pathTokens(s: string): string[] {
  const out: string[] = [];
  const re = /(?:~|\$\{?HOME\}?|\$\{?CLAUDE_PROJECT_DIR\}?)?\/[^\s"'`;|&<>()\[\]{}]+|(?:\.\.\/)+[^\s"'`;|&<>()\[\]{}]*|[^\s"'`;|&<>()\[\]{}]*\/\.\.(?:\/[^\s"'`;|&<>()\[\]{}]*)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) { if (m[0]) out.push(m[0]); }
  return out;
}
function relToProject(p: string): string {
  const abs = isAbsolute(p) ? p : resolve(cwd, p);
  const roots = [safe(() => realpathSync(projectDir), projectDir), projectDir, safe(() => realpathSync(cwd), cwd), cwd];
  for (const r of roots) if (abs === r || abs.startsWith(r + "/")) return abs.slice(r.length + 1);
  return abs; // outside: return absolute
}

// ---- isolated roles: T-PATH, T-WORD, P-OUT, P-SYMLINK, B-ESCAPE, B-TRAVERSE --------------------
if (isolated && cfg) {
  const lower = joined.toLowerCase();
  for (const p of cfg.paths) if (lower.includes(p.toLowerCase())) deny("T-PATH", p);
  for (const w of cfg.words) if (lower.includes(w.toLowerCase())) deny("T-WORD", w);

  const allowedRoots = new Set<string>();
  for (const r of [projectDir, cwd, safe(mainRoot, projectDir)]) {
    allowedRoots.add(r); allowedRoots.add(safe(() => realpathSync(r), r));
  }
  for (const r of [`${HOME}/.bun`, `${HOME}/.cache/bun`, `${HOME}/.bunfig.toml`, `${HOME}/.npmrc`]) allowedRoots.add(r);
  const systemOk = ["/usr", "/bin", "/sbin", "/opt", "/etc", "/Library", "/System", "/dev", "/private/tmp", "/tmp", "/private/var", "/var", "/private/etc", "/Applications"];
  const scratch = /^\/(?:private\/)?tmp\/claude-\d+\//;

  function inAllowed(abs: string): boolean {
    for (const r of allowedRoots) if (abs === r || abs.startsWith(r + "/")) return true;
    if (scratch.test(abs)) return true;
    for (const s of systemOk) if (abs === s || abs.startsWith(s + "/")) return true;
    return false;
  }
  // The agent's own checkout: a worktree lives under the main checkout, so `..` must be judged
  // against the worktree root, not the main root.
  const wtRootRaw = safe(() => { const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : cwd; }, cwd);
  const wtRoot = safe(() => realpathSync(wtRootRaw), wtRootRaw);
  for (const s of allStrings) {
    for (const tokRaw of pathTokens(s)) {
      const tok = expand(tokRaw);
      const abs = isAbsolute(tok) ? resolve(tok) : resolve(cwd, tok);
      if (tokRaw.includes("..")) {
        const real = safe(() => realpathSync(abs), abs);
        if (!(real === wtRoot || real.startsWith(wtRoot + "/"))) deny("B-TRAVERSE", tokRaw);
      }
      const isHomeOrVolume = abs.startsWith("/Users/") || abs.startsWith("/Volumes/") || abs.startsWith("/home/");
      if (isHomeOrVolume && !inAllowed(abs)) deny(tokRaw.includes("..") ? "B-TRAVERSE" : "P-OUT", tokRaw);
      const real = safe(() => realpathSync(abs), abs);
      if (real !== abs && (real.startsWith("/Users/") || real.startsWith("/Volumes/")) && !inAllowed(real)) deny("P-SYMLINK", `${tokRaw} -> ${real}`);
    }
  }
  if (tool === "Bash") {
    const cmd = String(ti.command ?? "");
    const escapes = [
      /\bln\s+-s/, /\bcurl\b/, /\bwget\b/, /\bssh\b/, /\bscp\b/, /\brsync\b/, /\bnc\b/, /\bnpx\b/, /\bsudo\b/,
      /\bgit\s+(?:remote|fetch|clone|push|pull|submodule|worktree)\b/, /\bopen\s/, /\bosascript\b/, /\bgh\s/,
      /\bnpm\s+(?:view|install|i|add|exec)\b/, /\bbun\s+(?:add|x|pm)\b/, /\bbun\s+install\s+\S/, /\bpip3?\s+install\b/,
      /\bfetch\(/, /urllib|http\.client|requests\./,
    ];
    for (const re of escapes) if (re.test(cmd)) deny("B-ESCAPE", re.source);
  }
  if (tool === "Agent") deny("A-SPAWN", String(ti.subagent_type ?? ""));
  if (tool === "WebFetch" || tool === "WebSearch") deny("B-ESCAPE", tool);
}

// ---- W-SCOPE / V-RO: write sets ----------------------------------------------------------------
const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const writeSet: Record<Role, { allow: RegExp[]; denyAll?: boolean }> = {
  implementer: { allow: [/^src\//, /^test\//, /^tools\/acceptance\//] },
  verifier: { allow: [/^evidence\/(?:reports|similarity)\//] },
  "spec-curator": { allow: [/^spec\//, /^docs\/tasks\/S-/] },
  orchestrator: { allow: [/^(?!src\/|test\/|tools\/acceptance\/)/] },
};
function checkWritePath(rel: string, rule: string) {
  const ws = writeSet[role];
  if (isAbsolute(rel)) { if (role === "orchestrator" || role === "spec-curator") return; deny(rule, rel); }
  if (!ws.allow.some((re) => re.test(rel))) deny(rule, rel);
}
if (WRITE_TOOLS.has(tool)) {
  const fp = String(ti.file_path ?? ti.notebook_path ?? "");
  if (fp) checkWritePath(relToProject(fp), role === "verifier" ? "V-RO" : "W-SCOPE");
}
if (tool === "Bash") {
  const cmd = String(ti.command ?? "");
  const writeish = /(?:^|[^<])>|\btee\b|\bcp\b|\bmv\b|\bmkdir\b|\btouch\b|\bsed\s+-i|\brm\b|\bcat\s*>|\bchmod\b|\binstall\b/.test(cmd);
  if (writeish) {
    const repoTokens = cmd.match(/(?:^|[\s"'=])((?:\.\/)?(?:src|test|tools|spec|docs|evidence|\.claude)\/[^\s"';|&<>()]*)/g) ?? [];
    for (const t0 of repoTokens) {
      const rel = t0.trim().replace(/^["'=]/, "").replace(/^\.\//, "");
      if (role === "verifier") { if (!/^evidence\/(?:reports|similarity)\//.test(rel)) deny("V-RO", rel); continue; }
      if (!writeSet[role].allow.some((re) => re.test(rel))) {
        // `bun run tools/acceptance/run.ts > x` is a read of tools/; only deny when the token is a write target.
        const isTarget = new RegExp(`(?:>\\s*|tee\\s+(?:-a\\s+)?|cp\\s+\\S+\\s+|mv\\s+\\S+\\s+|mkdir\\s+(?:-p\\s+)?|touch\\s+|sed\\s+-i[^\\s]*\\s+(?:'[^']*'|\\S+)\\s+|rm\\s+(?:-\\S+\\s+)*)(?:\\./)?${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(cmd);
        if (isTarget) deny("W-SCOPE", rel);
      }
    }
  }
}

// ---- A-PROMPT: only task files reach isolated agents ---------------------------------------------
if (tool === "Agent" && !isolated) {
  const st = String(ti.subagent_type ?? "");
  if (st === "implementer" || st === "verifier") {
    const prompt = String(ti.prompt ?? "");
    const m = /^Task: (docs\/tasks\/[A-Za-z0-9-]+\.md)\s*$/.exec(prompt);
    if (!m) deny("A-PROMPT", prompt.slice(0, 80));
    const file = resolve(projectDir, m[1]!);
    if (!existsSync(file)) deny("A-PROMPT", `missing ${m[1]}`);
    const lint = process.env.FAB_ROUTER_SPEC_LINT;
    if (!lint || !existsSync(lint)) deny("A-PROMPT", "spec-lint unavailable");
    const r = spawnSync("bun", ["run", lint, "--repo", projectDir, m[1]!], { encoding: "utf8" });
    if (r.status !== 0) deny("A-PROMPT", `spec-lint failed on ${m[1]}: ${r.stdout.slice(0, 200)}`);
  }
}
process.exit(0);
