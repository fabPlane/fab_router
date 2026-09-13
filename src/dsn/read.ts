/**
 * DSN document reader: text → lexemes → scope tree → `DsnDocument` (spec/formats/dsn.md §2–§13,
 * dialects in dsn-dialects.md). Written from the SPECCTRA Design Language Reference (Cadence):
 * `<design_descriptor>`, `<structure_descriptor>`, `<placement_descriptor>`, `<library_descriptor>`,
 * `<network_descriptor>`, `<wiring_descriptor>` and the shape descriptors. Every number stays in
 * file units; every name stays as spelled; every scope the model has no field for is retained as
 * an `SExpr` in the nearest `other` list (F-22). Malformed entries are dropped with a diagnostic
 * (F-24); nothing here throws on any input.
 *
 * The scope readers are exported so that the rules-file overlay (rules.ts) reads the same
 * vocabulary the same way (rules.md F-R2).
 *
 * Public surface: readDocument, DocReadResult, readShape, readRuleEntries, readLayerRule,
 * readClass, readClassClass, readViaRule, readPadstack, readAutorouteSettings, readKeepout,
 * readPinRefs, warn, info.
 */
import type { Diagnostic, ParseError } from "../../spec/types/layout.ts";
import type {
  DimensionUnit, DocAutorouteLayerRule, DocAutorouteSettings, DocBoundary, DocCircuit, DocClass, DocClassClass, DocComponent, DocImage,
  DocKeepout, DocLayer, DocLayerRule, DocLibrary, DocNet, DocNetwork, DocPadstack, DocPadstackShape, DocParser, DocPin, DocPinRef,
  DocPlace, DocPlacement, DocPlane, DocRuleEntry, DocShape, DocStructure, DocViaRule, DocWire, DocWireVia, DocWiring, DsnDocument, SExpr,
} from "../../spec/types/dsn.ts";
import type { Lexeme } from "./lex.ts";
import { lex } from "./lex.ts";
import { buildTree, isNode, itemsText, lexemesOf, nameOf, nodesOf, numberOf, toSExpr, type Node } from "./tree.ts";

export type DocReadResult =
  | { ok: true; document: DsnDocument; diagnostics: Diagnostic[] }
  | { ok: false; error: ParseError; diagnostics: Diagnostic[] };

const UNITS: DimensionUnit[] = ["inch", "mil", "cm", "mm", "um"];
const SHAPE_HEADS = new Set(["rect", "circle", "polygon", "path", "polyline_path", "qarc"]);

export function warn(diags: Diagnostic[], code: string, message: string, node?: Node | Lexeme): void {
  diags.push({ level: "warning", code, message, ...(node ? { where: { line: node.line, column: node.column } } : {}) });
}
export function info(diags: Diagnostic[], code: string, message: string, node?: Node | Lexeme): void {
  diags.push({ level: "info", code, message, ...(node ? { where: { line: node.line, column: node.column } } : {}) });
}

function onOff(lx: Lexeme | undefined): boolean | undefined {
  if (!lx) return undefined;
  const t = lx.text.toLowerCase();
  return t === "on" ? true : t === "off" ? false : undefined;
}

function unknown(diags: Diagnostic[], other: SExpr[], node: Node, where: string): void {
  other.push(toSExpr(node));
  info(diags, "unknown-scope", `unknown scope '${node.headText}' in ${where}`, node);
}

// ---- entry point ------------------------------------------------------------------------------

/** F-20: read a design file. Fails only when no `pcb` scope can be recovered. */
export function readDocument(text: string): DocReadResult {
  const diagnostics: Diagnostic[] = [];
  const lexemes = lex(text);
  const first = lexemes[0];
  const second = lexemes[1];
  if (!first || first.kind !== "open" || !second || (second.kind !== "ident" && second.kind !== "number") || second.text.toLowerCase() !== "pcb") {
    const at = first ?? { line: 1, column: 1 };
    return { ok: false, error: { line: at.line, column: at.column, message: "not a design file: expected '(pcb' at the start" }, diagnostics };
  }
  const roots = buildTree(lexemes, diagnostics);
  const pcb = roots.find((r) => r.head === "pcb");
  if (!pcb) {
    return { ok: false, error: { line: first.line, column: first.column, message: "no pcb scope" }, diagnostics };
  }
  const document = readPcb(pcb, diagnostics);
  for (const r of roots) if (r !== pcb) unknown(diagnostics, document.other, r, "file");
  return { ok: true, document, diagnostics };
}

function readPcb(pcb: Node, diags: Diagnostic[]): DsnDocument {
  const doc: DsnDocument = {
    name: "",
    parser: { stringQuote: "\"", spaceInQuotedTokens: false, present: false, other: [] },
    resolution: { unit: "inch", perUnit: 2540000, present: false },
    unit: { unit: "inch", present: false },
    structure: emptyStructure(),
    placement: { components: [], other: [] },
    library: { images: [], padstacks: [], other: [] },
    network: { nets: [], classes: [], classClasses: [], viaRules: [], other: [] },
    wiring: null,
    other: [],
  };
  const seen = new Set<string>();
  let items = pcb.items;
  const firstItem = items[0];
  if (firstItem && !isNode(firstItem)) {
    doc.name = nameOf(firstItem);
    items = items.slice(1);
  }
  const section = (node: Node, name: string, fn: () => void) => {
    if (seen.has(name)) warn(diags, "duplicate-section", `repeated '${name}' section merged into the first`, node);
    seen.add(name);
    fn();
  };
  const visit = (node: Node, inside: string) => {
    switch (node.head) {
      case "parser": return section(node, "parser", () => readParser(node, doc.parser, diags));
      case "resolution": return section(node, "resolution", () => readResolution(node, doc, diags));
      case "unit": return section(node, "unit", () => readUnit(node, doc, diags));
      case "structure": return section(node, "structure", () => readStructure(node, doc.structure, diags));
      case "placement": return section(node, "placement", () => readPlacement(node, doc.placement, diags, visit));
      case "library": return section(node, "library", () => readLibrary(node, doc.library, diags, visit));
      case "network": return section(node, "network", () => readNetwork(node, doc.network, diags, visit));
      case "wiring": return section(node, "wiring", () => {
        if (!doc.wiring) doc.wiring = { wires: [], vias: [], other: [] };
        readWiring(node, doc.wiring, diags, visit);
      });
      default: return unknown(diags, doc.other, node, inside);
    }
  };
  for (const it of items) {
    if (!isNode(it)) continue; // stray lexeme at pcb level
    visit(it, "pcb");
  }
  if (!seen.has("structure")) warn(diags, "structure-missing", "no structure section: no Sheets and no Rim", pcb);
  if (!doc.unit.present) doc.unit.unit = doc.resolution.unit;
  return doc;
}

type Visit = (node: Node, inside: string) => void;

function emptyStructure(): DocStructure {
  return {
    layers: [], boundaries: [], keepouts: [], planes: [], vias: [], spareVias: [], rules: [], layerRules: [],
    control: { other: [] }, other: [],
  };
}

// ---- header sections --------------------------------------------------------------------------

function readParser(node: Node, p: DocParser, diags: Diagnostic[]): void {
  p.present = true;
  for (const c of nodesOf(node)) {
    const lx = lexemesOf(c);
    switch (c.head) {
      case "string_quote": {
        const q = lx[0];
        if (q && q.text.length === 1) p.stringQuote = q.text;
        else warn(diags, "malformed-string_quote", "string_quote needs one character", c);
        break;
      }
      case "space_in_quoted_tokens": {
        const v = onOff(lx[0]);
        if (v === undefined) warn(diags, "malformed-space_in_quoted_tokens", "expected on|off", c);
        else p.spaceInQuotedTokens = v;
        break;
      }
      case "host_cad": p.hostCad = lx[0] ? nameOf(lx[0]) : ""; break;
      case "host_version": p.hostVersion = lx[0] ? nameOf(lx[0]) : ""; break;
      default: p.other.push(toSExpr(c));
    }
  }
}

function readResolution(node: Node, doc: DsnDocument, diags: Diagnostic[]): void {
  const lx = lexemesOf(node);
  const u = lx[0]?.text.toLowerCase() as DimensionUnit | undefined;
  const n = numberOf(lx[1]);
  if (!u || !UNITS.includes(u) || n === undefined || !(n > 0)) {
    warn(diags, "malformed-resolution", "resolution needs a unit and a positive count", node);
    return;
  }
  doc.resolution = { unit: u, perUnit: n, present: true };
}

function readUnit(node: Node, doc: DsnDocument, diags: Diagnostic[]): void {
  const lx = lexemesOf(node);
  const u = lx[0]?.text.toLowerCase() as DimensionUnit | undefined;
  if (!u || !UNITS.includes(u)) { warn(diags, "malformed-unit", "unit needs one of inch|mil|cm|mm|um", node); return; }
  doc.unit = { unit: u, present: true };
}

// ---- shapes -----------------------------------------------------------------------------------

/** F-50 … F-55: read a shape scope; undefined when malformed (diagnostic emitted). */
export function readShape(node: Node, diags: Diagnostic[]): DocShape | undefined {
  const lx = lexemesOf(node);
  const layer = lx[0];
  if (!layer) { warn(diags, `malformed-${node.head}`, "shape without a layer name", node); return undefined; }
  const L = nameOf(layer);
  const nums: number[] = [];
  for (let i = 1; i < lx.length; i++) {
    const v = numberOf(lx[i]);
    if (v === undefined) break;
    nums.push(v);
  }
  switch (node.head) {
    case "rect": {
      if (nums.length < 4) { warn(diags, "malformed-rect", "rect needs four numbers", node); return undefined; }
      return { kind: "rect", layer: L, x1: nums[0]!, y1: nums[1]!, x2: nums[2]!, y2: nums[3]! };
    }
    case "circle": {
      if (nums.length < 1) { warn(diags, "malformed-circle", "circle needs a diameter", node); return undefined; }
      return { kind: "circle", layer: L, diameter: nums[0]!, cx: nums[1] ?? 0, cy: nums[2] ?? 0 };
    }
    case "polygon": {
      if (nums.length < 1) { warn(diags, "malformed-polygon", "polygon needs an aperture width", node); return undefined; }
      const pts = nums.slice(1);
      if (pts.length % 2 === 1) pts.pop();
      return { kind: "polygon", layer: L, aperture: nums[0]!, pts };
    }
    case "path": {
      if (nums.length < 3) { warn(diags, "malformed-path", "path needs a width and one vertex", node); return undefined; }
      const pts = nums.slice(1);
      if (pts.length % 2 === 1) pts.pop();
      const shape: DocShape = { kind: "path", layer: L, width: nums[0]!, pts };
      for (const c of nodesOf(node)) {
        if (c.head === "aperture_type") {
          const t = lexemesOf(c)[0]?.text.toLowerCase();
          if (t === "round" || t === "square") shape.apertureType = t;
        }
      }
      return shape;
    }
    case "polyline_path": {
      if (nums.length < 5) { warn(diags, "malformed-polyline_path", "polyline_path needs a width and two vertices", node); return undefined; }
      const pts = nums.slice(1);
      if (pts.length % 2 === 1) pts.pop();
      return { kind: "polyline_path", layer: L, width: nums[0]!, pts };
    }
    case "qarc": {
      return { kind: "qarc", layer: L, width: nums[0] ?? 0, pts: nums.slice(1) };
    }
    default:
      return undefined;
  }
}

function isShapeNode(n: Node): boolean {
  return n.head !== null && SHAPE_HEADS.has(n.head);
}

// ---- rules ------------------------------------------------------------------------------------

/** F-70: the entries of a `rule` scope (`clear` = `clearance`). */
export function readRuleEntries(node: Node, diags: Diagnostic[]): DocRuleEntry[] {
  const out: DocRuleEntry[] = [];
  for (const c of nodesOf(node)) {
    const lx = lexemesOf(c);
    if (c.head === "width") {
      const v = numberOf(lx[0]);
      if (v === undefined) { warn(diags, "malformed-width", "width needs a number", c); continue; }
      out.push({ kind: "width", value: v });
    } else if (c.head === "clearance") {
      const v = numberOf(lx[0]);
      if (v === undefined) { warn(diags, "malformed-clearance", "clearance needs a number", c); continue; }
      const entry: DocRuleEntry = { kind: "clearance", value: v };
      const type = nodesOf(c).find((n) => n.head === "type");
      if (type) entry.type = itemsText(type);
      out.push(entry);
    } else {
      out.push({ kind: "other", raw: toSExpr(c) });
    }
  }
  return out;
}

/** F-71: `(layer_rule L1 L2 … (rule …))`. */
export function readLayerRule(node: Node, diags: Diagnostic[]): DocLayerRule {
  const layers = lexemesOf(node).map(nameOf);
  const rules: DocRuleEntry[] = [];
  for (const c of nodesOf(node)) {
    if (c.head === "rule") rules.push(...readRuleEntries(c, diags));
    else rules.push({ kind: "other", raw: toSExpr(c) });
  }
  return { layers, rules };
}

// ---- structure --------------------------------------------------------------------------------

function readStructure(node: Node, s: DocStructure, diags: Diagnostic[]): void {
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "layer": readLayer(c, s, diags); break;
      case "boundary": readBoundary(c, s, diags); break;
      case "keepout": case "via_keepout": case "wire_keepout": case "place_keepout": {
        const k = readKeepout(c, diags);
        if (k) s.keepouts.push(k);
        break;
      }
      case "bend_keepout": case "elongate_keepout":
        s.other.push(toSExpr(c));
        break;
      case "plane": readPlane(c, s, diags); break;
      case "via": {
        const lx = lexemesOf(c);
        for (const l of lx) s.vias.push(nameOf(l));
        for (const sp of nodesOf(c)) {
          if (sp.head === "spare") for (const l of lexemesOf(sp)) s.spareVias.push(nameOf(l));
        }
        break;
      }
      case "rule": s.rules.push(...readRuleEntries(c, diags)); break;
      case "layer_rule": s.layerRules.push(readLayerRule(c, diags)); break;
      case "control": readControl(c, s, diags); break;
      case "snap_angle": {
        const t = lexemesOf(c)[0]?.text.toLowerCase();
        if (t === "ninety_degree" || t === "fortyfive_degree" || t === "none") s.snapAngle = t;
        else warn(diags, "malformed-snap_angle", "snap_angle needs ninety_degree|fortyfive_degree|none", c);
        break;
      }
      case "flip_style": {
        const t = lexemesOf(c)[0]?.text.toLowerCase();
        if (t === "rotate_first" || t === "mirror_first") s.flipStyle = t;
        else warn(diags, "malformed-flip_style", "flip_style needs rotate_first|mirror_first", c);
        break;
      }
      case "autoroute_settings": s.autorouteSettings = readAutorouteSettings(c, diags); break;
      case "unit": case "resolution":
        warn(diags, "unit-in-section", `${c.head} inside structure is retained and not honoured`, c);
        s.other.push(toSExpr(c));
        break;
      case "grid": case "place_rule":
        s.other.push(toSExpr(c));
        break;
      default: unknown(diags, s.other, c, "structure");
    }
  }
}

function readLayer(node: Node, s: DocStructure, diags: Diagnostic[]): void {
  const lx = lexemesOf(node);
  const nameLx = lx[0];
  if (!nameLx) { warn(diags, "malformed-layer", "layer without a name", node); return; }
  const layer: DocLayer = { name: nameOf(nameLx), type: "", useNets: [], rules: [], other: [] };
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "type": layer.type = lexemesOf(c)[0]?.text ?? ""; break;
      case "use_net": for (const l of lexemesOf(c)) layer.useNets.push(nameOf(l)); break;
      case "rule": layer.rules.push(...readRuleEntries(c, diags)); break;
      case "direction": {
        const d = lexemesOf(c)[0];
        if (d) layer.direction = d.text;
        break;
      }
      default: layer.other.push(toSExpr(c));
    }
  }
  s.layers.push(layer);
}

function readBoundary(node: Node, s: DocStructure, diags: Diagnostic[]): void {
  const b: DocBoundary = { shapes: [], other: [] };
  for (const c of nodesOf(node)) {
    if (isShapeNode(c)) {
      const sh = readShape(c, diags);
      if (sh) b.shapes.push(sh);
    } else if (c.head === "clearance_class") {
      const k = lexemesOf(c)[0];
      if (k) b.clearanceClass = nameOf(k);
    } else b.other.push(toSExpr(c));
  }
  s.boundaries.push(b);
}

/** F-66: `(keepout|via_keepout|wire_keepout|place_keepout [NAME] <shape> {(window …)} [(clearance_class K)])`. */
export function readKeepout(node: Node, diags: Diagnostic[]): DocKeepout | undefined {
  const kind = node.head as DocKeepout["kind"];
  const k: DocKeepout = { kind, shape: undefined as unknown as DocShape, windows: [], other: [] };
  const first = node.items[0];
  if (first && !isNode(first)) k.name = nameOf(first);
  let shape: DocShape | undefined;
  for (const c of nodesOf(node)) {
    if (isShapeNode(c) && !shape) {
      const sh = readShape(c, diags);
      if (!sh) return undefined;
      if (sh.kind === "qarc") { warn(diags, "shape-unsupported", "qarc keepout dropped", c); return undefined; }
      shape = sh;
    } else if (c.head === "window") {
      const inner = nodesOf(c).find(isShapeNode);
      const sh = inner ? readShape(inner, diags) : undefined;
      if (sh && sh.kind !== "qarc") k.windows.push(sh);
    } else if (c.head === "clearance_class") {
      const cl = lexemesOf(c)[0];
      if (cl) k.clearanceClass = nameOf(cl);
    } else k.other.push(toSExpr(c));
  }
  if (!shape) { warn(diags, `malformed-${node.head}`, "keepout without a shape", node); return undefined; }
  k.shape = shape;
  return k;
}

function readPlane(node: Node, s: DocStructure, diags: Diagnostic[]): void {
  const first = node.items[0];
  if (!first || isNode(first)) { warn(diags, "malformed-plane", "plane without a net name", node); return; }
  const p: DocPlane = { net: nameOf(first), shape: undefined as unknown as DocShape, windows: [], other: [] };
  let shape: DocShape | undefined;
  for (const c of nodesOf(node)) {
    if (isShapeNode(c) && !shape) {
      const sh = readShape(c, diags);
      if (!sh) return;
      if (sh.kind === "qarc") { warn(diags, "shape-unsupported", "qarc plane dropped", c); return; }
      shape = sh;
    } else if (c.head === "window") {
      const inner = nodesOf(c).find(isShapeNode);
      const sh = inner ? readShape(inner, diags) : undefined;
      if (sh && sh.kind !== "qarc") p.windows.push(sh);
    } else if (c.head === "clearance_class") {
      const cl = lexemesOf(c)[0];
      if (cl) p.clearanceClass = nameOf(cl);
    } else p.other.push(toSExpr(c));
  }
  if (!shape) { warn(diags, "malformed-plane", "plane without a shape", node); return; }
  p.shape = shape;
  s.planes.push(p);
}

function readControl(node: Node, s: DocStructure, diags: Diagnostic[]): void {
  for (const c of nodesOf(node)) {
    if (c.head === "via_at_smd") {
      const v = onOff(lexemesOf(c)[0]);
      if (v === undefined) warn(diags, "malformed-via_at_smd", "expected on|off", c);
      else s.control.viaAtSmd = v;
    } else s.control.other.push(toSExpr(c));
  }
}

/** F-73: the autoroute_settings block (misspelt `prefered_direction…` accepted). */
export function readAutorouteSettings(node: Node, diags: Diagnostic[]): DocAutorouteSettings {
  const a: DocAutorouteSettings = { layerRules: [], other: [] };
  const flag = (c: Node, set: (v: boolean) => void) => {
    const v = onOff(lexemesOf(c)[0]);
    if (v === undefined) warn(diags, `malformed-${c.head}`, "expected on|off", c); else set(v);
  };
  const num = (c: Node, set: (v: number) => void) => {
    const v = numberOf(lexemesOf(c)[0]);
    if (v === undefined) warn(diags, `malformed-${c.head}`, "expected a number", c); else set(v);
  };
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "fanout": flag(c, (v) => { a.fanout = v; }); break;
      case "autoroute": flag(c, (v) => { a.autoroute = v; }); break;
      case "postroute": flag(c, (v) => { a.postroute = v; }); break;
      case "vias": flag(c, (v) => { a.vias = v; }); break;
      case "via_costs": num(c, (v) => { a.viaCosts = v; }); break;
      case "plane_via_costs": num(c, (v) => { a.planeViaCosts = v; }); break;
      case "start_ripup_costs": num(c, (v) => { a.startRipupCosts = v; }); break;
      case "start_pass_no": num(c, (v) => { a.startPassNo = v; }); break;
      case "layer_rule": {
        const name = lexemesOf(c)[0];
        if (!name) { warn(diags, "malformed-layer_rule", "layer_rule without a layer name", c); break; }
        const r: DocAutorouteLayerRule = { layer: nameOf(name), other: [] };
        for (const e of nodesOf(c)) {
          switch (e.head) {
            case "active": flag(e, (v) => { r.active = v; }); break;
            case "preferred_direction": case "prefered_direction": {
              const d = lexemesOf(e)[0]?.text.toLowerCase();
              if (d === "horizontal" || d === "vertical") r.preferredDirection = d;
              else warn(diags, "malformed-preferred_direction", "expected horizontal|vertical", e);
              break;
            }
            case "preferred_direction_trace_costs": case "prefered_direction_trace_costs":
              num(e, (v) => { r.preferredDirectionTraceCosts = v; }); break;
            case "against_preferred_direction_trace_costs": case "against_prefered_direction_trace_costs":
              num(e, (v) => { r.againstPreferredDirectionTraceCosts = v; }); break;
            default: r.other.push(toSExpr(e));
          }
        }
        a.layerRules.push(r);
        break;
      }
      default: a.other.push(toSExpr(c));
    }
  }
  return a;
}

// ---- placement --------------------------------------------------------------------------------

function readPlacement(node: Node, p: DocPlacement, diags: Diagnostic[], visit: Visit): void {
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "component": readComponent(c, p, diags, visit); break;
      case "place_control": {
        for (const e of nodesOf(c)) {
          if (e.head === "flip_style") {
            const t = lexemesOf(e)[0]?.text.toLowerCase();
            if (t === "rotate_first" || t === "mirror_first") p.flipStyle = t;
            else warn(diags, "malformed-flip_style", "flip_style needs rotate_first|mirror_first", e);
          }
        }
        p.other.push(toSExpr(c));
        break;
      }
      case "structure": case "library": case "network": case "wiring": visit(c, "placement"); break;
      case "unit": case "resolution":
        warn(diags, "unit-in-section", `${c.head} inside placement is retained and not honoured`, c);
        p.other.push(toSExpr(c));
        break;
      default: unknown(diags, p.other, c, "placement");
    }
  }
}

function readComponent(node: Node, p: DocPlacement, diags: Diagnostic[], visit: Visit): void {
  const first = node.items[0];
  if (!first || isNode(first)) { warn(diags, "malformed-component", "component without an image name", node); return; }
  const comp: DocComponent = { image: nameOf(first), places: [], other: [] };
  for (const c of nodesOf(node)) {
    if (c.head === "place") {
      const pl = readPlace(c, diags);
      if (pl) comp.places.push(pl);
    } else if (c.head === "structure" || c.head === "library" || c.head === "network" || c.head === "wiring") {
      // F-21: a section swallowed by a lost parenthesis in a placement entry is read as top level.
      visit(c, "component");
    } else comp.other.push(toSExpr(c));
  }
  p.components.push(comp);
}

function readPlace(node: Node, diags: Diagnostic[]): DocPlace | undefined {
  const lx = lexemesOf(node);
  const ref = lx[0];
  if (!ref) { warn(diags, "malformed-place", "place without a reference", node); return undefined; }
  const pl: DocPlace = { ref: nameOf(ref), pinClearance: [], keepoutClearance: [], other: [] };
  if (lx.length >= 2) {
    const x = numberOf(lx[1]);
    const y = numberOf(lx[2]);
    if (x === undefined || y === undefined) { warn(diags, "malformed-place", `place ${pl.ref}: coordinates are not numbers`, node); return undefined; }
    pl.x = x; pl.y = y;
    const side = lx[3]?.text.toLowerCase();
    if (side === "front" || side === "back") pl.side = side;
    else if (lx[3] !== undefined) { warn(diags, "side-unknown", `place ${pl.ref}: side '${lx[3].text}' read as front`, node); pl.side = "front"; }
    else pl.side = "front";
    const rot = numberOf(lx[4]);
    if (rot !== undefined) pl.rotation = rot;
    else if (lx[4] !== undefined) { warn(diags, "malformed-place", `place ${pl.ref}: rotation is not a number`, node); return undefined; }
    else pl.rotation = 0;
  }
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "pn": {
        const t = lexemesOf(c)[0];
        pl.partNumber = t ? nameOf(t) : "";
        break;
      }
      case "lock_type": pl.lockType = lexemesOf(c).map(nameOf); break;
      case "pin": {
        const name = lexemesOf(c)[0];
        const cl = nodesOf(c).find((n) => n.head === "clearance_class");
        const k = cl ? lexemesOf(cl)[0] : undefined;
        if (name && k) pl.pinClearance.push({ pin: nameOf(name), clearanceClass: nameOf(k) });
        else pl.other.push(toSExpr(c));
        break;
      }
      case "keepout": case "via_keepout": case "place_keepout": {
        const name = lexemesOf(c)[0];
        const cl = nodesOf(c).find((n) => n.head === "clearance_class");
        const k = cl ? lexemesOf(cl)[0] : undefined;
        if (name && k) pl.keepoutClearance.push({ kind: c.head, name: nameOf(name), clearanceClass: nameOf(k) });
        else pl.other.push(toSExpr(c));
        break;
      }
      default: pl.other.push(toSExpr(c));
    }
  }
  return pl;
}

// ---- library ----------------------------------------------------------------------------------

function readLibrary(node: Node, lib: DocLibrary, diags: Diagnostic[], visit: Visit): void {
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "image": {
        const im = readImage(c, diags);
        if (im) lib.images.push(im);
        break;
      }
      case "padstack": {
        const ps = readPadstack(c, diags);
        if (ps) lib.padstacks.push(ps);
        break;
      }
      case "structure": visit(c, "library"); break;
      case "unit": case "resolution":
        warn(diags, "unit-in-section", `${c.head} inside library is retained and not honoured`, c);
        lib.other.push(toSExpr(c));
        break;
      default: unknown(diags, lib.other, c, "library");
    }
  }
}

function readImage(node: Node, diags: Diagnostic[]): DocImage | undefined {
  const first = node.items[0];
  if (!first || isNode(first)) { warn(diags, "malformed-image", "image without a name", node); return undefined; }
  const im: DocImage = { name: nameOf(first), pins: [], outlines: [], keepouts: [], other: [] };
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "pin": {
        const pin = readPin(c, diags);
        if (pin) im.pins.push(pin);
        break;
      }
      case "outline": {
        const inner = nodesOf(c).find(isShapeNode);
        const sh = inner ? readShape(inner, diags) : undefined;
        if (sh) im.outlines.push(sh);
        else im.other.push(toSExpr(c));
        break;
      }
      case "keepout": case "via_keepout": case "wire_keepout": case "place_keepout": {
        const k = readKeepout(c, diags);
        if (k) im.keepouts.push(k);
        break;
      }
      case "side": {
        const t = lexemesOf(c)[0]?.text.toLowerCase();
        if (t === "front" || t === "back" || t === "both") im.side = t;
        else im.other.push(toSExpr(c));
        break;
      }
      default: im.other.push(toSExpr(c));
    }
  }
  return im;
}

/** F-91: `(pin PADSTACK [(rotate R)] NAME x y [(rotate R)])`. */
function readPin(node: Node, diags: Diagnostic[]): DocPin | undefined {
  const lx = lexemesOf(node);
  if (lx.length < 3) { warn(diags, "malformed-pin", "pin needs a padstack, a name and two coordinates", node); return undefined; }
  const x = numberOf(lx[2]);
  const y = numberOf(lx[3]);
  if (x === undefined || y === undefined) { warn(diags, "malformed-pin", "pin coordinates are not numbers", node); return undefined; }
  const pin: DocPin = { padstack: nameOf(lx[0]!), name: nameOf(lx[1]!), x, y, rotation: 0, other: [] };
  for (const c of nodesOf(node)) {
    if (c.head === "rotate") {
      const r = numberOf(lexemesOf(c)[0]);
      if (r !== undefined) pin.rotation = r;
      else warn(diags, "malformed-rotate", "rotate needs a number", c);
    } else pin.other.push(toSExpr(c));
  }
  return pin;
}

/** F-95: `(padstack NAME {(shape <shape> …)} [(attach on|off [(use_via v)])] [(absolute on|off)] …)`. */
export function readPadstack(node: Node, diags: Diagnostic[]): DocPadstack | undefined {
  const first = node.items[0];
  if (!first || isNode(first)) { warn(diags, "malformed-padstack", "padstack without a name", node); return undefined; }
  const ps: DocPadstack = { name: nameOf(first), shapes: [], attach: true, absolute: false, other: [] };
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "shape": {
        const entry: DocPadstackShape = { shape: undefined as unknown as DocShape, other: [] };
        let shape: DocShape | undefined;
        for (const e of nodesOf(c)) {
          if (isShapeNode(e) && !shape) {
            const sh = readShape(e, diags);
            if (sh && sh.kind === "qarc") { warn(diags, "shape-unsupported", `padstack ${ps.name}: qarc shape dropped`, e); continue; }
            shape = sh;
          } else entry.other.push(toSExpr(e));
        }
        if (!shape) { warn(diags, "malformed-shape", `padstack ${ps.name}: shape scope without a shape`, c); break; }
        entry.shape = shape;
        ps.shapes.push(entry);
        break;
      }
      case "attach": {
        const v = onOff(lexemesOf(c)[0]);
        if (v === undefined) { warn(diags, "malformed-attach", "attach needs on|off", c); break; }
        ps.attach = v;
        const uv = nodesOf(c).find((n) => n.head === "use_via");
        const uvName = uv ? lexemesOf(uv)[0] : undefined;
        if (uvName) ps.attachUseVia = nameOf(uvName);
        break;
      }
      case "absolute": {
        const v = onOff(lexemesOf(c)[0]);
        if (v === undefined) { warn(diags, "malformed-absolute", "absolute needs on|off", c); break; }
        ps.absolute = v;
        break;
      }
      default: ps.other.push(toSExpr(c));
    }
  }
  return ps;
}

// ---- network ----------------------------------------------------------------------------------

function readNetwork(node: Node, net: DocNetwork, diags: Diagnostic[], visit: Visit): void {
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "net": {
        const n = readNet(c, diags);
        if (n) net.nets.push(n);
        break;
      }
      case "class": {
        const cl = readClass(c, diags);
        if (cl) net.classes.push(cl);
        break;
      }
      case "class_class": net.classClasses.push(readClassClass(c, diags)); break;
      case "via_rule": {
        const vr = readViaRule(c, diags);
        if (vr) net.viaRules.push(vr);
        break;
      }
      case "structure": visit(c, "network"); break;
      default:
        // `via` definitions (rules/vias.md V-02) and anything else stay in `other`.
        if (c.head === "via") net.other.push(toSExpr(c));
        else unknown(diags, net.other, c, "network");
    }
  }
}

/**
 * F-101: the pin references of a `pins` / `order` / `fromto` scope. Entries are runs of glued
 * lexemes; each is split at the first `-` of a bare lexeme (quoted segments are never split).
 */
export function readPinRefs(node: Node, diags: Diagnostic[]): DocPinRef[] {
  const out: DocPinRef[] = [];
  const lx = lexemesOf(node);
  let run: Lexeme[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const ref = splitPinRef(run);
    if (ref) out.push(ref);
    else warn(diags, "pin-reference-malformed", `pin reference '${run.map((l) => l.text).join("")}' has no '-'`, run[0]);
    run = [];
  };
  for (const l of lx) {
    if (!l.glued) flush();
    run.push(l);
  }
  flush();
  return out;
}

function stripQuotes(s: string): string {
  if (s.length >= 2 && (s[0] === "\"" || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
  if (s.length >= 1 && (s[0] === "\"" || s[0] === "'")) return s.slice(1);
  return s;
}

function splitPinRef(run: Lexeme[]): DocPinRef | undefined {
  let before = "";
  for (let i = 0; i < run.length; i++) {
    const l = run[i]!;
    if (l.kind === "string") { before += l.text; continue; }
    const k = l.text.indexOf("-");
    if (k < 0) { before += l.text; continue; }
    const component = before + l.text.slice(0, k);
    let after = l.text.slice(k + 1);
    for (let j = i + 1; j < run.length; j++) after += run[j]!.text;
    return { component: stripQuotes(component), pin: stripQuotes(after) };
  }
  return undefined;
}

function readNet(node: Node, diags: Diagnostic[]): DocNet | undefined {
  const first = node.items[0];
  if (!first || isNode(first)) { warn(diags, "malformed-net", "net without a name", node); return undefined; }
  const n: DocNet = { name: nameOf(first), subnet: 1, pins: [], ordered: false, fromtos: [], rules: [], layerRules: [], other: [] };
  const second = node.items[1];
  if (second && !isNode(second) && second.kind === "number" && second.value !== undefined && Number.isInteger(second.value)) n.subnet = second.value;
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "pins": n.pins.push(...readPinRefs(c, diags)); break;
      case "order": n.ordered = true; n.pins.push(...readPinRefs(c, diags)); break;
      case "fromto": n.fromtos.push(readPinRefs(c, diags)); break;
      case "rule": n.rules.push(...readRuleEntries(c, diags)); break;
      case "layer_rule": n.layerRules.push(readLayerRule(c, diags)); break;
      case "circuit": n.circuit = readCircuit(c); break;
      default: n.other.push(toSExpr(c));
    }
  }
  return n;
}

function readCircuit(node: Node): DocCircuit {
  const c: DocCircuit = { useVia: [], useLayer: [], other: [] };
  for (const e of nodesOf(node)) {
    if (e.head === "use_via") c.useVia.push(...lexemesOf(e).map(nameOf));
    else if (e.head === "use_layer") c.useLayer.push(...lexemesOf(e).map(nameOf));
    else c.other.push(toSExpr(e));
  }
  return c;
}

/** F-102: `(class NAME net… (circuit …) (rule …) (clearance_class K) (via_rule V) {(layer_rule …)})`. */
export function readClass(node: Node, diags: Diagnostic[]): DocClass | undefined {
  const lx = lexemesOf(node);
  const first = lx[0];
  // `(class (circuit …))` with no name at all (EasyEDA Pro) is the class named "" (F-102, D-17).
  const cl: DocClass = { name: first ? nameOf(first) : "", nets: [], rules: [], layerRules: [], other: [] };
  for (let i = 1; i < lx.length; i++) {
    const name = nameOf(lx[i]!);
    if (name === "") continue; // D-27
    cl.nets.push(name);
  }
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "circuit": cl.circuit = readCircuit(c); break;
      case "rule": cl.rules.push(...readRuleEntries(c, diags)); break;
      case "layer_rule": cl.layerRules.push(readLayerRule(c, diags)); break;
      case "clearance_class": {
        const k = lexemesOf(c)[0];
        if (k) cl.clearanceClass = nameOf(k);
        break;
      }
      case "via_rule": {
        const v = lexemesOf(c)[0];
        if (v) cl.viaRule = nameOf(v);
        break;
      }
      default: cl.other.push(toSExpr(c));
    }
  }
  return cl;
}

export function readClassClass(node: Node, diags: Diagnostic[]): DocClassClass {
  const cc: DocClassClass = { classes: [], rules: [], layerRules: [], other: [] };
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "classes": cc.classes.push(...lexemesOf(c).map(nameOf)); break;
      case "rule": cc.rules.push(...readRuleEntries(c, diags)); break;
      case "layer_rule": cc.layerRules.push(readLayerRule(c, diags)); break;
      default: cc.other.push(toSExpr(c));
    }
  }
  return cc;
}

export function readViaRule(node: Node, diags: Diagnostic[]): DocViaRule | undefined {
  const lx = lexemesOf(node);
  const first = lx[0];
  if (!first) { warn(diags, "malformed-via_rule", "via_rule without a name", node); return undefined; }
  return { name: nameOf(first), vias: lx.slice(1).map(nameOf), other: nodesOf(node).map(toSExpr) };
}

// ---- wiring -----------------------------------------------------------------------------------

function readWiring(node: Node, w: DocWiring, diags: Diagnostic[], visit: Visit): void {
  for (const c of nodesOf(node)) {
    switch (c.head) {
      case "wire": {
        const wire = readWire(c, diags);
        if (wire) w.wires.push(wire);
        break;
      }
      case "via": readWireVia(c, w, diags); break;
      case "structure": visit(c, "wiring"); break;
      case "unit": case "resolution":
        warn(diags, "unit-in-section", `${c.head} inside wiring is retained and not honoured`, c);
        w.other.push(toSExpr(c));
        break;
      default: unknown(diags, w.other, c, "wiring");
    }
  }
}

function readNetRef(c: Node): { net: string; subnet?: number } | undefined {
  const lx = lexemesOf(c);
  const name = lx[0];
  if (!name) return undefined;
  const sub = lx[1];
  const out: { net: string; subnet?: number } = { net: nameOf(name) };
  if (sub && sub.kind === "number" && sub.value !== undefined && Number.isInteger(sub.value)) out.subnet = sub.value;
  return out;
}

function readWire(node: Node, diags: Diagnostic[]): DocWire | undefined {
  const w: DocWire = { shape: undefined as unknown as DocShape, windows: [], other: [] };
  let shape: DocShape | undefined;
  for (const c of nodesOf(node)) {
    if (isShapeNode(c) && !shape) {
      const sh = readShape(c, diags);
      if (!sh) return undefined;
      if (sh.kind === "qarc") { warn(diags, "shape-unsupported", "qarc wire dropped", c); return undefined; }
      shape = sh;
    } else if (c.head === "net") {
      const r = readNetRef(c);
      if (r) { w.net = r.net; if (r.subnet !== undefined) w.subnet = r.subnet; }
      else w.other.push(toSExpr(c));
    } else if (c.head === "type") {
      const t = lexemesOf(c)[0];
      if (t) w.type = t.text; else w.other.push(toSExpr(c));
    } else if (c.head === "clearance_class") {
      const k = lexemesOf(c)[0];
      if (k) w.clearanceClass = nameOf(k); else w.other.push(toSExpr(c));
    } else if (c.head === "window") {
      const inner = nodesOf(c).find(isShapeNode);
      const sh = inner ? readShape(inner, diags) : undefined;
      if (sh && sh.kind !== "qarc") w.windows.push(sh);
    } else w.other.push(toSExpr(c));
  }
  if (!shape) { warn(diags, "malformed-wire", "wire without a shape", node); return undefined; }
  w.shape = shape;
  return w;
}

function readWireVia(node: Node, w: DocWiring, diags: Diagnostic[]): void {
  const lx = lexemesOf(node);
  const first = lx[0];
  if (!first) { warn(diags, "malformed-via", "via without a padstack name", node); return; }
  const points: number[] = [];
  for (let i = 1; i < lx.length; i++) {
    const v = numberOf(lx[i]);
    if (v === undefined) break;
    points.push(v);
  }
  if (points.length % 2 === 1) points.pop();
  if (points.length < 2) { warn(diags, "malformed-via", "via without coordinates", node); return; }
  const via: DocWireVia = { padstack: nameOf(first), points, other: [] };
  for (const c of nodesOf(node)) {
    if (c.head === "net") {
      const r = readNetRef(c);
      if (r) { via.net = r.net; if (r.subnet !== undefined) via.subnet = r.subnet; }
      else via.other.push(toSExpr(c));
    } else if (c.head === "type") {
      const t = lexemesOf(c)[0];
      if (t) via.type = t.text; else via.other.push(toSExpr(c));
    } else via.other.push(toSExpr(c));
  }
  w.vias.push(via);
}
