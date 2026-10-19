/** Experimental bounded rip-up rescue. No clearance/width/via rule is relaxed. */
import type { Pt } from "../../spec/types/layout.ts";
import type { Connection, Violation } from "../../spec/types/results.ts";
import { checkDrc, connectivity, requiredConnectionsOf, type Connectivity } from "../drc/index.ts";
import { createCtx, routeConnection, totalIncomplete, type RouteCtx } from "./passes.ts";
import { resolveProfile } from "./profile.ts";

const violationKey = (v: Violation): string => `${v.rule}:${v.sheet}:${v.a}:${v.b}`;
const joined = (c: Connectivity, a: number, b: number): boolean =>
  c.items.get(a)?.net === c.items.get(b)?.net && c.componentOf.has(a) && c.componentOf.get(a) === c.componentOf.get(b);

/** One step is kept only if exact DRC and all pre-existing terminal joins survive. */
export function runLocalRescue(ctx: RouteCtx): void {
  if (!ctx.settings.localRescue || !ctx.settings.routerEnabled || !ctx.settings.ripupEnabled
    || ctx.settings.maxItems !== undefined) return;
  const stopped = (): boolean => ctx.hooks?.signal?.aborted === true
    || (ctx.deadline !== undefined && Date.now() > ctx.deadline);
  const start = connectivity(ctx.layout, ctx.lattice);
  const pending = ctx.layout.nets.flatMap(n => ctx.ignored.has(n.id) ? [] : requiredConnectionsOf(start, n.id));
  for (const target of pending) {
    if (stopped()) break;
    let closed = false;
    for (const growth of [4, 8, 16]) {
      if (stopped()) break;
      const before = connectivity(ctx.layout, ctx.lattice);
      if (joined(before, target.from, target.to)) { closed = true; break; }
      const a = endpoint(before, target.from), b = endpoint(before, target.to);
      if (!a || !b) break;
      const profile = resolveProfile(ctx.layout, target.net, ctx.settings);
      const margin = growth * Math.max(1, profile.width + profile.maxSpacing);
      const box = { x0: Math.min(a.x, b.x) - margin, x1: Math.max(a.x, b.x) + margin,
        y0: Math.min(a.y, b.y) - margin, y1: Math.max(a.y, b.y) + margin };
      const inside = (p: Pt, radius = 0): boolean => p.x - radius >= box.x0 && p.x + radius <= box.x1
        && p.y - radius >= box.y0 && p.y + radius <= box.y1;
      // Whole tracks only. Retained input, ignored nets, held copper and vias are never removed.
      const victims = ctx.layout.tracks.filter(t => t.origin === "router" && t.hold === "free"
        && t.net !== null && t.net !== target.net && !ctx.ignored.has(t.net)
        && t.pts.every(p => inside(p, t.width / 2)));
      if (victims.length > 24) continue;
      const terminalGroups = before.nets.flatMap(n => n.components.map(ids => ids.filter(id => {
        const cat = before.items.get(id)?.cat;
        return cat === "pad" || cat === "pour";
      })).filter(ids => ids.length > 1));
      const baselineDrc = checkDrc(ctx.layout, ctx.settings).violations;
      const floor = new Map(baselineDrc.map(v => [violationKey(v), v.actual]));
      const incomplete = totalIncomplete(ctx);
      const priorTracks = [...ctx.layout.tracks];
      const mark = ctx.journal.mark();
      let keep = false;
      try {
        for (const t of victims) ctx.journal.remove(t.id);
        // Share the Journal/Lattice; disable every soft rung to keep mutations within this trial.
        const trial = createCtx(ctx.layout, { ...ctx.settings, ripupEnabled: false, localRescue: false }, ctx.hooks);
        trial.journal = ctx.journal; trial.lattice = ctx.lattice; trial.deadline = ctx.deadline;
        trial.baseItems = ctx.baseItems;
        const nets = new Set([target.net, ...victims.map(t => t.net!)]);
        for (let pass = 0; pass < 2 && !stopped(); pass++) {
          trial.conn = connectivity(ctx.layout, ctx.lattice);
          const work: Connection[] = [target, ...ctx.layout.nets.flatMap(n => nets.has(n.id)
            ? requiredConnectionsOf(trial.conn!, n.id) : [])];
          for (const conn of work) {
            if (stopped()) break;
            trial.conn = connectivity(ctx.layout, ctx.lattice);
            if (!joined(trial.conn, conn.from, conn.to)) routeConnection(trial, conn);
          }
        }
        const after = connectivity(ctx.layout, ctx.lattice);
        const added = new Set(ctx.journal.insertedSince(mark));
        // This first experiment accepts track-only local edits; via geometry needs a separate region gate.
        const local = !ctx.layout.barrels.some(v => added.has(v.id))
          && ctx.layout.tracks.filter(t => added.has(t.id)).every(t => t.pts.every(p => inside(p, t.width / 2)));
        keep = !stopped() && local && joined(after, target.from, target.to)
          && terminalGroups.every(ids => ids.every(id => joined(after, ids[0]!, id)))
          && totalIncomplete(ctx) < incomplete
          && checkDrc(ctx.layout, ctx.settings).violations.every(v => floor.has(violationKey(v))
            && v.actual >= floor.get(violationKey(v))!);
      } finally {
        if (!keep) {
          ctx.journal.rewind(mark);
          // Journal restores objects but appends removals; preserve original traversal order too.
          (ctx.layout.tracks as typeof priorTracks).splice(0, ctx.layout.tracks.length, ...priorTracks);
        }
        ctx.conn = connectivity(ctx.layout, ctx.lattice);
      }
      ctx.hooks?.onLog?.("info", `local-rescue ${target.net}:${target.from}:${target.to} radius=${growth}pitch ${keep ? "closed" : "reverted"} victims=${victims.length}`);
      if (keep) { ctx.ripped += victims.length; closed = true; break; }
    }
    if (!closed) ctx.hooks?.onLog?.("info", `local-rescue ${target.net}:${target.from}:${target.to} stayed-open`);
  }
}

function endpoint(c: Connectivity, id: number): Pt | undefined {
  const item = c.items.get(id);
  if (!item) return undefined;
  if (item.cat === "pad" || item.cat === "barrel") return (item.ref as { at: Pt }).at;
  if (item.cat === "pour") return (item.ref as { outline: readonly Pt[] }).outline[0];
  return undefined;
}
