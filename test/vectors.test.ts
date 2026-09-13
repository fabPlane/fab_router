/**
 * Behaviour vectors: every `spec/behaviour/**\/*.jsonl` record is asserted. Geometry ops are
 * dispatched to src/geom, the DSN lexeme vectors to src/dsn/lex; ops without an implementation
 * are reported as skipped with a count, never silently ignored.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  area2, area2Exact, dist2PtSeg, footExact, fracToNumber, fracToStrings, hullOf, lineIntersectExact,
  orient, pointInRing, pointSegDist2Exact, segsIntersect, type Pt,
} from "../src/geom/index.ts";
import { lex } from "../src/dsn/lex.ts";

const ROOT = resolve(import.meta.dir, "..");
const BEHAVIOUR = join(ROOT, "spec", "behaviour");

type Record_ = { op?: string; input: any; expected: any; note?: string; lexemes?: unknown };
type Vectors = { file: string; op: string; records: Record_[] };

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".jsonl")) out.push(p);
  }
  return out.sort();
}

function load(file: string): Vectors {
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim().length > 0);
  const records: Record_[] = [];
  for (const line of lines) {
    const rec = JSON.parse(line);
    if ("_generated" in rec) continue; // header
    records.push(rec);
  }
  const rel = relative(BEHAVIOUR, file);
  // Geometry records carry `op`; other vector families are named by their directory.
  const dir = rel.split("/")[0]!;
  const op = records[0]?.op ?? (dir === "dsn-tokens" ? "dsn-tokens" : rel.replace(/\.jsonl$/, "").replace(/\//g, ":"));
  return { file: rel, op, records };
}

const P = (a: number[]): Pt => ({ x: a[0]!, y: a[1]! });

type Checker = (input: any, expected: any) => void;

const CHECKERS: Record<string, Checker> = {
  // spec/behaviour/dsn-tokens: the whole record is passed; it carries `input` and `lexemes`.
  "dsn-tokens": (rec: { input: string; lexemes: Array<{ kind: string; text: string; glued?: boolean }>; parser?: { stringQuote?: string } }) => {
    const got: Array<{ kind: string; text: string; glued?: boolean }> = lex(rec.input, rec.parser?.stringQuote !== undefined ? { stringQuote: rec.parser.stringQuote } : {}).map((l) => (l.glued ? { kind: l.kind, text: l.text, glued: true } : { kind: l.kind, text: l.text }));
    expect(got).toEqual(rec.lexemes);
  },
  "orientation": (i, e) => {
    expect(orient(P(i.a), P(i.b), P(i.c))).toBe(e);
  },
  "segment-intersection": (i, e) => {
    expect(segsIntersect(P(i.p[0]), P(i.p[1]), P(i.q[0]), P(i.q[1]))).toBe(e);
  },
  "line-intersection-point": (i, e) => {
    const r = lineIntersectExact(P(i.p[0]), P(i.p[1]), P(i.q[0]), P(i.q[1]));
    if (typeof r === "string") expect(r).toBe(e);
    else {
      expect(typeof e).toBe("object");
      expect(fracToStrings(r.x)).toEqual(e.x);
      expect(fracToStrings(r.y)).toEqual(e.y);
    }
  },
  "point-in-polygon": (i, e) => {
    expect(pointInRing(i.polygon.map(P), P(i.point))).toBe(e);
  },
  "point-segment-distance": (i, e) => {
    const exact = pointSegDist2Exact(P(i.point), P(i.segment[0]), P(i.segment[1]));
    expect(fracToStrings(exact)).toEqual(e.d2);
    // The float64 kernel must agree with the exact rational to a few ulp.
    const approx = dist2PtSeg(P(i.point), P(i.segment[0]), P(i.segment[1]));
    const want = fracToNumber(exact);
    expect(Math.abs(approx - want)).toBeLessThanOrEqual(Math.max(1e-9 * Math.abs(want), 1e-6));
  },
  "perpendicular-foot": (i, e) => {
    const r = footExact(P(i.point), P(i.line[0]), P(i.line[1]));
    expect(fracToStrings(r.x)).toEqual(e.x);
    expect(fracToStrings(r.y)).toEqual(e.y);
  },
  "polygon-area": (i, e) => {
    const pts = i.polygon.map(P);
    expect(area2Exact(pts).toString()).toBe(e);
    if (Math.abs(Number(e)) <= 2 ** 53) expect(area2(pts)).toBe(Number(e));
  },
  "convex-hull": (i, e) => {
    expect(hullOf(i.points.map(P)).map((p) => [p.x, p.y])).toEqual(e);
  },
};

const files = walk(BEHAVIOUR).map(load);
const skipped: Array<{ file: string; op: string; count: number }> = [];

describe("behaviour vectors", () => {
  for (const v of files) {
    const checker = CHECKERS[v.op];
    if (!checker) {
      skipped.push({ file: v.file, op: v.op, count: v.records.length });
      test.skip(`${v.file}: op '${v.op}' not implemented (${v.records.length} records skipped)`, () => {});
      continue;
    }
    test(`${v.file}: ${v.records.length} records`, () => {
      expect(v.records.length).toBeGreaterThan(0);
      let n = 0;
      for (const rec of v.records) {
        try {
          if (v.op === "dsn-tokens") checker(rec, undefined);
          else checker(rec.input, rec.expected);
        } catch (err) {
          throw new Error(`${v.file} record ${n + 1} (${rec.note ?? "no note"}): ${String((err as Error).message)}\ninput=${JSON.stringify(rec.input)}`);
        }
        n++;
      }
    });
  }

  test("skipped ops are reported", () => {
    const total = skipped.reduce((s, x) => s + x.count, 0);
    if (skipped.length > 0) {
      console.log(`vectors: skipped ${skipped.length} file(s), ${total} record(s): ${skipped.map((s) => `${s.file} [${s.op}] ${s.count}`).join(", ")}`);
    }
    expect(skipped.every((s) => !CHECKERS[s.op])).toBe(true);
  });
});
