/**
 * `src/pipeline` — orchestration of a route() call (docs/DESIGN.md §7): settings resolution,
 * budgets and cancellation, stage sequencing (fanout → passes → optimiser), and the result
 * envelopes the public API returns. The stages themselves are tasks I4/I5; this task provides
 * settings resolution (spec/api/settings.md) and the "not implemented" envelope every stub uses.
 *
 * Public surface: NOT_IMPLEMENTED, notImplemented, isNotImplemented, resolveSettings, runRoute.
 */
import type { Diagnostic, Layout } from "../../spec/types/layout.ts";
import type { AngleMode, RouteSettings, SheetOverride } from "../../spec/types/settings.ts";
import { DEFAULT_ROUTE_SETTINGS } from "../../spec/types/settings.ts";
import type { RouteHooks, RouteReport } from "../../spec/types/results.ts";
import { checkDrc } from "../drc/index.ts";
import { createCtx, runPasses, runFanout, runOptimise, totalIncomplete, perNetIncomplete } from "../route/index.ts";

/** Diagnostic code carried by every stubbed API function; the acceptance runner recognises it. */
export const NOT_IMPLEMENTED = "not-implemented";

export function notImplemented(fn: string): Diagnostic {
  return { level: "warning", code: NOT_IMPLEMENTED, message: `${fn} is not implemented yet` };
}

export function isNotImplemented(diagnostics: readonly Diagnostic[] | undefined): boolean {
  return (diagnostics ?? []).some((d) => d.code === NOT_IMPLEMENTED);
}

/**
 * Resolve the effective settings: built-in defaults ← `fileSettings` (only when the caller passes
 * `useFileSettings: true`) ← the caller's settings. `layers` merges per Sheet and per field; no
 * cost is clamped. `angleMode` is always present afterwards: caller, else file, else the
 * Layout's own angle mode, else "45" (RV-22).
 */
export function resolveSettings(
  caller: Partial<RouteSettings> | undefined,
  fileSettings: Partial<RouteSettings> | undefined,
  layoutAngleMode: AngleMode | undefined,
): RouteSettings {
  const useFile = caller?.useFileSettings === true;
  const layers: Record<string, SheetOverride> = {};
  const mergeLayers = (src: Record<string, SheetOverride> | undefined) => {
    if (!src) return;
    for (const name of Object.keys(src).sort()) {
      const o = src[name]!;
      const cur = layers[name] ?? {};
      const next: SheetOverride = { ...cur };
      if (o.active !== undefined) next.active = o.active;
      if (o.preferDir !== undefined) next.preferDir = o.preferDir;
      if (o.alongCost !== undefined) next.alongCost = o.alongCost;
      if (o.againstCost !== undefined) next.againstCost = o.againstCost;
      layers[name] = next;
    }
  };
  const base: RouteSettings = { ...DEFAULT_ROUTE_SETTINGS, layers: {}, ignoreNetGroups: [] };
  const apply = (src: Partial<RouteSettings> | undefined) => {
    if (!src) return;
    for (const [k, v] of Object.entries(src)) {
      if (v === undefined || k === "layers") continue;
      (base as unknown as Record<string, unknown>)[k] = Array.isArray(v) ? v.slice() : v;
    }
    mergeLayers(src.layers);
  };
  if (useFile) apply(fileSettings);
  apply(caller);
  base.layers = layers;
  base.angleMode = caller?.angleMode ?? (useFile ? fileSettings?.angleMode : undefined) ?? layoutAngleMode ?? "45";
  return base;
}

/**
 * Run the routing stage on a Layout with fully resolved settings and return the RouteReport
 * (docs/DESIGN.md §7). The Layout is mutated in place through the router's Journal. Fanout and the
 * optimiser (settings `fanoutEnabled` / `optimizerEnabled`) are task I5 and are not run here.
 *
 * `report.violationsAdded` is the difference in DRC violation counts across the run; the router
 * only inserts copper that passed the exact clearance predicate, so it is 0 by construction
 * (contract R-1). `added` is measured as the item-count difference (contract R-3).
 */
export function runRoute(layout: Layout, effective: RouteSettings, hooks?: RouteHooks): RouteReport {
  const startMs = Date.now();
  const violationsBefore = checkDrc(layout).counts.violations;
  const tracksBefore = layout.tracks.length;
  const barrelsBefore = layout.barrels.length;

  const ctx = createCtx(layout, effective, hooks);
  const seeded = new Set<number>();
  // Nets that have at least one required connection at load (for report.perNet).
  {
    const before = perNetIncomplete(ctx, new Set(layout.nets.map((n) => n.id)));
    for (const e of before) if (e.incomplete > 0) {
      const net = layout.nets.find((n) => n.name === e.net);
      if (net) seeded.add(net.id);
    }
  }
  const incompleteBefore = totalIncomplete(ctx);

  // Stage sequence (docs/DESIGN.md §7): fanout pre-pass → routing passes → optimiser.
  runFanout(ctx.layout, ctx.lattice, ctx.journal, effective, ctx.ignored);
  const outcome = runPasses(ctx);
  if (!outcome.aborted) runOptimise(ctx.layout, ctx.lattice, ctx.journal, effective, ctx.ignored, ctx.deadline);

  const incompleteAfter = totalIncomplete(ctx);
  const violationsAfter = checkDrc(layout).counts.violations;
  const addedTracks = layout.tracks.length - tracksBefore;
  const addedBarrels = layout.barrels.length - barrelsBefore;

  return {
    passes: outcome.passes,
    attempted: ctx.attempted,
    completed: ctx.completed,
    incompleteBefore,
    incompleteAfter,
    added: { tracks: addedTracks, barrels: addedBarrels },
    ripped: ctx.ripped,
    violationsBefore,
    violationsAdded: Math.max(0, violationsAfter - violationsBefore),
    timedOut: outcome.timedOut,
    aborted: outcome.aborted,
    stoppedBy: outcome.stoppedBy,
    effectiveSettings: effective,
    wallClockMs: Date.now() - startMs,
    perNet: perNetIncomplete(ctx, seeded),
  };
}
