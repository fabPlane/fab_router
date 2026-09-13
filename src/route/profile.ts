/**
 * Profile: the rules resolved for one connection before any searching (docs/DESIGN.md §6,
 * spec/rules/nets.md N-08). Nothing outside the net's NetGroup, the Layout and the run's
 * RouteSettings influences it.
 *
 *   width           the group's Track width (spec/rules/nets.md N-06)
 *   neckWidth       the narrowest width the final leg into a Pad may use (`neckWidthUm`,
 *                   spec/api/settings.md), never wider than `width`
 *   trackKind       the group's `track` category Kind (spec/rules/clearance.md C-11,
 *                   `NetGroup.categoryKinds.track`; ruling Q-I3-18)
 *   barrelKind      the group's `barrel` category Kind (C-11): what a Barrel carries when its via
 *                   definition names no Kind of its own
 *   spacingByKind   for every Kind k: the largest `spacing(trackKind, k, s)` over the usable
 *                   Sheets — a conservative per-Kind margin for the search; exact checks read
 *                   the SpacingTable per Sheet
 *   sheets          usable Sheet ids, ascending: the group's `use_layer` set ∩ signal role ∩
 *                   active (Sheet flag and `settings.layers[name].active`, spec/rules/layers.md
 *                   L-04, L-08)
 *   barrelForms     Barrel candidates in via-rule order (spec/rules/vias.md V-03, V-06), each
 *                   with the via definition's Kind and attach flag (`ViaRule.entries`, V-02,
 *                   V-08); empty when `viasAllowed` is false (V-09)
 *   angleMode       settings override, else the Layout's
 *   planeNet        the net owns a plane Sheet (L-06): `planeViaCost` applies
 *   holeClearance   `holeClearanceUm` in LU (0 = off), edgeClearance `copperToEdgeClearanceUm`
 *                   in LU (undefined = the Rim's table value), both rounded per C-04
 *
 * Public surface: BarrelCandidate, Profile, resolveProfile, toSpacingLu, toWidthLu.
 */
import type { Layout, NetGroup, ViaRule } from "../../spec/types/layout.ts";
import type { AngleMode, RouteSettings } from "../../spec/types/settings.ts";
import { formOf } from "../lattice/index.ts";

export interface BarrelCandidate {
  form: number;
  kind: number;
  attach: boolean;
  /** Span of the PadForm: first and last Sheet id carrying a shape. */
  fromSheet: number;
  toSheet: number;
}

export interface Profile {
  net: number | null;
  group: number;
  width: number;
  halfWidth: number;
  neckWidth: number;
  trackKind: number;
  barrelKind: number;
  spacingByKind: readonly number[];
  /** Largest value of `spacingByKind` (0 when the table is empty). */
  maxSpacing: number;
  sheets: readonly number[];
  barrelForms: readonly BarrelCandidate[];
  angleMode: AngleMode;
  planeNet: boolean;
  holeClearance: number;
  edgeClearance?: number;
}

/** A spacing in µm → LU: nearest integer, then up to the next even integer (C-04). */
export function toSpacingLu(um: number, luPerUm: number): number {
  let v = Math.round(um * luPerUm);
  if (v < 0) v = 0;
  return v % 2 === 0 ? v : v + 1;
}

/** A width in µm → LU: half-width rounded to the nearest integer, doubled (C-04). */
export function toWidthLu(um: number, luPerUm: number): number {
  return 2 * Math.max(0, Math.round((um * luPerUm) / 2));
}

function groupOf(layout: Layout, net: number | null): NetGroup {
  const n = net === null ? undefined : layout.nets.find((x) => x.id === net);
  const gid = n?.group ?? 0;
  return layout.netGroups.find((g) => g.id === gid) ?? layout.netGroups[0] ?? {
    id: 0, name: "default", nets: [], trackWidth: 3000, kind: 1,
    categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 },
  };
}

function viaRuleOf(layout: Layout, group: NetGroup): ViaRule | undefined {
  if (group.viaRule !== undefined) {
    const own = layout.viaRules.find((r) => r.id === group.viaRule);
    if (own) return own;
  }
  const dflt = layout.netGroups.find((g) => g.id === 0) ?? layout.netGroups[0];
  if (dflt && dflt !== group && dflt.viaRule !== undefined) {
    const r = layout.viaRules.find((x) => x.id === dflt.viaRule);
    if (r) return r;
  }
  return layout.viaRules[0];
}

/** Resolve the Profile of a connection of net `net` under `settings`. */
export function resolveProfile(layout: Layout, net: number | null, settings: RouteSettings): Profile {
  const group = groupOf(layout, net);
  const luPerUm = layout.frame.luPerUm;
  const width = Math.max(0, group.trackWidth);
  const halfWidth = width / 2;
  const neckSetting = settings.neckWidthUm;
  const neckWidth = neckSetting !== undefined && neckSetting > 0 ? Math.min(width, toWidthLu(neckSetting, luPerUm)) : width;
  const trackKind = group.categoryKinds.track;
  const barrelKind = group.categoryKinds.barrel;

  // usable Sheets
  const active = (name: string, flag: boolean): boolean => {
    const o = settings.layers[name];
    return o?.active !== undefined ? o.active : flag;
  };
  const sheets: number[] = [];
  for (const s of layout.stack) {
    if (s.role !== "signal") continue;
    if (!active(s.name, s.active)) continue;
    if (group.usableSheets && !group.usableSheets.includes(s.id)) continue;
    sheets.push(s.id);
  }
  sheets.sort((a, b) => a - b);

  // spacing row (max over usable Sheets, or Sheet 0 when none is usable)
  const kinds = layout.spacing.kinds.length;
  const spacingByKind: number[] = [];
  let maxSpacing = 0;
  const sampleSheets = sheets.length ? sheets : [layout.stack[0]?.id ?? 0];
  for (let k = 0; k < kinds; k++) {
    let v = 0;
    for (const s of sampleSheets) v = Math.max(v, layout.spacing.get(trackKind, k, s));
    spacingByKind.push(v);
    if (v > maxSpacing) maxSpacing = v;
  }

  // Barrel candidates: the via rule's entries in order (V-03, V-06), each carrying its via
  // definition's Kind and attach flag (V-02); a rule with `forms` but no `entries` (a hand-built
  // Layout) falls back to the group's barrel Kind and the PadForm's attach flag.
  const barrelForms: BarrelCandidate[] = [];
  if (settings.viasAllowed) {
    const rule = viaRuleOf(layout, group);
    const entries = rule && rule.entries.length > 0
      ? rule.entries
      : (rule?.forms ?? []).map((form) => ({ form, kind: barrelKind, attach: formOf(layout, form)?.attachAllowed ?? false }));
    for (const e of entries) {
      const form = formOf(layout, e.form);
      if (!form) continue;
      const ids = [...form.perSheet.keys()].sort((a, b) => a - b);
      if (ids.length === 0) continue;
      if (barrelForms.some((c) => c.form === e.form && c.kind === e.kind && c.attach === e.attach)) continue;
      barrelForms.push({ form: e.form, kind: e.kind, attach: e.attach, fromSheet: ids[0]!, toSheet: ids[ids.length - 1]! });
    }
  }

  const holeUm = settings.holeClearanceUm;
  const edgeUm = settings.copperToEdgeClearanceUm;
  const profile: Profile = {
    net,
    group: group.id,
    width,
    halfWidth,
    neckWidth,
    trackKind,
    barrelKind,
    spacingByKind,
    maxSpacing,
    sheets,
    barrelForms,
    angleMode: settings.angleMode ?? layout.angleMode,
    planeNet: net !== null && layout.stack.some((s) => s.role === "plane" && s.planeNet === net),
    holeClearance: holeUm !== undefined && holeUm > 0 ? toSpacingLu(holeUm, luPerUm) : 0,
  };
  if (edgeUm !== undefined && edgeUm >= 0) profile.edgeClearance = toSpacingLu(edgeUm, luPerUm);
  return profile;
}
