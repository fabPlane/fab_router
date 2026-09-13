/**
 * Journal — the append-only mutation log with `mark()` / `rewind(mark)` (docs/DESIGN.md §6,
 * glossary "Journal"). It is the single point through which the router changes a Layout: every
 * Track / Barrel insertion and every rip-up removal goes through here so that the Layout arrays
 * and the Lattice (src/lattice) stay in step and any trial can be undone in O(operations since
 * the mark). This is the classic undo-log discipline; nothing here is specific to any router.
 *
 * A Journal owns a monotonically increasing id counter (one id space across all item arrays,
 * Q-I3-15) and stamps everything it inserts with `origin: "router"` (Q-I2-60) so that
 * `writeSes(…, { includeFileWiring: false })` and the R-3 accounting see exactly the router's
 * additions. `rewind` reverses insertions (drop the item) and removals (re-add the saved item),
 * newest first, restoring both the Layout and the Lattice.
 *
 * Public surface: JournalMark, Journal, createJournal, JournalStats.
 */
import type { Barrel, Layout, Track } from "../../spec/types/layout.ts";
import type { Lattice } from "../lattice/index.ts";

/** Opaque position in the Journal returned by `mark()` and accepted by `rewind(mark)`. */
export type JournalMark = number;

/** A minimal mutable view of the Layout item arrays the router appends to. */
interface MutableLayout {
  tracks: Track[];
  barrels: Barrel[];
  nextRouterId?: number;
}

type Op =
  | { kind: "insert-track"; id: number }
  | { kind: "insert-barrel"; id: number }
  | { kind: "remove-track"; item: Track }
  | { kind: "remove-barrel"; item: Barrel };

export interface JournalStats { inserted: number; removed: number; live: number }

export interface Journal {
  /** A fresh id in the Layout's single id space. */
  freshId(): number;
  /** Record a rewind point. */
  mark(): JournalMark;
  /** Insert a Track (origin forced to "router"); indexes it in the Lattice. Returns the stored item. */
  addTrack(track: Omit<Track, "id" | "origin"> & { id?: number }): Track;
  /** Insert a Barrel (origin forced to "router"); indexes it in the Lattice. Returns the stored item. */
  addBarrel(barrel: Omit<Barrel, "id" | "origin"> & { id?: number }): Barrel;
  /** Remove a Track or Barrel by id (journaled so `rewind` can restore it); a no-op when absent. */
  remove(id: number): void;
  /** Undo every operation after `mark`, newest first. */
  rewind(mark: JournalMark): void;
  /** Item ids inserted (and still live) since a mark, in insertion order. */
  insertedSince(mark: JournalMark): number[];
  stats(): JournalStats;
}

/** Create a Journal bound to a Layout and its live Lattice. */
export function createJournal(layout: Layout, lattice: Lattice): Journal {
  const L = layout as unknown as MutableLayout;
  const ops: Op[] = [];
  let inserted = 0;
  let removed = 0;

  // The id counter starts above every existing id so new items never collide (Q-I3-15).
  let next = L.nextRouterId ?? 0;
  for (const list of [layout.pads, layout.barrels, layout.tracks, layout.pours, layout.fences] as ReadonlyArray<ReadonlyArray<{ id: number }>>) {
    for (const it of list) if (it.id >= next) next = it.id + 1;
  }

  function freshId(): number {
    const id = next++;
    L.nextRouterId = next;
    return id;
  }

  function addTrack(track: Omit<Track, "id" | "origin"> & { id?: number }): Track {
    const id = track.id ?? freshId();
    const stored: Track = { ...track, id, origin: "router" };
    L.tracks.push(stored);
    lattice.insertItem("track", stored);
    ops.push({ kind: "insert-track", id });
    inserted++;
    return stored;
  }

  function addBarrel(barrel: Omit<Barrel, "id" | "origin"> & { id?: number }): Barrel {
    const id = barrel.id ?? freshId();
    const stored: Barrel = { ...barrel, id, origin: "router" };
    L.barrels.push(stored);
    lattice.insertItem("barrel", stored);
    ops.push({ kind: "insert-barrel", id });
    inserted++;
    return stored;
  }

  function remove(id: number): void {
    const ti = L.tracks.findIndex((t) => t.id === id);
    if (ti >= 0) {
      const item = L.tracks[ti]!;
      L.tracks.splice(ti, 1);
      lattice.removeItem(id);
      ops.push({ kind: "remove-track", item });
      removed++;
      return;
    }
    const bi = L.barrels.findIndex((b) => b.id === id);
    if (bi >= 0) {
      const item = L.barrels[bi]!;
      L.barrels.splice(bi, 1);
      lattice.removeItem(id);
      ops.push({ kind: "remove-barrel", item });
      removed++;
    }
  }

  function undo(op: Op): void {
    switch (op.kind) {
      case "insert-track": {
        const i = L.tracks.findIndex((t) => t.id === op.id);
        if (i >= 0) L.tracks.splice(i, 1);
        lattice.removeItem(op.id);
        inserted--;
        break;
      }
      case "insert-barrel": {
        const i = L.barrels.findIndex((b) => b.id === op.id);
        if (i >= 0) L.barrels.splice(i, 1);
        lattice.removeItem(op.id);
        inserted--;
        break;
      }
      case "remove-track": {
        L.tracks.push(op.item);
        lattice.insertItem("track", op.item);
        removed--;
        break;
      }
      case "remove-barrel": {
        L.barrels.push(op.item);
        lattice.insertItem("barrel", op.item);
        removed--;
        break;
      }
    }
  }

  function rewind(mark: JournalMark): void {
    while (ops.length > mark) undo(ops.pop()!);
  }

  function insertedSince(mark: JournalMark): number[] {
    const out: number[] = [];
    for (let i = mark; i < ops.length; i++) {
      const op = ops[i]!;
      if (op.kind === "insert-track" || op.kind === "insert-barrel") out.push(op.id);
    }
    return out;
  }

  return {
    freshId,
    mark: () => ops.length,
    addTrack,
    addBarrel,
    remove,
    rewind,
    insertedSince,
    stats: () => ({ inserted, removed, live: L.tracks.length + L.barrels.length }),
  };
}
