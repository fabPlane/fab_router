/**
 * Mutable SpacingTable (spec/rules/clearance.md C-01 … C-14). Kinds are created in order; Kind 0
 * is the "no clearance" Kind (name "" here, printed as null by the parse summary, contract ruling
 * Q-I0-4) and Kind 1 is `default`. Values are LU, symmetric, per Sheet. Object categories
 * (`smd`, `via`, `pin`, `area`) are ordinary Kinds in this model (C-03), so the `pairType`
 * argument of the public `get` is accepted and ignored.
 *
 * Public surface: SpacingTableX, NO_CLEARANCE_KIND, DEFAULT_KIND.
 */
import type { SpacingTable } from "../../spec/types/layout.ts";

export const NO_CLEARANCE_KIND = "";
export const DEFAULT_KIND = "default";

export class SpacingTableX implements SpacingTable {
  readonly kinds: string[] = [NO_CLEARANCE_KIND, DEFAULT_KIND];
  private lower: string[] = ["", "default"];
  /** rows[sheet][a][b] */
  private rows: number[][][] = [];
  readonly sheetCount: number;

  constructor(sheetCount: number) {
    this.sheetCount = Math.max(1, sheetCount);
    for (let s = 0; s < this.sheetCount; s++) this.rows.push([[0, 0], [0, 0]]);
  }

  get(kindA: number, kindB: number, sheet: number, _pairType?: string): number {
    const s = sheet >= 0 && sheet < this.sheetCount ? sheet : 0;
    const row = this.rows[s]![kindA];
    if (!row) return 0;
    return row[kindB] ?? 0;
  }

  max(kind: number): number {
    let m = 0;
    for (let s = 0; s < this.sheetCount; s++) {
      const row = this.rows[s]![kind];
      if (!row) continue;
      for (let b = 1; b < row.length; b++) if (row[b]! > m) m = row[b]!;
    }
    return m;
  }

  /** Largest value anywhere in the table (over Kinds ≥ 1). */
  maxAll(): number {
    let m = 0;
    for (let k = 1; k < this.kinds.length; k++) m = Math.max(m, this.max(k));
    return m;
  }

  /** C-02: case-insensitive lookup over Kinds ≥ 1 (Kind 0 is never named); -1 when absent. */
  find(name: string): number {
    const l = name.toLowerCase();
    for (let i = 1; i < this.lower.length; i++) if (this.lower[i] === l) return i;
    return -1;
  }

  /** C-07: create a Kind copying the default row; returns its index (existing index if present). */
  add(name: string): number {
    const existing = this.find(name);
    if (existing >= 0) return existing;
    const k = this.kinds.length;
    this.kinds.push(name);
    this.lower.push(name.toLowerCase());
    for (let s = 0; s < this.sheetCount; s++) {
      const rows = this.rows[s]!;
      const def = rows[1]!;
      const newRow: number[] = [];
      for (let x = 0; x < k; x++) {
        const v = x === 0 ? 0 : def[x]!;
        newRow.push(v);
        rows[x]!.push(v);
      }
      newRow.push(def[1]!); // (K, K) = (default, default)
      rows.push(newRow);
    }
    return k;
  }

  /** Set (a, b) = (b, a) = value on one Sheet, or on every Sheet when `sheet` is undefined. */
  set(a: number, b: number, value: number, sheet?: number): void {
    const v = Math.max(0, value);
    const apply = (s: number) => {
      const rows = this.rows[s]!;
      rows[a]![b] = v;
      rows[b]![a] = v;
    };
    if (sheet === undefined) for (let s = 0; s < this.sheetCount; s++) apply(s);
    else if (sheet >= 0 && sheet < this.sheetCount) apply(sheet);
  }

  /** C-06: set every pair of Kinds with index ≥ 1 to value (one Sheet or all). */
  setAllPairs(value: number, sheet?: number): void {
    for (let a = 1; a < this.kinds.length; a++) for (let b = a; b < this.kinds.length; b++) this.set(a, b, value, sheet);
  }

  /** True when (a, b) differs between some Sheet and Sheet 0. */
  sheetDependent(a: number, b: number): boolean {
    const v0 = this.get(a, b, 0);
    for (let s = 1; s < this.sheetCount; s++) if (this.get(a, b, s) !== v0) return true;
    return false;
  }
}
