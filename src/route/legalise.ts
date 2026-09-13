/**
 * Legalise — turn a pulled centreline into a leg list the angle mode allows and re-check every
 * leg exactly before it may be inserted (docs/DESIGN.md §6 `legalise.ts`). Shaping uses the
 * angle-mode constructions of src/geom (`snap45`, `stairs90`, `simplifyCollinear`); the final
 * gate is the exact `sweepClear` predicate of src/route/clear.ts run leg by leg, which is what
 * makes the router DRC-clean by construction (docs/DESIGN.md §6): nothing reaches the Journal
 * unless every leg passed the same predicate a DRC uses.
 *
 * Neck-down: when the full-width final leg into a Pad does not fit but the Profile's neck width
 * does, the last leg is re-checked (and inserted) at the neck width (spec/api/settings.md
 * `neckWidthUm`). This milestone shapes and checks; pad-entry turn-gap shaping and same-net
 * join/split are left minimal (the same-net exemption already lets a leg touch its own Pad).
 *
 * Public surface: LegaliseResult, TrackPiece, shapeToAngle, legaliseTrail, trackPieces.
 */
import type { Pt, Seg } from "../geom/index.ts";
import { simplifyCollinear, snap45, stairs90 } from "../geom/index.ts";
import type { Layout } from "../../spec/types/layout.ts";
import type { Lattice } from "../lattice/index.ts";
import type { AngleMode } from "../../spec/types/settings.ts";
import { sweepClear, type IgnoreSet } from "./clear.ts";
import type { Profile } from "./profile.ts";

export interface LegaliseResult {
  ok: boolean;
  /** The final integer polyline (full width for every leg except a possible neck at the ends). */
  pts: Pt[];
  /** The width of each leg (`pts.length - 1` entries). */
  widths: number[];
}

/** Shape a centreline to the angle mode: any → straight, 45 → octilinear, 90 → axis-aligned. */
export function shapeToAngle(pts: readonly Pt[], mode: AngleMode): Pt[] {
  const s = simplifyCollinear(pts);
  if (s.length <= 1) return s;
  if (mode === "45") return snap45(s);
  if (mode === "90") return stairs90(s);
  return s; // "any"
}

/**
 * Legalise a single-Sheet centreline: shape it, then check every leg at full width, necking the
 * end legs to `profile.neckWidth` only where the full width is blocked. Returns `ok: false` when
 * any leg is still blocked at the neck width — the caller then leaves the connection incomplete
 * (never inserts a violating leg).
 */
export function legaliseTrail(layout: Layout, lattice: Lattice, sheet: number, centre: readonly Pt[], profile: Profile, ignore: IgnoreSet, allowNeck = true): LegaliseResult {
  const pts = shapeToAngle(centre, profile.angleMode);
  const n = pts.length - 1;
  if (n < 1) return { ok: false, pts: [], widths: [] };
  const widths: number[] = new Array(n).fill(profile.width);
  const canNeck = allowNeck && profile.neckWidth > 0 && profile.neckWidth < profile.width;
  for (let i = 0; i < n; i++) {
    const seg: Seg = { a: pts[i]!, b: pts[i + 1]! };
    if (sweepClear(layout, lattice, sheet, seg, profile, ignore, profile.width).ok) continue;
    // Neck only the first and last legs (pad entry / exit).
    if (canNeck && (i === 0 || i === n - 1) && sweepClear(layout, lattice, sheet, seg, profile, ignore, profile.neckWidth).ok) {
      widths[i] = profile.neckWidth;
      continue;
    }
    return { ok: false, pts: [], widths: [] };
  }
  return { ok: true, pts, widths };
}

/** One Track's worth of a legalised centreline: a maximal run of legs sharing a width. */
export interface TrackPiece { pts: Pt[]; width: number }

/** Split a legalised centreline into Tracks, breaking where the leg width changes (neck-down). */
export function trackPieces(pts: readonly Pt[], widths: readonly number[]): TrackPiece[] {
  const out: TrackPiece[] = [];
  if (widths.length === 0 || pts.length < 2) return out;
  let start = 0;
  for (let i = 1; i <= widths.length; i++) {
    if (i === widths.length || widths[i] !== widths[start]) {
      out.push({ pts: pts.slice(start, i + 1), width: widths[start]! });
      start = i;
    }
  }
  return out;
}
