/**
 * Fanout — the SMD escape pre-pass (docs/DESIGN.md §6 `fanout.ts`; spec/behaviour/scenarios/
 * fanout.md; glossary "Fanout"). For each SMD Pad that its net has not yet left, lay a short stub
 * and a Barrel so the net can escape the Pad's Sheet; on a Pad whose Barrel form allows attach the
 * Barrel sits in the Pad with no stub. Deterministic: Pads in id order, escape offsets in a fixed
 * ring (src/route/via.ts `dropViaNear`). Bounded by `fanoutEnabled`, `fanoutMaxPasses`,
 * `fanoutMaxItems`. Every insertion passes the exact clearance predicate, so R-1 holds; only `free`
 * copper is added and nothing is moved, so R-2 holds. Updates `LayoutStats.fanout` indirectly (the
 * escapes become same-net Track/Barrel touches).
 *
 * Public surface: FanoutResult, runFanout.
 */
import type { Layout, Pad, Pt } from "../../spec/types/layout.ts";
import type { RouteSettings } from "../../spec/types/settings.ts";
import type { Lattice } from "../lattice/index.ts";
import { connectivity } from "../drc/index.ts";
import type { Journal } from "./journal.ts";
import { ignoreOf, sweepClear } from "./clear.ts";
import { resolveProfile, type Profile } from "./profile.ts";
import { dropViaNear } from "./via.ts";
import { legaliseTrail, trackPieces } from "./legalise.ts";
import { pullPath } from "./pull.ts";

export interface FanoutResult { escaped: number; addedItems: number }

/** Run the fanout pre-pass over `layout` (mutating through the Journal). */
export function runFanout(layout: Layout, lattice: Lattice, journal: Journal, settings: RouteSettings, ignored: ReadonlySet<number>): FanoutResult {
  if (!settings.fanoutEnabled) return { escaped: 0, addedItems: 0 };
  const base = layout.tracks.length + layout.barrels.length;
  const added = (): number => layout.tracks.length + layout.barrels.length - base;
  const maxItems = settings.fanoutMaxItems;
  const passes = settings.fanoutMaxPasses ?? 1;
  const profiles = new Map<number | null, Profile>();
  const profileOf = (net: number | null): Profile => {
    let p = profiles.get(net);
    if (!p) { p = resolveProfile(layout, net, settings); profiles.set(net, p); }
    return p;
  };
  const usableOther = (padSheet: number, profile: Profile): number | undefined => profile.sheets.find((s) => s !== padSheet);

  const luPerUm = layout.frame.luPerUm;
  const radius = Math.max(1, Math.round(3000 * luPerUm)); // escape within ~3 mm of the pad
  let escaped = 0;

  const smdPads = layout.pads.filter((p) => p.net !== null && p.sheets.length === 1).sort((a, b) => a.id - b.id);
  // Pads already connected to a Track / Barrel / Pour *at load* are escaped and left alone; every
  // other SMD Pad is given its own escape Barrel (a sibling's stub does not count, so a dense
  // component still fans every pin out — the observable Barrel count of spec/behaviour fanout.md).
  const conn0 = connectivity(layout, lattice);
  const done = new Set<number>();
  for (const pad of smdPads) if (isEscaped(conn0, pad)) done.add(pad.id);

  for (let pass = 0; pass < passes; pass++) {
    if (maxItems !== undefined && added() >= maxItems) break;
    let progressed = false;
    for (const pad of smdPads) {
      if (maxItems !== undefined && added() >= maxItems) break;
      if (done.has(pad.id) || ignored.has(pad.net!)) continue;
      if (settings.viasAllowed && escapePadWithVia(layout, lattice, journal, pad, profileOf(pad.net), usableOther, radius)) {
        escaped++; progressed = true; done.add(pad.id);
      }
    }
    if (!progressed) break;
  }
  return { escaped, addedItems: added() };
}

/** True when the Pad already has a same-net Track / Barrel / Pour touching it. */
function isEscaped(conn: ReturnType<typeof connectivity>, pad: Pad): boolean {
  for (const nb of conn.neighbours(pad.id)) {
    const cat = conn.items.get(nb)?.cat;
    if (cat === "track" || cat === "barrel" || cat === "pour") return true;
  }
  return false;
}

/** Drop an escape Barrel (and a stub if needed) for one SMD Pad; returns true on success. */
function escapePadWithVia(layout: Layout, lattice: Lattice, journal: Journal, pad: Pad, profile: Profile, usableOther: (padSheet: number, p: Profile) => number | undefined, radius: number): boolean {
  const padSheet = pad.sheets[0]!;
  if (!profile.sheets.includes(padSheet)) return false;
  const other = usableOther(padSheet, profile);
  if (other === undefined) return false;
  const ignore = ignoreOf(pad.net, [pad.id]);
  const drop = dropViaNear(layout, lattice, padSheet, other, pad.at, profile, ignore, radius);
  if (!drop) return false;
  const cand = drop.candidate;
  const mark = journal.mark();
  journal.addBarrel({ net: pad.net, at: drop.at, form: cand.form, fromSheet: cand.fromSheet, toSheet: cand.toSheet, kind: cand.kind, hold: "free" });
  if (drop.stub.length >= 2) {
    const los = (a: Pt, b: Pt): boolean => sweepClear(layout, lattice, padSheet, { a, b }, profile, ignore, profile.width).ok;
    const leg = legaliseTrail(layout, lattice, padSheet, pullPath(drop.stub, los), profile, ignore, false);
    if (!leg.ok) { journal.rewind(mark); return false; }
    for (const piece of trackPieces(leg.pts, leg.widths)) {
      if (piece.pts.length < 2) continue;
      journal.addTrack({ net: pad.net, sheet: padSheet, pts: piece.pts, width: piece.width, kind: profile.trackKind, hold: "free" });
    }
  }
  return true;
}
