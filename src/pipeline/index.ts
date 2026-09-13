/**
 * `src/pipeline` — orchestration of a route() call (docs/DESIGN.md §7): settings resolution,
 * budgets and cancellation, stage sequencing (fanout → passes → optimiser), and the result
 * envelopes the public API returns. The stages themselves are tasks I4/I5; this task provides
 * settings resolution (spec/api/settings.md) and the "not implemented" envelope every stub uses.
 *
 * Public surface: NOT_IMPLEMENTED, notImplemented, isNotImplemented, resolveSettings.
 */
import type { Diagnostic } from "../../spec/types/layout.ts";
import type { AngleMode, RouteSettings, SheetOverride } from "../../spec/types/settings.ts";
import { DEFAULT_ROUTE_SETTINGS } from "../../spec/types/settings.ts";

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
