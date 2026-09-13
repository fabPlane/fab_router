/**
 * Rip-up — negotiated-congestion soft obstacles (docs/DESIGN.md §6 `ripup.ts`). Literature: Dees
 * & Karger (1982) rip-up and reroute; McMurchie & Ebeling (1995) PathFinder history cost. When a
 * connection cannot be routed against hard obstacles, the search is re-run treating `free`
 * other-net copper as passable at a price `startRipupCost × (1 + history)`, where `history` is how
 * many times that item has already been ripped this run; the winning Trail then rips exactly those
 * items (through the Journal) and their connections are re-queued. Only `free` Tracks and Barrels
 * of other nets may be ripped — never Pads, Pours, Fences, the Rim, or `held`/`locked` items
 * (contract R-2). A per-connection budget bounds how many items one attempt may rip.
 *
 * Public surface: RipupHistory, createRipupHistory, isRippable, ripCost.
 */
import type { Layout } from "../../spec/types/layout.ts";
import type { Lattice } from "../lattice/index.ts";

/** Per-item rip counts, keyed by item id (PathFinder history term). */
export interface RipupHistory {
  count(id: number): number;
  bump(id: number): void;
}

export function createRipupHistory(): RipupHistory {
  const h = new Map<number, number>();
  return {
    count: (id) => h.get(id) ?? 0,
    bump: (id) => h.set(id, (h.get(id) ?? 0) + 1),
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
