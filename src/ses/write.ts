/**
 * Session writer: Layout → SPECCTRA session text (spec/formats/ses.md F-S1 … F-S45; docs/DESIGN.md
 * §3). Written from the SPECCTRA Design Language Reference (Cadence 2003): session_file,
 * route, library_out, network_out, net_out, wire_shape and wire_via descriptors.
 *
 *   session / base_design  the name given to readDsn (F-S2), `.dsn` → `.ses`
 *   placement              every placed Part grouped by image name as written (F-S32), with
 *                          `(lock_type position)` for Parts the design file fixed
 *   was_is                 always empty (F-S33)
 *   routes                 resolution (F-S21), parser with the design file's host_cad /
 *                          host_version (F-S31), library_out (F-S34: the structure via list, the
 *                          classes' use_via entries, then every PadForm a written Barrel uses),
 *                          network_out (F-S40 … F-S45: one `net` per net name owning a written
 *                          item; locked items and plane Pours never, file wiring unless
 *                          `includeFileWiring` is false)
 *
 * Numbers are integer counts of resolution units (F-S20): LU × (resolution units per LU), the
 * factor being 1 unless the Frame coarsened the layout unit. Names follow F-S30. What the
 * session needs beyond the public Layout — the design file's resolution, quote character,
 * parser entries and lock types — comes from the DsnDocument that `readDsn` attaches to the
 * Layout through `attachDocument` (a non-enumerable property; see src/QUESTIONS.md); without it
 * the Frame's unit and scale stand in and the parser scope is empty.
 *
 * Public surface: attachDocument, documentOf, resolutionOf, sesName, formatRotation, writeSes,
 * ROUTER_ADDED.
 */
import type { Barrel, Layout, PadForm, Pour, Pt, ShapeOnSheet, Track } from "../../spec/types/layout.ts";
import type { DimensionUnit, DsnDocument } from "../../spec/types/dsn.ts";
import type { SesWriteOptions } from "../../spec/types/results.ts";
import { UM_PER_UNIT } from "../layout/units.ts";

const DOCUMENT_KEY = "document";

/** Remember the DsnDocument a Layout was built from (non-enumerable, so deep comparisons ignore it). */
export function attachDocument(layout: Layout, document: DsnDocument): void {
  Object.defineProperty(layout, DOCUMENT_KEY, { value: document, enumerable: false, configurable: true, writable: true });
}

/** The DsnDocument attached by `attachDocument`, if any. */
export function documentOf(layout: Layout): DsnDocument | undefined {
  return (layout as unknown as Record<string, unknown>)[DOCUMENT_KEY] as DsnDocument | undefined;
}

/**
 * Marker for items the router inserted (as opposed to file wiring): an own property `origin`
 * with this value. `includeFileWiring: false` writes only such items.
 */
export const ROUTER_ADDED = "router";

export interface SesResolution { unit: DimensionUnit; perUnit: number; /** resolution units per LU */ perLu: number }

/** The session's resolution scope and the LU → resolution-unit factor (F-S20, F-S21). */
export function resolutionOf(layout: Layout): SesResolution {
  const doc = documentOf(layout);
  const frame = layout.frame;
  const fileUnit = (frame.fileUnit as DimensionUnit) in UM_PER_UNIT ? (frame.fileUnit as DimensionUnit) : "um";
  const unit: DimensionUnit = doc?.resolution.unit ?? fileUnit;
  const perUnit = doc?.resolution.perUnit ?? frame.luPerUnit;
  // LU = file units × luPerUnit; resolution units = file units × perUnit × UM[fileUnit] / UM[unit].
  const perLu = (perUnit * UM_PER_UNIT[fileUnit]) / UM_PER_UNIT[unit] / frame.luPerUnit;
  return { unit, perUnit, perLu };
}

/** F-S30: write a name bare or quoted with the document's quote character. */
export function sesName(name: string, quote: string): string {
  const n = name.split(quote).join("");
  if (n.length === 0) return quote + quote;
  const needs = /[()\s;\-_/~{}]/.test(n) || /[^\x20-\x7e]/.test(n) || /^\d/.test(n) || /^-\d/.test(n);
  return needs ? quote + n + quote : n;
}

/** F-S22: a rotation reduced into [0, 360), integral or with at most three decimals. */
export function formatRotation(deg: number): string {
  let r = ((deg % 360) + 360) % 360;
  if (r === 360 || Object.is(r, -0)) r = 0;
  if (Number.isInteger(r)) return String(r);
  const s = r.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return s === "360" ? "0" : s;
}

const isRouterAdded = (item: object): boolean => (item as { origin?: string }).origin === ROUTER_ADDED;

function collapse(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    out.push(p);
  }
  return out;
}

export function writeSes(layout: Layout, opts: SesWriteOptions = {}): string {
  const doc = documentOf(layout);
  const quote = doc?.parser.stringQuote ?? "\"";
  const res = resolutionOf(layout);
  const num = (lu: number): string => String(Math.round(lu * res.perLu));
  const name = (s: string): string => sesName(s, quote);
  const includeFile = opts.includeFileWiring !== false;
  const lines: string[] = [];
  let depth = 0;
  const line = (s: string) => lines.push("  ".repeat(depth) + s);
  const open = (s: string) => { line(s); depth++; };
  const close = () => { depth--; line(")"); };

  // ---- names (F-S2) ----
  const designName = (layout as { boardName?: string }).boardName ?? layout.name;
  const sessionName = /\.dsn$/i.test(designName) ? designName.replace(/\.dsn$/i, ".ses") : `${designName}.ses`;
  const sheetName = new Map<number, string>();
  for (const s of layout.stack) sheetName.set(s.id, s.name);

  open(`(session ${name(sessionName)}`);
  line(`(base_design ${name(designName)})`);

  // ---- placement (F-S32) ----
  open("(placement");
  line(`(resolution ${res.unit} ${res.perUnit})`);
  const locked = new Set<string>();
  if (doc) for (const c of doc.placement.components) for (const p of c.places) if (p.lockType?.some((t) => t.toLowerCase() === "position")) locked.add(p.ref);
  const byImage = new Map<string, typeof layout.parts[number][]>();
  for (const part of layout.parts) {
    const list = byImage.get(part.package) ?? [];
    list.push(part);
    byImage.set(part.package, list);
  }
  for (const [image, parts] of byImage) {
    open(`(component ${name(image)}`);
    for (const p of parts) {
      const lock = locked.has(p.ref) ? " (lock_type position)" : "";
      line(`(place ${name(p.ref)} ${num(p.at.x)} ${num(p.at.y)} ${p.side} ${formatRotation(p.rotationDeg)}${lock})`);
    }
    close();
  }
  close();
  line("(was_is)");

  // ---- routes ----
  open("(routes");
  line(`(resolution ${res.unit} ${res.perUnit})`);
  const parserEntries: string[] = [];
  if (doc?.parser.hostCad !== undefined) parserEntries.push(`(host_cad ${name(doc.parser.hostCad)})`);
  if (doc?.parser.hostVersion !== undefined) parserEntries.push(`(host_version ${name(doc.parser.hostVersion)})`);
  if (parserEntries.length === 0) line("(parser)");
  else { open("(parser"); for (const e of parserEntries) line(e); close(); }

  // Which items are written (F-S40, F-S43).
  const writable = (item: Track | Barrel | Pour): boolean =>
    item.net !== null && item.hold !== "locked" && (includeFile || isRouterAdded(item));
  const tracks = layout.tracks.filter((t) => writable(t) && collapse(t.pts).length >= 2);
  const barrels = layout.barrels.filter(writable);
  const pours = layout.pours.filter((p) => writable(p) && p.outline.length >= 3);

  // ---- library_out (F-S34) ----
  const formOrder: number[] = [];
  const pushForm = (id: number) => { if (!formOrder.includes(id)) formOrder.push(id); };
  for (const id of (layout as { viaForms?: readonly number[] }).viaForms ?? []) pushForm(id);
  for (const b of barrels) pushForm(b.form);
  const formById = (id: number): PadForm | undefined => layout.padForms.find((f) => f.id === id);
  open("(library_out");
  for (const id of formOrder) {
    const f = formById(id);
    if (!f) continue;
    open(`(padstack ${name(f.name)}`);
    for (const s of layout.stack) {
      for (const shape of f.perSheet.get(s.id) ?? []) line(`(shape ${padShape(shape, s.name, name, num)})`);
    }
    if (!f.attachAllowed) line("(attach off)");
    close();
  }
  close();

  // ---- network_out (F-S40 … F-S45) ----
  const netName = new Map<number, string>();
  for (const n of layout.nets) netName.set(n.id, n.name);
  const perNet = new Map<string, string[][]>();
  const entry = (net: number, text: string[]) => {
    const nm = netName.get(net);
    if (nm === undefined) return;
    const list = perNet.get(nm) ?? [];
    list.push(text);
    perNet.set(nm, list);
  };
  const protect = (hold: string): string => (hold === "held" ? "(type protect)" : "");
  for (const t of tracks) {
    const pts = collapse(t.pts);
    const layer = sheetName.get(t.sheet);
    if (layer === undefined) continue;
    const body = [`(wire`, `  (path ${name(layer)} ${num(t.width)}`];
    for (const p of pts) body.push(`    ${num(p.x)} ${num(p.y)}`);
    body.push("  )");
    const type = protect(t.hold);
    if (type) body.push(`  ${type}`);
    body.push(")");
    entry(t.net!, body);
  }
  for (const p of pours) {
    const layer = sheetName.get(p.sheet);
    if (layer === undefined) continue;
    const body = [`(wire`, `  (polygon ${name(layer)} 0`];
    for (const v of p.outline) body.push(`    ${num(v.x)} ${num(v.y)}`);
    body.push("  )");
    // F-S42 names `window` scopes for the holes, but every expected tree of spec/acceptance/ses
    // writes a wiring polygon without them (Issue756-tomu-fpga8/9 carry windows in the design
    // file); the expectations govern (src/QUESTIONS.md, task I2).
    body.push(")");
    entry(p.net!, body);
  }
  for (const b of barrels) {
    const f = formById(b.form);
    if (!f) continue;
    const type = protect(b.hold);
    entry(b.net!, [`(via ${name(f.name)} ${num(b.at.x)} ${num(b.at.y)}${type ? ` ${type}` : ""})`]);
  }
  open("(network_out");
  for (const [nm, entries] of perNet) {
    open(`(net ${name(nm)}`);
    for (const e of entries) for (const l of e) line(l);
    close();
  }
  close();
  close(); // routes
  close(); // session
  return lines.join("\n") + "\n";
}

/** One padstack shape in resolution units relative to the padstack origin (F-S34). */
function padShape(s: ShapeOnSheet, layer: string, name: (s: string) => string, num: (lu: number) => string): string {
  const L = name(layer);
  switch (s.kind) {
    case "disk": return `(circle ${L} ${num(2 * s.r)} ${num(s.c.x)} ${num(s.c.y)})`;
    case "box": return `(rect ${L} ${num(s.box.x0)} ${num(s.box.y0)} ${num(s.box.x1)} ${num(s.box.y1)})`;
    case "ring": return `(polygon ${L} 0 ${s.pts.map((p) => `${num(p.x)} ${num(p.y)}`).join(" ")})`;
    case "capsule": return `(path ${L} ${num(2 * s.r)} ${num(s.a.x)} ${num(s.a.y)} ${num(s.b.x)} ${num(s.b.y)})`;
    case "path": return `(path ${L} ${num(2 * s.halfWidth)} ${s.pts.map((p) => `${num(p.x)} ${num(p.y)}`).join(" ")})`;
  }
}
