/**
 * Rip-up — negotiated-congestion soft obstacles (docs/DESIGN.md §6 `ripup.ts`). Literature: Dees
 * & Karger (1982) rip-up and reroute; McMurchie & Ebeling (1995) PathFinder history cost. When a
 * connection cannot be routed against hard obstacles, the search is re-run treating `free`
 * other-net copper as passable at a price; the winning Trail then rips exactly those items (through
 * the Journal) and their connections are re-queued. Only `free` Tracks and Barrels of other nets
 * may be ripped — never Pads, Pours, Fences, the Rim, or `held`/`locked` items (contract R-2). A
 * per-connection budget bounds how many items one attempt may rip.
 *
 * History is keyed by a coarse **resource** cell `(sheet, cx, cy)` rather than by an item id: a
 * ripped Track is re-inserted with a fresh id, so per-id history would never accumulate on a
 * contested region and the negotiation would oscillate. Bumping the cells a ripped Track occupied
 * makes repeatedly-contested regions progressively expensive, which is what makes PathFinder
 * converge (McMurchie & Ebeling 1995).
 *
 * PathFinder's cost has two negotiation terms on a resource: **history** `h` (accumulated across
 * passes, above) and **present** sharing `pn` (how heavily the resource is used *this pass*, reset
 * each pass). The soft-step cost is `(startRipupCost + h·histWeight)·(1 + pn·presentWeight)`
 * (docs/DESIGN.md §9a): history keeps a chronically contested region expensive, while the present
 * factor spreads simultaneously competing routes off a shared resource within one pass. With
 * `presentWeight = 0` (the default when `presentCongestionCost` is unset) the factor is 1 and the
 * cost reduces exactly to the legacy history-only form, so the fast tier does not regress.
 *
 * Public surface: RipupHistory, createRipupHistory, isRippable, ripCost, cellHistory, presentFactor.
 */
import type { Layout, Pt } from "../../spec/types/layout.ts";
import type { Lattice } from "../lattice/index.ts";

/** Per-item rip counts and per-resource-cell congestion history. */
export interface RipupHistory {
  count(id: number): number;
  bump(id: number): void;
  /** Accumulated congestion at a coarse cell on a Sheet (history, across passes). */
  cell(sheet: number, x: number, y: number): number;
  /** Bump the coarse cells a segment crosses (called when its Track is ripped). */
  bumpSeg(sheet: number, a: Pt, b: Pt): void;
  /** Present-pass usage at a coarse cell (how many committed routes cross it this pass). */
  present(sheet: number, x: number, y: number): number;
  /** Bump the present-pass usage of the coarse cells a committed segment crosses. */
  bumpPresentSeg(sheet: number, a: Pt, b: Pt): void;
  /** Clear the present-pass usage map (called at the start of each pass). */
  resetPresent(): void;
  /** Clear every history term (per-item, per-resource-cell, and present) — a fresh negotiation.
   *  Used by the M10c keep-better driver so its two trials each start from an unbiased history and
   *  the legacy baseline is reproducible when it is restored. */
  reset(): void;
  readonly cellSize: number;
}

export function createRipupHistory(cellSize = 10_000): RipupHistory {
  const h = new Map<number, number>();
  const cells = new Map<number, number>();
  let present = new Map<number, number>();
  const size = Math.max(1, Math.round(cellSize));
  const key = (sheet: number, cx: number, cy: number): number => ((sheet * 100003 + (cx + 0x40000)) * 0x80000) + (cy + 0x40000);
  const bumpCells = (map: Map<number, number>, sheet: number, a: Pt, b: Pt): void => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / size));
    for (let i = 0; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps, y = a.y + ((b.y - a.y) * i) / steps;
      const k = key(sheet, Math.floor(x / size), Math.floor(y / size));
      map.set(k, (map.get(k) ?? 0) + 1);
    }
  };
  return {
    count: (id) => h.get(id) ?? 0,
    bump: (id) => h.set(id, (h.get(id) ?? 0) + 1),
    cell: (sheet, x, y) => cells.get(key(sheet, Math.floor(x / size), Math.floor(y / size))) ?? 0,
    bumpSeg: (sheet, a, b) => bumpCells(cells, sheet, a, b),
    present: (sheet, x, y) => present.get(key(sheet, Math.floor(x / size), Math.floor(y / size))) ?? 0,
    bumpPresentSeg: (sheet, a, b) => bumpCells(present, sheet, a, b),
    resetPresent: () => { present = new Map<number, number>(); },
    reset: () => { h.clear(); cells.clear(); present = new Map<number, number>(); },
    cellSize: size,
  };
}

/**
 * May the router rip the item behind `id`? Only a `free` Track or Barrel of a different net (its
 * own net's copper is exempt anyway). Pads, Pours, Fences and the Rim are never rippable.
 */
export function isRippable(layout: Layout, lattice: Lattice, id: number, net: number | null): boolean {
  const entry = lattice.itemOf(id);
  if (!entry) return false;
  if (entry.cat !== "track" && entry.cat !== "barrel") return false;
  const item = entry.item as { hold: string; net: number | null };
  if (item.hold !== "free") return false;
  if (item.net !== null && net !== null && item.net === net) return false; // same net: exempt, not ripped
  return true;
}

/** The soft-obstacle cost of stepping through `id` given the run's settings and history. */
export function ripCost(startRipupCost: number, history: RipupHistory, id: number): number {
  return startRipupCost * (1 + history.count(id));
}

/** Congestion cost of stepping through a location (resource history), for the soft search. */
export function cellHistory(startRipupCost: number, history: RipupHistory, sheet: number, at: Pt): number {
  return startRipupCost * history.cell(sheet, at.x, at.y);
}

/**
 * PathFinder present-sharing factor `(1 + pn·presentWeight)` at a resource location this pass
 * (McMurchie & Ebeling 1995). `presentWeight` is `presentCongestionCost`; when it is undefined or 0
 * the factor is 1 (history-only, legacy behaviour).
 */
export function presentFactor(presentWeight: number | undefined, history: RipupHistory, sheet: number, at: Pt): number {
  const w = presentWeight ?? 0;
  if (w <= 0) return 1;
  return 1 + w * history.present(sheet, at.x, at.y);
}
