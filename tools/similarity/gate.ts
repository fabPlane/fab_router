#!/usr/bin/env bun
/**
 * Similarity gate (release evidence for the clean-room).
 *
 * Compares every file under src/ and test/ against the reference trees named in the private
 * configuration (FAB_ROUTER_WALL_CONFIG -> similarityFile). Technique: identifier-normalised
 * token streams, k-gram hashing with winnowing (Schleimer, Wilkerson & Aiken, "Winnowing: local
 * algorithms for document fingerprinting", SIGMOD 2003). Reports:
 *
 *   - RUN:   a shared run of >= RUN_TOKENS normalised tokens with any reference file
 *   - PAIR:  a file whose winnowed fingerprints overlap a reference file by >= PAIR_RATIO
 *   - IDENT: a banned identifier (length >= 8) from the private banned-terms list appearing as a
 *            whole word in a candidate file
 *   - CONST: a non-trivial numeric literal shared with a reference file
 *
 * The report written to evidence/similarity/<milestone>.json names reference files only by an
 * opaque id (orig#NNN); the id -> path map is written to the private workspace. Nothing from the
 * reference trees' contents is printed.
 *
 * Usage: bun run similarity -- --milestone M2 [--src src,test] [--k 20] [--w 8]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const RUN_TOKENS = 40;
const PAIR_RATIO = 0.15;
const IDENT_MIN = 8;

const argv = process.argv.slice(2);
const opt = (name: string, def: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1]! : def; };
const milestone = opt("--milestone", "adhoc");
const K = Number(opt("--k", "20"));
const W = Number(opt("--w", "8"));
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const candidateDirs = opt("--src", "src,test").split(",").map((d) => resolve(root, d));

const cfgPath = process.env.FAB_ROUTER_WALL_CONFIG;
if (!cfgPath || !existsSync(cfgPath)) { console.error("similarity: FAB_ROUTER_WALL_CONFIG not set"); process.exit(2); }
const wall = JSON.parse(readFileSync(cfgPath, "utf8"));
const sim = JSON.parse(readFileSync(wall.similarityFile, "utf8")) as { trees: { id: string; root: string; ext: string[] }[]; mapOut: string };
const banned = existsSync(wall.bannedTermsFile)
  ? readFileSync(wall.bannedTermsFile, "utf8").split("\n").map((s) => s.trim()).filter((s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && s.length >= IDENT_MIN)
  : [];

// ---- tokenizer (shared for TS and Java) -----------------------------------------------------------
const KEYWORDS = new Set(("abstract as async await boolean break case catch class const continue default delete do double else enum export extends false final finally float for function if implements import in instanceof int interface let long new null package private protected public return short static super switch this throw throws true try typeof var void volatile while yield readonly type number string undefined never unknown any object").split(" "));
const TRIVIAL = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 32, 64, 100, 128, 255, 256, 360, 512, 1000, 1024, 4096, 65535, 65536, 1e6, 1e9, 0.5, 0.25, 180, 90, 45, 2, 1e-6, 1e-9, 1e-3]);
interface Tok { t: string; n?: number }
function tokenize(src: string): { toks: string[]; consts: Set<number> } {
  const toks: string[] = []; const consts = new Set<number>();
  const s = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const re = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|[A-Za-z_$][A-Za-z0-9_$]*|=>|===|!==|==|!=|<=|>=|&&|\|\||\+\+|--|<<|>>>|>>|[-+*/%=<>!&|^~?:;,.(){}\[\]]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const x = m[0];
    if (/^["'`]/.test(x)) toks.push("STR");
    else if (/^(?:0x|\d)/.test(x)) { const v = Number(x); if (!TRIVIAL.has(v) && /\d{4,}|\.\d{3,}|e/i.test(x)) consts.add(v); toks.push("NUM"); }
    else if (/^[A-Za-z_$]/.test(x)) toks.push(KEYWORDS.has(x) ? x : "ID");
    else toks.push(x);
  }
  return { toks, consts };
}
function hash(str: string): number { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function kgrams(toks: string[]): number[] { const out: number[] = []; for (let i = 0; i + K <= toks.length; i++) out.push(hash(toks.slice(i, i + K).join(" "))); return out; }
function winnow(hs: number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i + W <= hs.length; i++) { let min = Infinity; for (let j = i; j < i + W; j++) if (hs[j]! < min) min = hs[j]!; out.add(min); }
  if (hs.length && hs.length < W) out.add(Math.min(...hs));
  return out;
}
function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (e !== "node_modules" && e !== ".git") walk(p, exts, out); }
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

// ---- index reference trees ------------------------------------------------------------------------
interface Ref { id: string; path: string; grams: number[]; fp: Set<number>; consts: Set<number>; ntok: number }
const refs: Ref[] = [];
const fpIndex = new Map<number, number[]>(); // fingerprint -> ref indices
const gramIndex = new Map<number, number[]>(); // every k-gram -> ref indices (for run detection)
for (const tree of sim.trees) {
  for (const f of walk(tree.root, tree.ext)) {
    const { toks, consts } = tokenize(readFileSync(f, "utf8"));
    if (toks.length < K) continue;
    const grams = kgrams(toks);
    const ref: Ref = { id: `orig#${refs.length + 1}`, path: f, grams, fp: winnow(grams), consts, ntok: toks.length };
    const ri = refs.length; refs.push(ref);
    for (const h of ref.fp) { const a = fpIndex.get(h); if (a) a.push(ri); else fpIndex.set(h, [ri]); }
    const seen = new Set<number>();
    for (const h of grams) { if (seen.has(h)) continue; seen.add(h); const a = gramIndex.get(h); if (a) a.push(ri); else gramIndex.set(h, [ri]); }
  }
}

// ---- scan candidates ------------------------------------------------------------------------------
interface Finding { kind: "RUN" | "PAIR" | "IDENT" | "CONST"; file: string; ref?: string; detail: string; score?: number }
const findings: Finding[] = [];
let scanned = 0;
for (const dir of candidateDirs) {
  for (const f of walk(dir, [".ts", ".js"])) {
    scanned++;
    const rel = relative(root, f);
    const text = readFileSync(f, "utf8");
    const { toks, consts } = tokenize(text);
    for (const b of banned) if (new RegExp(`(?<![A-Za-z0-9_$])${b}(?![A-Za-z0-9_$])`).test(text)) findings.push({ kind: "IDENT", file: rel, detail: b });
    if (toks.length < K) continue;
    const grams = kgrams(toks);
    const fp = winnow(grams);
    // PAIR
    const overlap = new Map<number, number>();
    for (const h of fp) for (const ri of fpIndex.get(h) ?? []) overlap.set(ri, (overlap.get(ri) ?? 0) + 1);
    for (const [ri, n] of overlap) {
      const ratio = n / Math.max(1, fp.size);
      if (ratio >= PAIR_RATIO) findings.push({ kind: "PAIR", file: rel, ref: refs[ri]!.id, score: +ratio.toFixed(3), detail: `${n}/${fp.size} fingerprints shared` });
    }
    // RUN: longest consecutive matching k-grams against any single ref
    let bestRun = 0, bestRef = -1, runStart = 0;
    let curRef = -1, cur = 0;
    for (let i = 0; i < grams.length; i++) {
      const cands = gramIndex.get(grams[i]!);
      if (cands && curRef >= 0 && cands.includes(curRef)) { cur++; }
      else if (cands && cands.length) { curRef = cands[0]!; cur = 1; runStart = i; }
      else { curRef = -1; cur = 0; }
      if (cur > bestRun) { bestRun = cur; bestRef = curRef; }
    }
    const runTokens = bestRun ? bestRun + K - 1 : 0;
    if (runTokens >= RUN_TOKENS) findings.push({ kind: "RUN", file: rel, ref: refs[bestRef]!.id, score: runTokens, detail: `shared run of ${runTokens} normalised tokens starting near token ${runStart}` });
    // CONST
    for (const c of consts) {
      const hit = refs.find((r) => r.consts.has(c));
      if (hit) findings.push({ kind: "CONST", file: rel, ref: hit.id, detail: String(c) });
    }
  }
}

const out = { milestone, taken: new Date().toISOString(), k: K, w: W, thresholds: { RUN_TOKENS, PAIR_RATIO, IDENT_MIN },
  referenceFiles: refs.length, candidateFiles: scanned, findings };
mkdirSync(resolve(root, "evidence/similarity"), { recursive: true });
writeFileSync(resolve(root, `evidence/similarity/${milestone}.json`), JSON.stringify(out, null, 2));
mkdirSync(sim.mapOut, { recursive: true });
writeFileSync(join(sim.mapOut, `${milestone}-orig-map.json`), JSON.stringify(Object.fromEntries(refs.map((r) => [r.id, r.path])), null, 2));
const byKind = findings.reduce<Record<string, number>>((a, f) => ((a[f.kind] = (a[f.kind] ?? 0) + 1), a), {});
console.log(`similarity ${milestone}: ${scanned} candidate file(s) vs ${refs.length} reference file(s); findings: ${JSON.stringify(byKind)}`);
for (const f of findings) console.log(`  ${f.kind.padEnd(5)} ${f.file}${f.ref ? ` ~ ${f.ref}` : ""}${f.score !== undefined ? ` [${f.score}]` : ""}: ${f.detail}`);
process.exit(findings.some((f) => f.kind !== "CONST") ? 1 : 0);
