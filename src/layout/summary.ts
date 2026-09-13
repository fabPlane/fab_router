/**
 * The normalised parse summary of a board (spec/acceptance/parse/README.md), computed from the
 * Layout and the document. Lengths are reported in the file's coordinate unit after LU rounding
 * (clearance.md C-04), rounded to six decimals; padstack names in their normalised form
 * (padstack-names.md P-7); Kind 0 prints as "null" (contract ruling Q-I0-4).
 *
 * Public surface: ParseSummary, summarise.
 */
import type { DsnDocument } from "../../spec/types/dsn.ts";
import { CATEGORIES, type LayoutX } from "./model.ts";
import { fromLu } from "./units.ts";

export type ParseSummary = Record<string, unknown>;

function kindName(L: LayoutX, k: number): string {
  return k === 0 ? "null" : L.spacing.kinds[k] ?? "null";
}

function byString<T>(key: (x: T) => string): (a: T, b: T) => number {
  return (a, b) => { const ka = key(a), kb = key(b); return ka < kb ? -1 : ka > kb ? 1 : 0; };
}

/**
 * The package name the parse summaries record for an image (see QUESTIONS.md, task I1): the
 * corpus summaries report the base name for a `NAME::n` image whose pins coincide, in order, with
 * the pins of an earlier `NAME` or `NAME::k` image (pin name, padstack, coordinates and rotation
 * rounded to the file unit), and the name as written otherwise. The Layout itself keeps every
 * Part's package exactly as the `component` scope wrote it (dsn.md F-90, D-S2-05).
 */
function summaryPackageNames(doc: DsnDocument): Map<string, string> {
  const out = new Map<string, string>();
  const signatures = new Map<string, Set<string>>(); // base name → signatures seen so far
  for (const im of doc.library.images) {
    const m = /^(.*)::\d+$/.exec(im.name);
    const base = m ? m[1]! : im.name;
    const sig = JSON.stringify(im.pins.map((p) => [p.name, p.padstack, Math.round(p.x), Math.round(p.y), Math.round(p.rotation)]));
    const seen = signatures.get(base) ?? new Set<string>();
    if (m && seen.has(sig)) out.set(im.name, base);
    seen.add(sig);
    signatures.set(base, seen);
  }
  return out;
}

/** Compute the summary; `status` is derived from the Rim (`outline-missing` when null). */
export function summarise(L: LayoutX, doc: DsnDocument, boardName: string): ParseSummary {
  const f = L.frame;
  const u = (lu: number) => fromLu(f, lu);
  const status = L.rim ? "ok" : "outline-missing";
  const out: ParseSummary = { board: boardName, status };
  if (status !== "ok") return out;

  out.resolution = { unit: doc.resolution.unit, perUnit: doc.resolution.perUnit };
  out.unit = doc.unit.unit;
  out.angleMode = L.angleMode;
  out.layers = L.stack.map((s) => ({ name: s.name, kind: s.role, index: s.id }));

  const def = L.netGroups[0]!;
  out.nets = L.nets
    .map((n) => {
      const e: Record<string, unknown> = { name: n.name, pins: n.pads.length };
      if (n.subnet !== 1) e.subnet = n.subnet;
      if (n.plane) e.plane = true;
      if (n.group !== 0) e.group = L.netGroups[n.group]!.name;
      return e;
    })
    .sort((a, b) => {
      const na = a.name as string, nb = b.name as string;
      if (na !== nb) return na < nb ? -1 : 1;
      return ((a.subnet as number | undefined) ?? 1) - ((b.subnet as number | undefined) ?? 1);
    });

  const pkg = summaryPackageNames(doc);
  const comps: Array<Record<string, unknown>> = L.parts.map((p) => ({ ref: p.ref, package: pkg.get(p.package) ?? p.package, side: p.side }));
  for (const c of doc.placement.components) {
    for (const pl of c.places) if (pl.x === undefined || pl.y === undefined) comps.push({ ref: pl.ref, package: c.image, side: pl.side ?? "front", placed: false });
  }
  comps.sort(byString((c) => c.ref as string));
  out.components = comps;

  out.padstacks = L.padForms.map((p) => p.normName).sort();
  out.viaPadstacks = L.viaForms.map((i) => L.padForms[i]!.normName);
  out.counts = { pads: L.pads.length, tracks: L.tracks.length, vias: L.barrels.length, pours: L.pours.length, fences: L.fences.length };

  const kinds = L.spacing.kinds.map((_, i) => kindName(L, i));
  const spacing: Record<string, number> = {};
  const layerDependent: string[] = [];
  for (let a = 1; a < kinds.length; a++) {
    for (let b = a; b < kinds.length; b++) {
      const key = `${kinds[a]}|${kinds[b]}`;
      spacing[key] = u(L.spacing.get(a, b, 0));
      if (L.spacing.sheetDependent(a, b)) layerDependent.push(key);
    }
  }
  const netGroups = L.netGroups.map((g) => {
    const e: Record<string, unknown> = {
      name: g.name,
      nets: g.nets.length,
      width: u(g.widthBySheet[0] ?? g.trackWidth),
      kind: kindName(L, g.kind),
      viaRule: g.viaRule !== undefined ? L.viaRules[g.viaRule]!.name : null,
    };
    if (g.widthBySheet.some((w) => w !== g.widthBySheet[0])) e.widthBySheet = g.widthBySheet.map(u);
    const inactive = L.stack.filter((s) => !g.usable.includes(s.id)).map((s) => s.name);
    if (inactive.length > 0) e.inactiveSheets = inactive;
    if (g.ignored) e.ignored = true;
    if (g.minLength !== undefined) e.minLength = u(g.minLength);
    if (g.maxLength !== undefined) e.maxLength = u(g.maxLength);
    if (g.shoveFixed) e.shoveFixed = true;
    if (!g.pullTight) e.pullTight = false;
    const ik: Record<string, string> = {};
    for (const c of CATEGORIES) if (g.categoryKinds[c] !== 1) ik[c] = kindName(L, g.categoryKinds[c]);
    if (Object.keys(ik).length > 0) e.itemKinds = ik;
    return e;
  });
  const viaForms = L.viaDefs.map((d) => {
    const e: Record<string, unknown> = { name: d.name, form: L.padForms[d.form]!.normName, kind: kindName(L, d.kind) };
    if (d.attach) e.attach = true;
    return e;
  });
  const viaRules = L.viaRules.map((r) => ({ name: r.name, forms: r.forms.map((i) => L.padForms[i]!.normName) }));
  out.rules = {
    defaultWidth: u(def.widthBySheet[0] ?? def.trackWidth),
    defaultClearance: u(L.spacing.get(1, 1, 0)),
    smdToTurnGap: u(L.pinEdgeToTurnLu),
    kinds,
    spacing,
    layerDependent,
    netGroups,
    viaForms,
    viaRules,
  };

  const agg = new Map<string, { scope: string; sheet: string; owner: string; count: number }>();
  for (const fence of L.fences) {
    const sheetName = fence.sheet === "all-signal" ? "signal" : L.stack[fence.sheet]!.name;
    const key = JSON.stringify([fence.scope, sheetName, fence.owner]);
    const cur = agg.get(key);
    if (cur) cur.count++;
    else agg.set(key, { scope: fence.scope, sheet: sheetName, owner: fence.owner, count: 1 });
  }
  out.keepouts = [...agg.values()].sort((a, b) => {
    if (a.scope !== b.scope) return a.scope < b.scope ? -1 : 1;
    if (a.sheet !== b.sheet) return a.sheet < b.sheet ? -1 : 1;
    return a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : 0;
  });

  const rim = L.rim!;
  const rings = [...rim.outers, ...rim.cutouts];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ring of rings) for (const p of ring) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const outline: Record<string, unknown> = {
    shapes: rings.length,
    vertices: rings.reduce((s, c) => s + c.length, 0),
    bbox: { x0: u(x0), y0: u(y0), x1: u(x1), y1: u(y1) },
  };
  if (L.rimClass !== undefined && L.rimClass.toLowerCase() !== "default") outline.kind = L.rimClass;
  out.outline = outline;
  return out;
}
