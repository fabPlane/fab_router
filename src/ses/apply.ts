/**
 * Session reader: apply a SPECCTRA session back onto a Layout (spec/formats/ses.md F-S60 … F-S63;
 * docs/DESIGN.md §3). Written from the SPECCTRA Design Language Reference (Cadence 2003):
 * network_out, net_out, wire_shape and wire_via descriptors.
 *
 *   F-S60  only `routes` / `network_out` is read; no `session` head → ok: false
 *   F-S61  every Track, Barrel and Pour whose Hold is `free` or `held` is removed first
 *          (locked items stay), mirroring the CAD tool's import
 *   F-S62  `(net NAME …)` by exact name (unknown → `net-unknown`, scope skipped);
 *          `(wire (path L W …))` and `(wire (polyline_path …))` → Tracks with Hold `held` on
 *          Sheet L (unknown → `layer-unknown`); `(wire (polygon …))` (+ windows) → a Pour;
 *          `(via NAME X Y …)` → a Barrel whose PadForm resolves per padstack-names.md P-1/P-2
 *          (unknown → `padstack-unknown`); `type` scopes ignored; coordinates are resolution
 *          units of the session's `routes` resolution (default: the Layout's)
 *   F-S63  applied items take their net's NetGroup category Kinds (track / barrel / area)
 *
 * Applied Tracks and Barrels carry `origin: "session"` (Q-I2-60), so a later `writeSes` with
 * `includeFileWiring: false` (which writes only `origin: "router"` items) leaves them out.
 *
 * Public surface: applySes.
 */
import type { Barrel, Diagnostic, Layout, NetGroup, Pour, Pt, Track } from "../../spec/types/layout.ts";
import type { DimensionUnit } from "../../spec/types/dsn.ts";
import type { ApplyResult } from "../../spec/types/results.ts";
import { lex } from "../dsn/lex.ts";
import { buildTree, lexemesOf, nameOf, nodesOf, numberOf, type Node } from "../dsn/tree.ts";
import { polylineCorners, ringOf } from "../layout/shapes.ts";
import { UM_PER_UNIT } from "../layout/units.ts";
import { documentOf } from "./write.ts";

type Mutable = { tracks: Track[]; barrels: Barrel[]; pours: Pour[]; nextId?: number };

function normalisePadstackName(name: string): string {
  return name.replace(/\.\d+/g, "").toLowerCase();
}

/** LU per session resolution unit. */
function luPerResolutionUnit(layout: Layout, routes: Node | undefined): number {
  const doc = documentOf(layout);
  let unit: DimensionUnit | undefined = doc?.resolution.unit;
  let perUnit: number | undefined = doc?.resolution.perUnit;
  const res = routes ? nodesOf(routes).find((n) => n.head === "resolution") : undefined;
  if (res) {
    const lx = lexemesOf(res);
    const u = lx[0] ? nameOf(lx[0]).toLowerCase() : "";
    const n = numberOf(lx[1]);
    if (u in UM_PER_UNIT && n !== undefined && n > 0) { unit = u as DimensionUnit; perUnit = n; }
  }
  if (unit === undefined || perUnit === undefined) return 1; // the Layout unit is the file's resolution unit
  return (UM_PER_UNIT[unit] * layout.frame.luPerUm) / perUnit;
}

export function applySes(layout: Layout, text: string): ApplyResult {
  const diagnostics: Diagnostic[] = [];
  const roots = buildTree(lex(text), diagnostics);
  const session = roots.find((r) => r.head === "session");
  if (!session) {
    diagnostics.push({ level: "warning", code: "session-missing", message: "text has no (session …) scope" });
    return { ok: false, applied: { tracks: 0, barrels: 0 }, diagnostics };
  }
  const routes = nodesOf(session).find((n) => n.head === "routes");
  const networkOut = routes ? nodesOf(routes).find((n) => n.head === "network_out") : undefined;
  const scale = luPerResolutionUnit(layout, routes);
  const lu = (v: number): number => Math.round(v * scale);

  // F-S61: replacement.
  const L = layout as unknown as Mutable;
  L.tracks = L.tracks.filter((t) => t.hold === "locked");
  L.barrels = L.barrels.filter((b) => b.hold === "locked");
  L.pours = L.pours.filter((p) => p.hold === "locked");

  let nextId = L.nextId ?? 0;
  for (const list of [layout.pads, layout.barrels, layout.tracks, layout.pours, layout.fences] as ReadonlyArray<ReadonlyArray<{ id: number }>>) {
    for (const it of list) if (it.id >= nextId) nextId = it.id + 1;
  }
  const id = (): number => nextId++;

  const sheetByName = new Map<string, number>();
  for (const s of layout.stack) if (!sheetByName.has(s.name)) sheetByName.set(s.name, s.id);
  // A session written for the same board by another tool may name the outer Sheets `Top` and
  // `Bottom` (the `ses-apply-issue555-bbd-mars-64-*` cases); when no Sheet has that exact name,
  // they stand for the first and last Sheet (src/QUESTIONS.md, task I2).
  const aliased = new Set<string>();
  const first = layout.stack[0], last = layout.stack[layout.stack.length - 1];
  if (first && last) {
    for (const [alias, id] of [["Top", first.id], ["Bottom", last.id]] as const) {
      if (![...sheetByName.keys()].some((n) => n.toLowerCase() === alias.toLowerCase())) { sheetByName.set(alias, id); aliased.add(alias); }
    }
  }
  const netByName = new Map<string, number>();
  for (const n of layout.nets) if (!netByName.has(n.name)) netByName.set(n.name, n.id);
  const formByNorm = new Map<string, number>();
  for (const f of layout.padForms) { const k = normalisePadstackName(f.name); if (!formByNorm.has(k)) formByNorm.set(k, f.id); }
  const groupOf = (net: number): NetGroup | undefined => {
    const n = layout.nets.find((x) => x.id === net);
    return layout.netGroups.find((g) => g.id === (n?.group ?? 0)) ?? layout.netGroups[0];
  };
  const skip = (code: string, message: string) => diagnostics.push({ level: "warning", code, message });

  let tracks = 0, barrels = 0;
  const pointsOf = (node: Node, from: number): Pt[] => {
    const nums = lexemesOf(node).slice(from).map((l) => numberOf(l)).filter((v): v is number => v !== undefined);
    const out: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: lu(nums[i]!), y: lu(nums[i + 1]!) });
    return out;
  };
  const collapse = (pts: Pt[]): Pt[] => {
    const out: Pt[] = [];
    for (const p of pts) { const last = out[out.length - 1]; if (!(last && last.x === p.x && last.y === p.y)) out.push(p); }
    return out;
  };

  for (const netNode of networkOut ? nodesOf(networkOut).filter((n) => n.head === "net") : []) {
    const nameLx = lexemesOf(netNode)[0];
    const netName = nameLx ? nameOf(nameLx) : "";
    const net = netByName.get(netName);
    if (net === undefined) { skip("net-unknown", `session net '${netName}' is not a net of the design; skipped`); continue; }
    const group = groupOf(net);
    const kinds = group?.categoryKinds ?? { track: group?.kind ?? 1, barrel: group?.kind ?? 1, area: group?.kind ?? 1 };
    for (const item of nodesOf(netNode)) {
      if (item.head === "wire") {
        const shape = nodesOf(item).find((n) => n.head === "path" || n.head === "polyline_path" || n.head === "polygon" || n.head === "rect" || n.head === "circle");
        if (!shape) { skip("malformed-wire", `net '${netName}': wire without a shape; skipped`); continue; }
        const lx = lexemesOf(shape);
        const layer = lx[0] ? nameOf(lx[0]) : "";
        const sheet = sheetByName.get(layer);
        if (sheet === undefined) { skip("layer-unknown", `net '${netName}': wire on unknown layer '${layer}'; skipped`); continue; }
        if (aliased.has(layer)) { aliased.delete(layer); diagnostics.push({ level: "info", code: "layer-aliased", message: `session layer '${layer}' read as Sheet '${layout.stack.find((s) => s.id === sheet)?.name ?? sheet}'` }); }
        if (shape.head === "path" || shape.head === "polyline_path") {
          const width = numberOf(lx[1]) ?? 0;
          const raw = pointsOf(shape, 2);
          const pts = collapse(shape.head === "polyline_path" ? polylineCorners(raw) : raw);
          if (pts.length < 2) { skip("wire-degenerate", `net '${netName}': wire with fewer than two distinct points; skipped`); continue; }
          const half = Math.max(0, Math.round((width * scale) / 2));
          L.tracks.push({ id: id(), net, sheet, pts, width: 2 * half, kind: kinds.track, hold: "held", origin: "session" });
          tracks++;
        } else if (shape.head === "polygon") {
          const outline = ringOf(pointsOf(shape, 2));
          if (outline.length < 3) { skip("wire-degenerate", `net '${netName}': polygon wire without area; skipped`); continue; }
          const holes: Pt[][] = [];
          for (const w of nodesOf(item).filter((n) => n.head === "window")) {
            const poly = nodesOf(w).find((n) => n.head === "polygon");
            if (!poly) continue;
            const ring = ringOf(pointsOf(poly, 2));
            if (ring.length >= 3) holes.push(ring);
          }
          L.pours.push({ id: id(), net, sheet, outline, holes, kind: kinds.area, hold: "held" });
        } else {
          skip("shape-unsupported", `net '${netName}': wire shape '${shape.head}' is not applied; skipped`);
        }
      } else if (item.head === "via") {
        const lx = lexemesOf(item);
        const padstack = lx[0] ? nameOf(lx[0]) : "";
        const form = formByNorm.get(normalisePadstackName(padstack));
        if (form === undefined) { skip("padstack-unknown", `net '${netName}': via padstack '${padstack}' resolves to no PadForm; skipped`); continue; }
        const pf = layout.padForms.find((f) => f.id === form)!;
        const sheets = [...pf.perSheet.keys()].sort((a, b) => a - b);
        const nums = lx.slice(1).map((l) => numberOf(l)).filter((v): v is number => v !== undefined);
        if (nums.length < 2) { skip("malformed-via", `net '${netName}': via without coordinates; skipped`); continue; }
        for (let i = 0; i + 1 < nums.length; i += 2) {
          L.barrels.push({ id: id(), net, at: { x: lu(nums[i]!), y: lu(nums[i + 1]!) }, form, fromSheet: sheets[0] ?? 0, toSheet: sheets[sheets.length - 1] ?? 0, kind: kinds.barrel, hold: "held", origin: "session" });
          barrels++;
        }
      }
    }
  }
  if (L.nextId !== undefined) L.nextId = nextId;
  return { ok: true, applied: { tracks, barrels }, diagnostics };
}


