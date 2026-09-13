/**
 * `src/layout` — the design model (docs/DESIGN.md §2). Plain data; ids only, no object pointers.
 *
 * This layer owns the concrete forms of the public `Layout` contract in `spec/types/layout.ts`:
 * the SpacingTable implementation and an empty-Layout constructor. Items, Frames and pad
 * instantiation are built here by the DSN reader task (I1) on top of these.
 *
 * Public surface: makeSpacingTable, emptyFrame, emptyLayout, and the re-exported spec types.
 */
import type { Frame, Layout, SpacingTable } from "../../spec/types/layout.ts";

export type * from "../../spec/types/layout.ts";

/** Pair types a SpacingTable may distinguish; `default` is the fallback (glossary "Pair type"). */
export const DEFAULT_PAIR_TYPE = "default";
/** Name of Kind index 0: the Kind with no clearance at all (parse summaries print it as null). */
export const NO_CLEARANCE_KIND = "";

/**
 * Build a SpacingTable over `kinds` (index 0 is conventionally `null`, index 1 `default`).
 * `values` is a lookup callback the builder samples eagerly into a dense symmetric matrix per
 * Sheet and pair type, so `get` is a plain array read. Values are LU.
 */
export function makeSpacingTable(
  kinds: readonly string[],
  sheetCount: number,
  pairTypes: readonly string[],
  values: (kindA: number, kindB: number, sheet: number, pairType: string) => number,
): SpacingTable {
  const n = kinds.length;
  const types = pairTypes.includes(DEFAULT_PAIR_TYPE) ? pairTypes.slice() : [DEFAULT_PAIR_TYPE, ...pairTypes];
  const typeIndex = new Map<string, number>();
  types.forEach((t, i) => typeIndex.set(t, i));
  const sheets = Math.max(1, sheetCount);
  const table = new Float64Array(types.length * sheets * n * n);
  const maxByKind = new Float64Array(n);
  for (let t = 0; t < types.length; t++) {
    for (let s = 0; s < sheets; s++) {
      for (let a = 0; a < n; a++) {
        for (let b = a; b < n; b++) {
          const v = values(a, b, s, types[t]!);
          table[((t * sheets + s) * n + a) * n + b] = v;
          table[((t * sheets + s) * n + b) * n + a] = v;
          if (v > maxByKind[a]!) maxByKind[a] = v;
          if (v > maxByKind[b]!) maxByKind[b] = v;
        }
      }
    }
  }
  const defaultType = typeIndex.get(DEFAULT_PAIR_TYPE)!;
  return {
    kinds: kinds.slice(),
    get(kindA, kindB, sheet, pairType) {
      if (kindA < 0 || kindB < 0 || kindA >= n || kindB >= n) return 0;
      const t = pairType === undefined ? defaultType : (typeIndex.get(pairType) ?? defaultType);
      const s = sheet >= 0 && sheet < sheets ? sheet : 0;
      return table[((t * sheets + s) * n + kindA) * n + kindB]!;
    },
    max(kind) {
      return kind >= 0 && kind < n ? maxByKind[kind]! : 0;
    },
  };
}

/** A Frame with the identity scale in micrometres (1 LU = 1 µm). */
export function emptyFrame(): Frame {
  return { luPerUnit: 1, offset: { x: 0, y: 0 }, fileUnit: "um", luPerUm: 1 };
}

/** A Layout with no items: the shape every reader starts from. */
export function emptyLayout(name = ""): Layout {
  return {
    name,
    frame: emptyFrame(),
    angleMode: "45",
    stack: [],
    padForms: [],
    parts: [],
    pads: [],
    barrels: [],
    tracks: [],
    pours: [],
    fences: [],
    rim: null,
    nets: [],
    netGroups: [],
    // Kind index 0 is the "no clearance" Kind (reported as null in parse summaries), 1 is `default`.
    spacing: makeSpacingTable([NO_CLEARANCE_KIND, "default"], 1, [], () => 0),
    viaRules: [],
    pinEdgeToTurnLu: 0,
    warnings: [],
  };
}
