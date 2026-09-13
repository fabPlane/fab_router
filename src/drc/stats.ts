/**
 * LayoutStats (spec/api/contract.md "Checking and measuring"; spec/rules/connectivity.md K-09,
 * K-10; spec/rules/vias.md V-01 for Barrel spans; spec/rules/layers.md L-10 for fanout).
 *
 *   items         counts of the Layout's item arrays
 *   connections   maximum = Σ max(0, Pads + Pours − 1) per net (K-10); incomplete = Σ terminal
 *                 components − 1 (K-09); nets of `ignoreNetGroups` contribute to neither (N-07)
 *   barrels       by PadForm span: through (Sheet 0 to the last), blind (one outer Sheet),
 *                 buried (neither)
 *   tracks        total length (LU, mm), legs, and bends classified with the exact turn test of
 *                 src/geom: 90° → bends90, 45° → bends45, anything else (135°, reverse, other)
 *                 → bendsOther
 *   violations    total and by rule
 *   fanout        smdPads = Pads with a net whose PadForm has copper on one Sheet; escaped = those
 *                 directly joined to a Track or Pour, or to a Barrel joined to a Track or Pour;
 *                 viaEscaped = of the escaped, those joined to a Barrel directly or through one
 *                 Track
 *
 * Public surface: statsOf.
 */
import type { Layout } from "../../spec/types/layout.ts";
import type { LayoutStats, Violation } from "../../spec/types/results.ts";
import { bendKind, dist2PtPt } from "../geom/index.ts";
import { formOf } from "../lattice/index.ts";
import type { Connectivity } from "./connect.ts";
import { incompleteCount } from "./connect.ts";

/** Ids of the nets in the named groups (N-07: names matched exactly). */
export function ignoredNets(layout: Layout, groups: readonly string[] | undefined): Set<number> {
  const out = new Set<number>();
  if (!groups || groups.length === 0) return out;
  const names = new Set(groups);
  for (const g of layout.netGroups) if (names.has(g.name)) for (const n of g.nets) out.add(n);
  for (const n of layout.nets) { const g = layout.netGroups.find((x) => x.id === n.group); if (g && names.has(g.name)) out.add(n.id); }
  return out;
}

/** K-10: Σ max(0, Pads + Pours − 1) over nets not ignored. */
export function maximumConnections(layout: Layout, ignored: ReadonlySet<number>): number {
  const pads = new Map<number, number>();
  const pours = new Map<number, number>();
  for (const p of layout.pads) if (p.net !== null) pads.set(p.net, (pads.get(p.net) ?? 0) + 1);
  for (const p of layout.pours) if (p.net !== null) pours.set(p.net, (pours.get(p.net) ?? 0) + 1);
  let total = 0;
  for (const n of layout.nets) {
    if (ignored.has(n.id)) continue;
    total += Math.max(0, (pads.get(n.id) ?? 0) + (pours.get(n.id) ?? 0) - 1);
  }
  return total;
}

export function statsOf(layout: Layout, conn: Connectivity, violations: readonly Violation[], ignored: ReadonlySet<number>): LayoutStats {
  const last = layout.stack.length - 1;
  const first = layout.stack[0]?.id ?? 0;
  const lastId = layout.stack[last]?.id ?? 0;

  let through = 0, blind = 0, buried = 0;
  for (const b of layout.barrels) {
    const form = formOf(layout, b.form);
    const sheets = form ? [...form.perSheet.keys()].sort((x, y) => x - y) : [Math.min(b.fromSheet, b.toSheet), Math.max(b.fromSheet, b.toSheet)];
    const lo = sheets[0] ?? b.fromSheet, hi = sheets[sheets.length - 1] ?? b.toSheet;
    const reachesFirst = lo === first, reachesLast = hi === lastId;
    if (reachesFirst && reachesLast) through++;
    else if (reachesFirst || reachesLast) blind++;
    else buried++;
  }

  let lengthLu = 0, legs = 0, bends90 = 0, bends45 = 0, bendsOther = 0;
  for (const t of layout.tracks) {
    const pts = t.pts;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      if (a.x === b.x && a.y === b.y) continue;
      legs++;
      lengthLu += Math.sqrt(dist2PtPt(a, b));
    }
    for (let i = 1; i + 1 < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!, c = pts[i + 1]!;
      if ((a.x === b.x && a.y === b.y) || (b.x === c.x && b.y === c.y)) continue;
      switch (bendKind(a, b, c)) {
        case "straight": break;
        case "90": bends90++; break;
        case "45": bends45++; break;
        default: bendsOther++;
      }
    }
  }

  const byRule: Record<string, number> = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;

  let incomplete = 0;
  for (const n of layout.nets) if (!ignored.has(n.id)) incomplete += incompleteCount(conn, n.id);

  // Fanout (L-10, contract RV-18).
  let smdPads = 0, escaped = 0, viaEscaped = 0;
  const catOf = (id: number) => conn.items.get(id)?.cat;
  for (const p of layout.pads) {
    if (p.net === null) continue;
    const form = formOf(layout, p.form);
    const smd = form ? form.perSheet.size === 1 : p.sheets.length === 1;
    if (!smd) continue;
    smdPads++;
    let esc = false, via = false;
    for (const nb of conn.neighbours(p.id)) {
      const c = catOf(nb);
      if (c === "track" || c === "pour") {
        esc = true;
        if (c === "track" && conn.neighbours(nb).some((x) => catOf(x) === "barrel")) via = true;
      } else if (c === "barrel") {
        via = true;
        if (conn.neighbours(nb).some((x) => { const k = catOf(x); return k === "track" || k === "pour"; })) esc = true;
      }
    }
    if (esc) { escaped++; if (via) viaEscaped++; }
  }

  return {
    items: { pads: layout.pads.length, barrels: layout.barrels.length, tracks: layout.tracks.length, pours: layout.pours.length, fences: layout.fences.length },
    connections: { maximum: maximumConnections(layout, ignored), incomplete },
    barrels: { total: layout.barrels.length, through, blind, buried },
    tracks: { totalLengthLu: lengthLu, totalLengthMm: lengthLu / (layout.frame.luPerUm * 1000), legs, bends90, bends45, bendsOther },
    violations: { total: violations.length, byRule },
    fanout: { smdPads, escaped, viaEscaped },
  };
}
