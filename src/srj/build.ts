/**
 * SimpleRouteJson → Layout (docs/DESIGN.md §7 `src/srj` row; spec/api/contract.md
 * "SimpleRouteJson"; spec/types/srj.ts). The tscircuit format is millimetre-based; this module
 * maps it onto the same integer-LU Layout the DSN reader produces so the core `route()` can run
 * unchanged. Design derived from the published tscircuit SimpleRouteJson shape (spec/types/srj.ts)
 * and docs/DESIGN.md §1-2; no external router source consulted.
 *
 * Mapping (task I6):
 *   layerCount        → a Stack of signal Sheets named top / inner1… / bottom (tscircuit order).
 *   bounds            → a rectangular Rim, grown outward by 1 mm.
 *   minTraceWidth /   → NetGroup Track widths (a group per distinct width so a connection's own
 *   nominalTraceWidth   nominalTraceWidth is honoured).
 *   connections       → one Net per connection; each pointToConnect a locked one-pad Part whose
 *                       Pad copper is a disk of the net's half-width on the point's Sheet.
 *   obstacles         → a held Pour on a net when `connectedTo` names a routed connection, else a
 *                       Fence (keepout). Rotated rects become rings; ovals a capsule; polygons
 *                       their outline.
 *   minViaPadDiameter → a through-Barrel PadForm (disk per Sheet + drill from minViaHoleDiameter),
 *   minViaHoleDiameter  offered by a `default` via rule.
 *   differentialPairs   are carried through unchanged for measurement.
 *
 * Public surface: srjClearanceUm, SrjLayout, buildSrjLayout.
 */
import type {
  Barrel, Diagnostic, Fence, Layout, Net, NetGroup, Pad, PadForm, Part, Pour, Pt, Rim, Sheet, ShapeOnSheet, ViaRule,
} from "../../spec/types/layout.ts";
import type { SimpleRouteJson } from "../../spec/types/srj.ts";
import { makeSpacingTable } from "../layout/index.ts";
import { halfWidthLu, makeFrame, toLu, widthLu } from "../layout/units.ts";

const DEG = Math.PI / 180;

/** tscircuit Sheet names by layer index for a given count (top, inner1…, bottom). */
export function sheetNames(count: number): string[] {
  const n = Math.max(1, count);
  if (n === 1) return ["top"];
  const names: string[] = ["top"];
  for (let i = 1; i < n - 1; i++) names.push(`inner${i}`);
  names.push("bottom");
  return names;
}

/** The default copper-to-copper clearance (µm) a board implies: its obstacle margin, else its
 *  minimum trace width, else 150 µm. */
export function srjClearanceUm(srj: SrjLike): number {
  const margin = num(srj.defaultObstacleMargin);
  if (margin !== undefined && margin > 0) return margin * 1000;
  const w = num(srj.minTraceWidth);
  if (w !== undefined && w > 0) return w * 1000;
  return 150;
}

export interface SrjLayout {
  layout: Layout;
  diagnostics: Diagnostic[];
  /** connection name → net id. */
  netByConnection: Map<string, number>;
  /** net id → connection name (the connection that owns the net). */
  connectionByNet: Map<number, string>;
  /** Sheet id → tscircuit layer name. */
  layerBySheet: Map<number, string>;
  /** copper-to-edge clearance implied by the board (µm), for the run's settings. */
  edgeClearanceUm?: number;
  frameLuPerUnit: number;
}

/** Loose view over the public SimpleRouteJson plus the extra fields real boards carry. */
type SrjLike = SimpleRouteJson & Record<string, unknown>;
interface RawObstacle {
  type?: string;
  layers?: string[];
  center?: { x: number; y: number };
  width?: number;
  height?: number;
  outline?: Array<{ x: number; y: number }>;
  connectedTo?: string[];
  ccwRotationDegrees?: number;
  obstacleId?: string;
}
interface RawPoint { x: number; y: number; layer?: string; pointId?: string }
interface RawConnection {
  name: string;
  pointsToConnect?: RawPoint[];
  netConnectionName?: string;
  netName?: string;
  nominalTraceWidth?: number;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Build a Layout from a SimpleRouteJson document. */
export function buildSrjLayout(srjIn: SimpleRouteJson): SrjLayout {
  const srj = srjIn as SrjLike;
  const diagnostics: Diagnostic[] = [];
  const warn = (code: string, message: string) => diagnostics.push({ level: "warning", code, message });

  // ---- Frame: 1 LU = 1 µm (mm × 1000), coarsened only if a board is enormous. ----------------
  const maxAbs = largestCoordinate(srj);
  const frame = makeFrame("um", 1, "mm", maxAbs);

  // ---- Stack: layerCount signal Sheets. ------------------------------------------------------
  const names = sheetNames(num(srj.layerCount) ?? 2);
  const stack: Sheet[] = names.map((name, id) => ({ id, name, role: "signal", active: true, preferDir: null }));
  const sheetByName = new Map<string, number>();
  const layerBySheet = new Map<number, string>();
  stack.forEach((s) => { sheetByName.set(s.name, s.id); layerBySheet.set(s.id, s.name); });
  const signalSheets = stack.map((s) => s.id);
  const sheetOf = (layer: string | undefined): number => (layer !== undefined && sheetByName.has(layer) ? sheetByName.get(layer)! : 0);

  // ---- default trace width. ------------------------------------------------------------------
  const defaultWidthMm = num(srj.minTraceWidth) ?? num(srj.nominalTraceWidth) ?? 0.15;
  const defaultWidthLu = Math.max(2, widthLu(frame, defaultWidthMm));

  // ---- Nets and NetGroups. -------------------------------------------------------------------
  const nets: Net[] = [];
  const netByConnection = new Map<string, number>();
  const connectionByNet = new Map<number, string>();
  // Alternative net identifiers → net id, so an obstacle's connectedTo can find its net.
  const netByAnyName = new Map<string, number>();

  // A NetGroup per distinct width; group 0 is the default width.
  const groupByWidth = new Map<number, number>();
  const netGroups: NetGroup[] = [];
  const viaRuleId = 0; // the single via rule created below
  const groupFor = (widthLuVal: number): number => {
    const existing = groupByWidth.get(widthLuVal);
    if (existing !== undefined) return existing;
    const id = netGroups.length;
    const g: NetGroup = {
      id, name: id === 0 ? "default" : `w${widthLuVal}`, nets: [], trackWidth: widthLuVal, kind: 1,
      categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 },
      viaRule: viaRuleId, usableSheets: signalSheets.slice(),
    };
    netGroups.push(g);
    groupByWidth.set(widthLuVal, id);
    return id;
  };
  groupFor(defaultWidthLu); // ensure group 0 exists

  const connections = (srj.connections ?? []) as RawConnection[];
  for (const c of connections) {
    const wMm = num(c.nominalTraceWidth) ?? defaultWidthMm;
    const wLu = Math.max(2, widthLu(frame, wMm));
    const gid = groupFor(wLu);
    const net: Net & { pads: number[] } = { id: nets.length, name: c.name, group: gid, pads: [] };
    nets.push(net);
    netGroups[gid]!.nets = [...netGroups[gid]!.nets, net.id];
    netByConnection.set(c.name, net.id);
    connectionByNet.set(net.id, c.name);
    for (const alias of [c.name, c.netConnectionName, c.netName]) if (alias) netByAnyName.set(alias, net.id);
  }

  // ---- PadForms: a disk terminal per (sheet, radius); a Barrel form for vias. ----------------
  const padForms: PadForm[] = [];
  const termFormBy = new Map<string, number>();
  const termForm = (sheet: number, radiusLu: number): number => {
    const key = `${sheet}:${radiusLu}`;
    const existing = termFormBy.get(key);
    if (existing !== undefined) return existing;
    const id = padForms.length;
    const shape: ShapeOnSheet = { kind: "disk", c: { x: 0, y: 0 }, r: Math.max(1, radiusLu) };
    padForms.push({ id, name: `srj_term_${key}`, perSheet: new Map([[sheet, [shape]]]), attachAllowed: false });
    termFormBy.set(key, id);
    return id;
  };
  const viaFormId = makeViaForm(padForms, frame, srj, signalSheets);

  // ---- Parts and Pads from pointsToConnect. --------------------------------------------------
  const parts: Part[] = [];
  const pads: Pad[] = [];
  let nextId = 1;
  const id = () => nextId++;
  for (const c of connections) {
    const netId = netByConnection.get(c.name)!;
    const net = nets[netId] as Net & { pads: number[] };
    const wMm = num(c.nominalTraceWidth) ?? defaultWidthMm;
    const halfLu = Math.max(1, halfWidthLu(frame, wMm));
    const pts = c.pointsToConnect ?? [];
    pts.forEach((p, i) => {
      const px = num(p.x), py = num(p.y);
      if (px === undefined || py === undefined) { warn("srj-point", `connection '${c.name}' point ${i} has no coordinate; dropped`); return; }
      const sheet = sheetOf(p.layer);
      const at: Pt = { x: toLu(frame, px), y: toLu(frame, py) };
      const part: Part = { id: parts.length, ref: `${c.name}#${i}`, package: "srj_point", side: "front", at, rotationDeg: 0, locked: true };
      parts.push(part);
      const pad: Pad = {
        id: id(), part: part.id, pinName: p.pointId ?? String(i), net: netId, form: termForm(sheet, halfLu),
        at, rotationDeg: 0, side: "front", sheets: [sheet], kind: 1, hold: "locked",
      };
      pads.push(pad);
      net.pads = [...net.pads, pad.id];
    });
  }

  // ---- Obstacles → held Pours (net-owned) or Fences (keepouts). ------------------------------
  const pours: Pour[] = [];
  const fences: Fence[] = [];
  const obstacles = (srj.obstacles ?? []) as RawObstacle[];
  for (const o of obstacles) {
    const sheetsFor = (o.layers ?? []).map((l) => sheetByName.get(l)).filter((s): s is number => s !== undefined);
    const on = sheetsFor.length > 0 ? sheetsFor : signalSheets.slice();
    const ownerNet = (o.connectedTo ?? []).map((nm) => netByAnyName.get(nm)).find((v): v is number => v !== undefined);
    const ring = obstacleRing(o, frame, toLu);
    if (ring.length < 3) { warn("srj-obstacle", `obstacle '${o.obstacleId ?? o.type ?? "?"}' has no usable shape; dropped`); continue; }
    if (ownerNet !== undefined) {
      // A held Pour owned by the connection's net (same-net, so exempt for that net's copper).
      for (const s of on) pours.push({ id: id(), net: ownerNet, sheet: s, outline: ring, holes: [], kind: 1, hold: "held" });
    } else {
      // A keepout the router must clear by the default spacing (Kind 1).
      for (const s of on) fences.push({ id: id(), sheet: s, scope: "track", shape: { kind: "ring", pts: ring }, kind: 1 });
    }
  }

  // ---- Rim: the bounds rectangle grown outward by 1 mm. --------------------------------------
  const rim = rimFromBounds(srj, frame);

  // ---- Spacing: Kind 0 no clearance, Kind 1 the board's clearance on every Sheet. ------------
  // C-04: nearest LU, then up to the next even integer.
  let clearLu = Math.max(0, Math.round(srjClearanceUm(srj) * frame.luPerUm));
  if (clearLu % 2 === 1) clearLu += 1;
  const spacing = makeSpacingTable(["", "default"], stack.length, [], (a, b) => (a === 0 || b === 0 ? 0 : clearLu));

  // ---- Via rule offering the through Barrel form. --------------------------------------------
  const viaRules: ViaRule[] = viaFormId !== undefined
    ? [{ id: viaRuleId, name: "default", forms: [viaFormId], entries: [{ form: viaFormId, kind: 1, attach: false }] }]
    : [{ id: viaRuleId, name: "default", forms: [], entries: [] }];

  const edgeUm = num(srj.minBoardEdgeClearance);
  const layout: Layout = {
    name: "srj",
    frame,
    angleMode: "45",
    stack,
    padForms,
    parts,
    pads,
    barrels: [] as Barrel[],
    tracks: [],
    pours,
    fences,
    rim,
    nets,
    netGroups,
    spacing,
    viaRules,
    pinEdgeToTurnLu: 0,
    warnings: diagnostics,
  };

  const out: SrjLayout = { layout, diagnostics, netByConnection, connectionByNet, layerBySheet, frameLuPerUnit: frame.luPerUnit };
  if (edgeUm !== undefined && edgeUm >= 0) out.edgeClearanceUm = edgeUm * 1000;
  return out;
}

/** The largest absolute coordinate (in mm) the document references, for Frame sizing. */
function largestCoordinate(srj: SrjLike): number {
  let m = 0;
  const b = srj.bounds as { minX?: number; maxX?: number; minY?: number; maxY?: number } | undefined;
  if (b) for (const v of [b.minX, b.maxX, b.minY, b.maxY]) { const n = num(v); if (n !== undefined) m = Math.max(m, Math.abs(n)); }
  for (const c of (srj.connections ?? []) as RawConnection[]) for (const p of c.pointsToConnect ?? []) {
    const x = num(p.x), y = num(p.y);
    if (x !== undefined) m = Math.max(m, Math.abs(x));
    if (y !== undefined) m = Math.max(m, Math.abs(y));
  }
  return m > 0 ? m : 1;
}

/** The vertex ring (LU) of an obstacle: rotated rect, oval box, or an explicit polygon outline. */
function obstacleRing(o: RawObstacle, frame: ReturnType<typeof makeFrame>, lu: typeof toLu): Pt[] {
  if ((o.type === "polygon" || o.outline) && o.outline && o.outline.length >= 3) {
    return o.outline.map((p) => ({ x: lu(frame, p.x), y: lu(frame, p.y) }));
  }
  const cx = num(o.center?.x) ?? 0, cy = num(o.center?.y) ?? 0;
  const w = num(o.width) ?? 0, h = num(o.height) ?? 0;
  if (w <= 0 || h <= 0) return [];
  const hw = w / 2, hh = h / 2;
  const rot = (num(o.ccwRotationDegrees) ?? 0) * DEG;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const corners: Array<[number, number]> = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  return corners.map(([dx, dy]) => ({
    x: lu(frame, cx + dx * cos - dy * sin),
    y: lu(frame, cy + dx * sin + dy * cos),
  }));
}

/** A rectangular Rim from `bounds`, grown outward by 1 mm (task I6). */
function rimFromBounds(srj: SrjLike, frame: ReturnType<typeof makeFrame>): Rim | null {
  const b = srj.bounds as { minX?: number; maxX?: number; minY?: number; maxY?: number } | undefined;
  if (!b) return null;
  const minX = num(b.minX), maxX = num(b.maxX), minY = num(b.minY), maxY = num(b.maxY);
  if (minX === undefined || maxX === undefined || minY === undefined || maxY === undefined) return null;
  const margin = 1; // mm
  const x0 = toLu(frame, Math.min(minX, maxX) - margin);
  const x1 = toLu(frame, Math.max(minX, maxX) + margin);
  const y0 = toLu(frame, Math.min(minY, maxY) - margin);
  const y1 = toLu(frame, Math.max(minY, maxY) + margin);
  if (x1 <= x0 || y1 <= y0) return null;
  return { outline: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], cutouts: [], kind: 1 };
}

/** A through Barrel PadForm from the board's via sizes, or undefined when it names none. */
function makeViaForm(padForms: PadForm[], frame: ReturnType<typeof makeFrame>, srj: SrjLike, sheets: number[]): number | undefined {
  const padD = num(srj.minViaPadDiameter);
  const holeD = num(srj.minViaHoleDiameter);
  if (padD === undefined || padD <= 0 || sheets.length < 2) return undefined;
  const r = Math.max(1, halfWidthLu(frame, padD));
  const perSheet = new Map<number, ShapeOnSheet[]>();
  for (const s of sheets) perSheet.set(s, [{ kind: "disk", c: { x: 0, y: 0 }, r }]);
  const id = padForms.length;
  const drillD = holeD !== undefined && holeD > 0 ? widthLu(frame, holeD) : Math.round(r);
  padForms.push({
    id, name: "srj_via", perSheet, attachAllowed: false,
    drill: { diameter: drillD, fromSheet: sheets[0]!, toSheet: sheets[sheets.length - 1]! },
  });
  return id;
}
