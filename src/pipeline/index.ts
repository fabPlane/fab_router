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
import { recoverRemaining } from "../route/recover-remaining.ts";
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
  const monotonicStart = effective.localRecovery === true ? performance.now() : 0;
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

  // Recovery is insertion-only (one Track per kept target). Share the route-wide
  // budget and limit targets to the remaining R-5 item capacity. Optimisation has
  // already finished, so accepted recovery copper goes straight to final reporting.
  if (effective.localRecovery === true && effective.routerEnabled && !outcome.aborted && !outcome.timedOut) {
    const available = effective.maxItems === undefined ? 16 : Math.max(0, Math.min(16,
      Math.floor(effective.maxItems - (layout.tracks.length + layout.barrels.length - tracksBefore - barrelsBefore))));
    if (available > 0) {
      const recovery = recoverRemaining(layout, effective, true, available, true, {
        ...(effective.timeBudgetMs === undefined ? {} : { deadline: monotonicStart + effective.timeBudgetMs }),
        ...(hooks?.signal ? { signal: hooks.signal } : {}),
      }, hooks, {lattice:ctx.lattice,journal:ctx.journal});
      ctx.attempted += recovery.targets.filter(t => t.status !== "unsupported-endpoints" && t.status !== "joined").length;
      ctx.completed += recovery.targets.filter(t => t.status === "kept").length;
      if (recovery.status === "aborted" || hooks?.signal?.aborted) {
        outcome.aborted = true; outcome.stoppedBy = "abort";
      } else if (recovery.status === "deadline" || (effective.timeBudgetMs !== undefined && performance.now() >= monotonicStart + effective.timeBudgetMs)) {
        outcome.timedOut = true; outcome.stoppedBy = "timeBudget";
      } else if (totalIncomplete(ctx) === 0) outcome.stoppedBy = "complete";
      else if (effective.maxItems !== undefined && layout.tracks.length + layout.barrels.length - tracksBefore - barrelsBefore >= effective.maxItems) outcome.stoppedBy = "maxItems";
      hooks?.onProgress?.({done:ctx.completed,total:ctx.completed+totalIncomplete(ctx),elapsedMs:Date.now()-startMs});
      hooks?.onLog?.("info", `local-recovery summary ${JSON.stringify({status:recovery.status,targets:recovery.targets.length})}`);
    }
  }

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
