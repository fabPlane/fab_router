/**
 * Loading and validating acceptance cases (spec/acceptance/README.md, schema/case.schema.json),
 * resolving their resources (boards, rules, sessions, reference and expected files) and mapping
 * case settings to RouteSettings (spec/api/settings.md short names).
 *
 * Public surface: AcceptCase, Expectation, loadCases, matchGlob, caseSettings, resources.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validate } from "./schema.ts";
import type { RouteSettings } from "../../spec/types/settings.ts";

export const ROOT = resolve(import.meta.dir, "..", "..");
export const ACCEPT = join(ROOT, "spec", "acceptance");
export const DIRS = {
  cases: join(ACCEPT, "cases"),
  boards: join(ACCEPT, "boards"),
  reference: join(ACCEPT, "reference"),
  schema: join(ACCEPT, "schema"),
  out: join(ACCEPT, "out"),
};

export interface Expectation {
  exact?: unknown; max?: number; min?: number; maxAdded?: number; maxRatioToReference?: number;
  preExisting?: number; equalsFile?: string; advisory?: boolean;
}
export interface AcceptCase {
  id: string;
  kind: "parse" | "ses-roundtrip" | "ses-apply" | "rules" | "drc-load" | "settings" | "routing" | "srj";
  origin: string;
  tier: "fast" | "slow";
  board?: string;
  rules?: string;
  ses?: string;
  reference?: string;
  referenceSide?: "A" | "B";
  settings?: Record<string, unknown>;
  expect: Record<string, Expectation>;
  note?: string;
  /** The file the case was read from (relative to the cases directory). */
  file: string;
}

export interface LoadedCases { cases: AcceptCase[]; invalid: Array<{ file: string; problems: string[] }> }

/** Read every case under spec/acceptance/cases, validate against the schema, sort by id. */
export function loadCases(): LoadedCases {
  const schema = JSON.parse(readFileSync(join(DIRS.schema, "case.schema.json"), "utf8"));
  const cases: AcceptCase[] = [];
  const invalid: Array<{ file: string; problems: string[] }> = [];
  for (const file of readdirSync(DIRS.cases).filter((f) => f.endsWith(".json")).sort()) {
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(join(DIRS.cases, file), "utf8"));
    } catch (e) {
      invalid.push({ file, problems: [`not JSON: ${String((e as Error).message)}`] });
      continue;
    }
    const problems = validate(schema, json);
    if (problems.length) { invalid.push({ file, problems }); continue; }
    cases.push({ ...(json as Omit<AcceptCase, "file">), file });
  }
  cases.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { cases, invalid };
}

/** Shell-style glob over `*` and `?` only, anchored at both ends. */
export function matchGlob(glob: string, s: string): boolean {
  const re = new RegExp("^" + glob.split("").map((c) => (c === "*" ? ".*" : c === "?" ? "." : c.replace(/[.+^${}()|[\]\\]/g, "\\$&"))).join("") + "$");
  return re.test(s);
}

const SHORT_NAMES: Record<string, keyof RouteSettings> = {
  router: "routerEnabled",
  optimizer: "optimizerEnabled",
  fanout: "fanoutEnabled",
  optimizerMaxPasses: "optimizerPasses",
};

/** Map a case's `settings` object to the caller settings of `route()`. */
export function caseSettings(settings: Record<string, unknown> | undefined): Partial<RouteSettings> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings ?? {})) {
    if (k === "timeoutSeconds") { out.timeBudgetMs = (v as number) * 1000; continue; }
    out[SHORT_NAMES[k] ?? k] = v;
  }
  return out as Partial<RouteSettings>;
}

/** A resource the runner needs; `text` is undefined when the file is absent. */
export interface Resource { path: string; text?: string }

export function readResource(dir: string, name: string): Resource {
  const path = join(dir, name);
  if (!existsSync(path)) return { path };
  return { path, text: readFileSync(path, "utf8") };
}

/** Resolve an `equalsFile` path relative to spec/acceptance and parse it as JSON. */
export function readExpectedFile(rel: string): { path: string; json?: unknown } {
  const path = join(ACCEPT, rel);
  if (!existsSync(path)) return { path };
  return { path, json: JSON.parse(readFileSync(path, "utf8")) };
}
