/**
 * DsnDocument → Layout (docs/DESIGN.md §2–3). The geometric meaning of the file is
 * spec/formats/dsn.md (Frame F-40…F-43, shapes §5, structure §6, placement §7 and §11, library
 * §8, network §9, wiring §10); the semantics are spec/rules/{clearance,nets,vias,keepouts,
 * layers}.md and the padstack name rules of spec/formats/padstack-names.md. Written from the
 * SPECCTRA Design Language Reference (Cadence) descriptors those clauses cite.
 *
 * Order of construction (each step only depends on earlier ones): Frame → Sheets → PadForms →
 * Parts, Pads and Part-owned Fences → Nets → planes and Pours → NetGroups, Kinds and the
 * SpacingTable (structure rules, then classes in file order, then class_class) → via forms,
 * definitions and rules → wiring items → board Fences and Rim → item Kinds → settings.
 *
 * Public surface: buildLayout, normalisePadstackName, resolvePadForm, netHold, addPadForm,
 * sheetsOfLayer, settingsFromDoc, viaDefFromSExpr.
 */
import type { Diagnostic, Fence, Hold, Pad, Pt, ShapeOnSheet, Sheet } from "../../spec/types/layout.ts";
import type { RouteSettings, SheetOverride } from "../../spec/types/settings.ts";
import type {
  DocAutorouteSettings, DocImage, DocKeepout, DocPadstack, DocPlace, DocShape, DsnDocument, SExpr,
} from "../../spec/types/dsn.ts";
import { pointInRing } from "../geom/index.ts";
import {
  BUILTIN_TURN_GAP_LU, BUILTIN_WIDTH_LU, newLayoutX, type FenceX, type LayoutX, type NetGroupX, type NetX, type PadFormX, type ViaDef,
} from "./model.ts";
import {
  addViaDef, addViaRuleFromNames, applyClass, applyClassClass, applyLayerRule, applyRuleEntries, buildDefaultViaRule, classViaRule,
  defaultGroup, groupWish, refreshItemKinds, resolveGroupViaRules,
} from "./rules.ts";
import { cleanRing, isDegenerate, ringOf, shapeBox, shapeToLu, simplifyRing, transformShape, type Rigid } from "./shapes.ts";
import { makeFrame, toLu } from "./units.ts";

/** P-1: remove every `.` followed by digits; the case is kept (compare lower-cased). */
export function normalisePadstackName(name: string): string {
  return name.replace(/\.\d+/g, "");
}

/** P-2: the PadForm a reference resolves to, or undefined. */
export function resolvePadForm(L: LayoutX, name: string): PadFormX | undefined {
  const key = normalisePadstackName(name).toLowerCase();
  return L.padForms.find((p) => p.normKey === key);
}

/** F-112 / V-07: the Hold of a wiring item from its `type`. */
export function netHold(type: string | undefined): Hold {
  if (type === undefined) return "free";
  const t = type.toLowerCase();
  if (t === "fix") return "locked";
  if (t === "normal" || t === "shove_fixed") return "free";
  return "held";
}

function warn(diags: Diagnostic[], code: string, message: string): void {
  diags.push({ level: "warning", code, message });
}
function info(diags: Diagnostic[], code: string, message: string): void {
  diags.push({ level: "info", code, message });
}

/** Build the Layout of a document; diagnostics go to `diags` (and to layout.warnings). */
export function buildLayout(doc: DsnDocument, diags: Diagnostic[], nameOverride?: string): LayoutX {
  const frame = makeFrame(doc.resolution.unit, doc.resolution.perUnit, doc.unit.unit, largestCoordinate(doc));
  const sheetDocs = dedupeLayers(doc, diags);
  const L = newLayoutX(nameOverride ?? doc.name, frame, sheetDocs.length);
  L.warnings = diags;
  const b = new Builder(L, doc, diags);
  b.sheets(sheetDocs);
  b.padForms();
  b.placement();
  b.nets();
  b.planes();
  b.groupsAndRules();
  b.vias();
  b.wiring();
  b.boardFences();
  b.rim();
  b.finish();
  return L;
}

/** The largest absolute coordinate the file contains (boundary first, else placements). */
function largestCoordinate(doc: DsnDocument): number {
  let m = 0;
  const shapeMax = (s: DocShape) => {
    switch (s.kind) {
      case "rect": m = Math.max(m, Math.abs(s.x1), Math.abs(s.y1), Math.abs(s.x2), Math.abs(s.y2)); break;
      case "circle": m = Math.max(m, Math.abs(s.cx) + s.diameter, Math.abs(s.cy) + s.diameter); break;
      default: for (const v of s.pts) m = Math.max(m, Math.abs(v));
    }
  };
  for (const b of doc.structure.boundaries) for (const s of b.shapes) shapeMax(s);
  if (m > 0) return m;
  for (const c of doc.placement.components) for (const p of c.places) if (p.x !== undefined && p.y !== undefined) m = Math.max(m, Math.abs(p.x), Math.abs(p.y));
  if (doc.wiring) for (const w of doc.wiring.wires) shapeMax(w.shape);
  return m;
}

function dedupeLayers(doc: DsnDocument, diags: Diagnostic[]): DsnDocument["structure"]["layers"] {
  const out: DsnDocument["structure"]["layers"] = [];
  const seen = new Set<string>();
  for (const l of doc.structure.layers) {
    if (seen.has(l.name)) { warn(diags, "layer-duplicate", `layer '${l.name}' defined twice; second dropped`); continue; }
    seen.add(l.name);
    out.push(l);
  }
  return out;
}

class Builder {
  private readonly sheetByName = new Map<string, number>();
  private readonly imageByName = new Map<string, DocImage>();
  private readonly partByRef = new Map<string, number>();
  /** part id → (pin name → pad ids) */
  private readonly padsByPart = new Map<number, Map<string, number[]>>();
  private readonly padById = new Map<number, Pad>();
  private readonly netsByName = new Map<string, number[]>();
  private readonly explicitPinKinds: Array<{ pad: number; kind: string }> = [];
  private readonly explicitItemKinds: Array<{ id: number; kind: string }> = [];
  private readonly explicitFenceKinds: Array<{ id: number; kind: string }> = [];
  private flipStyle: "rotate_first" | "mirror_first" = "mirror_first";

  constructor(readonly L: LayoutX, readonly doc: DsnDocument, readonly diags: Diagnostic[]) {}

  private id(): number { return this.L.nextId++; }

  // ---- Sheets (L-01, L-02, F-60) --------------------------------------------------------------

  sheets(layers: DsnDocument["structure"]["layers"]): void {
    for (const l of layers) {
      const t = l.type.toLowerCase();
      let role: Sheet["role"] = "signal";
      if (t === "power") role = "plane";
      else if (t !== "" && t !== "signal" && t !== "jumper" && t !== "mixed") warn(this.diags, "layer-type-unknown", `layer '${l.name}': type '${l.type}' read as signal`);
      const id = this.L.stack.length;
      const sheet: Sheet = { id, name: l.name, role, active: true, preferDir: null };
      this.L.stack.push(sheet);
      this.sheetByName.set(l.name, id);
    }
    this.flipStyle = this.doc.placement.flipStyle ?? this.doc.structure.flipStyle ?? "mirror_first";
  }

  /** Sheet ids a layer reference names: a Sheet, `signal` (signal Sheets) or `pcb` (every Sheet). */
  private sheetsOf(layer: string): number[] | undefined {
    const s = this.sheetByName.get(layer);
    if (s !== undefined) return [s];
    const l = layer.toLowerCase();
    if (l === "pcb") return this.L.stack.map((x) => x.id);
    if (l === "signal") return this.L.stack.filter((x) => x.role === "signal").map((x) => x.id);
    return undefined;
  }

  // ---- PadForms (F-95 … F-97, P-1 … P-10) ------------------------------------------------------

  padForms(): void {
    for (const ps of this.doc.library.padstacks) this.addPadForm(ps, "warning");
  }

  /** Add a PadForm from a padstack definition; returns it, or undefined when dropped. */
  addPadForm(ps: DocPadstack, dupLevel: "warning" | "info"): PadFormX | undefined {
    return addPadForm(this.L, ps, (layer) => this.sheetsOf(layer), this.diags, dupLevel);
  }

  // ---- placement (F-80 … F-82, §11, F-93) -----------------------------------------------------

  placement(): void {
    for (const im of this.doc.library.images) {
      if (this.imageByName.has(im.name)) { warn(this.diags, "image-duplicate", `image '${im.name}' defined twice; second dropped`); continue; }
      this.imageByName.set(im.name, im);
    }
    for (const comp of this.doc.placement.components) {
      let image = this.imageByName.get(comp.image);
      if (!image) {
        // D-S2-05: fall back to the base name without a `::n` suffix.
        const base = comp.image.replace(/::\d+$/, "");
        image = this.imageByName.get(base);
      }
      if (!image) warn(this.diags, "image-unknown", `component image '${comp.image}' is not defined; its parts have no pads`);
      for (const pl of comp.places) this.placePart(comp.image, image, pl);
    }
  }

  private placePart(packageName: string, image: DocImage | undefined, pl: DocPlace): void {
    const L = this.L;
    if (pl.x === undefined || pl.y === undefined) return; // unplaced (F-80)
    if (this.partByRef.has(pl.ref)) { warn(this.diags, "part-duplicate", `part '${pl.ref}' placed twice; second dropped`); return; }
    const side = pl.side ?? "front";
    const rot = norm360(pl.rotation ?? 0);
    const part = { id: L.parts.length, ref: pl.ref, package: packageName, side, at: { x: toLu(L.frame, pl.x), y: toLu(L.frame, pl.y) }, rotationDeg: rot };
    L.parts.push(part);
    this.partByRef.set(pl.ref, part.id);
    const pinMap = new Map<string, number[]>();
    this.padsByPart.set(part.id, pinMap);
    if (!image) return;
    const n = L.stack.length;
    // Transform of a pin offset: front R(rot)·p; back mirror-first R(rot)·M·p; back rotate-first M·R(rot)·p.
    const placeRigid: Rigid = side === "front"
      ? { mirror: false, rotationDeg: rot, dx: part.at.x, dy: part.at.y }
      : this.flipStyle === "mirror_first"
        ? { mirror: true, rotationDeg: rot, dx: part.at.x, dy: part.at.y }
        : { mirror: true, rotationDeg: -rot, dx: part.at.x, dy: part.at.y };
    for (const pin of image.pins) {
      const form = resolvePadForm(L, pin.padstack);
      if (!form) { warn(this.diags, "padstack-unknown", `image '${image.name}' pin '${pin.name}': padstack '${pin.padstack}' unresolved; pin dropped`); continue; }
      const offset: Pt = { x: toLu(L.frame, pin.x), y: toLu(L.frame, pin.y) };
      const at = transformPoint(offset, placeRigid);
      // Effective rotation applied after mirroring (model.ts convention).
      const rotation = side === "front" ? rot + pin.rotation : this.flipStyle === "mirror_first" ? rot - pin.rotation : -rot - pin.rotation;
      const sheets = form.sheets.map((s) => (side === "back" && !form.absolute ? n - 1 - s : s)).sort((a, b) => a - b);
      const pad: Pad = {
        id: this.id(), part: part.id, pinName: pin.name, net: null, form: form.id, at, rotationDeg: norm360(rotation), side, sheets, kind: 1, hold: "locked",
      };
      L.pads.push(pad);
      this.padById.set(pad.id, pad);
      const list = pinMap.get(pin.name) ?? [];
      list.push(pad.id);
      pinMap.set(pin.name, list);
      const pc = pl.pinClearance.find((x) => x.pin === pin.name);
      if (pc) this.explicitPinKinds.push({ pad: pad.id, kind: pc.clearanceClass });
    }
    // F-93 / KO-02: image keepouts follow the part.
    const counters: Record<string, number> = {};
    for (const k of image.keepouts) {
      const kindKey = k.kind === "wire_keepout" ? "keepout" : k.kind;
      counters[kindKey] = (counters[kindKey] ?? 0) + 1;
      const name = k.name ?? `${kindKey}_${counters[kindKey]}`;
      const cls = pl.keepoutClearance.find((x) => x.name === name)?.clearanceClass ?? k.clearanceClass;
      this.addFences(k, "part", (s) => (side === "back" ? n - 1 - s : s), placeRigid, cls);
    }
  }

  // ---- nets (N-01 … N-04) ----------------------------------------------------------------------

  private netKey(name: string, subnet: number): string { return `${subnet}|${name}`; }
  private readonly netByKey = new Map<string, number>();

  private ensureNet(name: string, subnet = 1): NetX {
    const key = this.netKey(name, subnet);
    const existing = this.netByKey.get(key);
    if (existing !== undefined) return this.L.nets[existing]!;
    const net: NetX = { id: this.L.nets.length, name, subnet, group: 0, pads: [], plane: false };
    this.L.nets.push(net);
    this.netByKey.set(key, net.id);
    const list = this.netsByName.get(name) ?? [];
    list.push(net.id);
    this.netsByName.set(name, list);
    return net;
  }

  private padsOf(ref: { component: string; pin: string }): number[] {
    const part = this.partByRef.get(ref.component);
    if (part === undefined) return [];
    return this.padsByPart.get(part)?.get(ref.pin) ?? [];
  }

  nets(): void {
    const L = this.L;
    for (const dn of this.doc.network.nets) {
      const key = this.netKey(dn.name, dn.subnet);
      const dup = this.netByKey.has(key);
      const net = this.ensureNet(dn.name, dn.subnet);
      if (dup) { warn(this.diags, "net-duplicate", `net '${dn.name}' (subnet ${dn.subnet}) declared twice; pins merged`); }
      const assign = (target: NetX, ref: { component: string; pin: string }) => {
        const pads = this.padsOf(ref);
        if (pads.length === 0) { warn(this.diags, "pin-unknown", `net '${dn.name}': pin reference ${ref.component}-${ref.pin} matches no pad`); return; }
        for (const pid of pads) {
          const pad = this.padById.get(pid)!;
          if (pad.net !== null && pad.net !== target.id) {
            // The file lists one pad under two nets: the first net keeps the Pad, both nets list it.
            warn(this.diags, "pin-in-two-nets", `pad ${ref.component}-${ref.pin} is listed by net '${dn.name}' and by net '${L.nets[pad.net]!.name}'`);
          } else pad.net = target.id;
          if (!target.pads.includes(pid)) target.pads.push(pid);
        }
      };
      if (dn.fromtos.length > 0) {
        // N-03: one subnet per fromto scope, numbered upward from the net's subnet.
        let sub = dn.subnet;
        for (const ft of dn.fromtos) {
          const target = sub === dn.subnet ? net : this.ensureNet(dn.name, sub);
          for (const ref of ft.slice(0, 2)) assign(target, ref);
          sub++;
        }
        for (const ref of dn.pins) assign(net, ref);
      } else if (dn.ordered && dn.pins.length > 2) {
        let sub = dn.subnet;
        for (let i = 0; i + 1 < dn.pins.length; i++) {
          const target = sub === dn.subnet ? net : this.ensureNet(dn.name, sub);
          assign(target, dn.pins[i]!);
          assign(target, dn.pins[i + 1]!);
          sub++;
        }
      } else {
        for (const ref of dn.pins) assign(net, ref);
      }
      if (dn.rules.some((r) => r.kind === "width")) this.netWidthRule(net, dn.rules);
    }
  }

  private pendingNetWidths: Array<{ net: NetX; rules: DsnDocument["network"]["nets"][number]["rules"] }> = [];
  private netWidthRule(net: NetX, rules: DsnDocument["network"]["nets"][number]["rules"]): void {
    this.pendingNetWidths.push({ net, rules });
  }

  // ---- planes (F-68, L-05, L-06) ---------------------------------------------------------------

  private planeNetNames = new Set<string>();

  planes(): void {
    const L = this.L;
    for (const p of this.doc.structure.planes) {
      const sheets = this.sheetsOf(p.shape.layer);
      if (!sheets || sheets.length !== 1) { warn(this.diags, "layer-unknown", `plane '${p.net}': layer '${p.shape.layer}' is not a Sheet; dropped`); continue; }
      const shape = shapeToLu(L.frame, p.shape);
      if (!shape) { warn(this.diags, "shape-unsupported", `plane '${p.net}': qarc dropped`); continue; }
      const outline = outlineOf(shape);
      if (outline.length < 3) { warn(this.diags, "malformed-plane", `plane '${p.net}': shape without area; dropped`); continue; }
      const net = this.ensureNet(p.net);
      net.plane = true;
      this.planeNetNames.add(p.net);
      const holes: Pt[][] = [];
      for (const w of p.windows) {
        const ws = shapeToLu(L.frame, w);
        if (!ws) continue;
        const ring = outlineOf(ws);
        if (ring.length >= 3) holes.push(ring);
      }
      const pour = { id: this.id(), net: net.id, sheet: sheets[0]!, outline, holes, kind: 1, hold: "locked" as const };
      L.pours.push(pour);
      if (p.clearanceClass !== undefined) this.explicitItemKinds.push({ id: pour.id, kind: p.clearanceClass });
    }
    // Power Sheets with use_net (L-05): plane nets, and a synthetic Pour when the Sheet has none.
    for (let s = 0; s < this.doc.structure.layers.length; s++) {
      const layer = this.doc.structure.layers[s]!;
      const sheetId = this.sheetByName.get(layer.name);
      if (sheetId === undefined) continue;
      const sheet = L.stack[sheetId]!;
      if (sheet.role !== "plane") continue;
      const named = layer.useNets.map((n) => this.ensureNet(n));
      for (const n of named) { n.plane = true; this.planeNetNames.add(n.name); }
      const poursHere = L.pours.filter((p) => p.sheet === sheetId);
      if (poursHere.length === 0 && named.length > 0) {
        const bb = boardBox(this.doc, L.frame);
        if (bb) {
          const outline = [{ x: bb.x0, y: bb.y0 }, { x: bb.x1, y: bb.y0 }, { x: bb.x1, y: bb.y1 }, { x: bb.x0, y: bb.y1 }];
          const pour = { id: this.id(), net: named[0]!.id, sheet: sheetId, outline, holes: [], kind: 0, hold: "locked" as const };
          L.pours.push(pour);
          this.explicitItemKinds.push({ id: pour.id, kind: "" });
        }
      } else if (poursHere.length === 0) {
        info(this.diags, "plane-empty", `plane Sheet '${sheet.name}' has no plane shape and names no net`);
      }
      if (named.length > 0) sheet.planeNet = named[0]!.id;
      else if (poursHere.length === 1 && poursHere[0]!.net !== null) sheet.planeNet = poursHere[0]!.net;
    }
  }

  // ---- NetGroups, Kinds and the SpacingTable (C-03 … C-10, N-05, N-06) ------------------------

  groupsAndRules(): void {
    const L = this.L;
    const n = L.stack.length;
    const def: NetGroupX = {
      id: 0, name: "default", nets: [], trackWidth: BUILTIN_WIDTH_LU, widthBySheet: new Array(Math.max(1, n)).fill(BUILTIN_WIDTH_LU),
      kind: 1, categoryKinds: { track: 1, barrel: 1, pin: 1, smd: 1, area: 1 },
      usable: L.stack.filter((s) => s.role === "signal").map((s) => s.id), useLayerGiven: false,
      shoveFixed: false, pullTight: true, ignored: false,
    };
    L.netGroups.push(def);
    for (const net of L.nets) def.nets.push(net.id);
    // Structure-level rules: every Sheet, then per Sheet.
    applyRuleEntries(L, this.doc.structure.rules, {});
    for (const lr of this.doc.structure.layerRules) applyLayerRule(L, lr);
    for (const layer of this.doc.structure.layers) {
      const s = this.sheetByName.get(layer.name);
      if (s !== undefined && layer.rules.length > 0) applyRuleEntries(L, layer.rules, { sheet: s });
    }
    // Classes in file order.
    for (const cls of this.doc.network.classes) applyClass(L, cls, false);
    for (const cc of this.doc.network.classClasses) applyClassClass(L, cc);
    // N-06: a net with its own width rule moves into a copy group named after the net.
    for (const { net, rules } of this.pendingNetWidths) {
      const g = applyClass(L, { name: `net:${net.name}`, nets: [], rules, layerRules: [], other: [] }, false);
      const from = L.netGroups[net.group]!;
      from.nets = from.nets.filter((x) => x !== net.id);
      net.group = g.id;
      g.nets.push(net.id);
    }
  }

  // ---- via forms, definitions and rules (V-01 … V-05) -----------------------------------------

  vias(): void {
    const L = this.L;
    const doc = this.doc;
    // V-01: the structure list, then each class's use_via, then network via definitions.
    const listForm = (name: string, code: string): number | undefined => {
      const pf = resolvePadForm(L, name);
      if (!pf) { warn(this.diags, code, `via padstack '${name}' resolves to no padstack`); return undefined; }
      if (!L.viaForms.includes(pf.id)) L.viaForms.push(pf.id);
      return pf.id;
    };
    for (const name of [...doc.structure.vias, ...doc.structure.spareVias]) listForm(name, "via-padstack-unknown");
    for (const cls of doc.network.classes) for (const name of cls.circuit?.useVia ?? []) listForm(name, "via-padstack-unknown");
    const fileDefs = doc.network.other.filter((o) => o.head.toLowerCase() === "via");
    const defDefs: ViaDef[] = [];
    for (const o of fileDefs) {
      const d = viaDefFromSExpr(L, o, this.diags);
      if (d) defDefs.push(d);
    }
    const def = defaultGroup(L);
    if (defDefs.length > 0) {
      for (const d of defDefs) addViaDef(L, d);
    } else {
      // V-02: one definition per via PadForm.
      const viaAtSmd = doc.structure.control.viaAtSmd === true;
      for (const f of L.viaForms) {
        const pf = L.padForms[f]!;
        addViaDef(L, { name: pf.normName, form: f, kind: def.categoryKinds.barrel, attach: viaAtSmd && !pf.attachOff });
      }
    }
    // V-05: classes with their own clearance get definitions <PadForm>-<class>.
    const viaAtSmd = doc.structure.control.viaAtSmd === true;
    const classDefs = new Map<number, ViaDef[]>();
    for (const cls of doc.network.classes) {
      const g = L.netGroups.find((x) => x.name === cls.name);
      if (!g || g === def) continue;
      if (!cls.rules.some((r) => r.kind === "clearance" && r.type === undefined)) continue;
      if (classDefs.has(g.id)) continue;
      const list: ViaDef[] = [];
      for (const f of L.viaForms) {
        const pf = L.padForms[f]!;
        const d: ViaDef = { name: `${pf.normName}-${g.name}`, form: f, kind: g.categoryKinds.barrel, attach: viaAtSmd && !pf.attachOff };
        addViaDef(L, d);
        list.push(d);
      }
      classDefs.set(g.id, list);
    }
    // V-03: file via rules, else a synthesised `default` rule.
    let anyRule = false;
    for (const vr of doc.network.viaRules) {
      const r = addViaRuleFromNames(L, vr.name, vr.vias, false);
      if (r) anyRule = true;
    }
    if (!anyRule) {
      const defs = L.viaDefs.filter((d) => d.kind === def.categoryKinds.barrel);
      if (defs.length > 0) buildDefaultViaRule(L, "default", defs);
    }
    // V-04 / V-05: class rules in class order.
    const seenClassRule = new Set<number>();
    for (const cls of doc.network.classes) {
      const g = L.netGroups.find((x) => x.name === cls.name) ?? (isDefaultName(cls.name) ? def : undefined);
      if (!g || seenClassRule.has(g.id)) continue;
      const useVia = cls.circuit?.useVia ?? [];
      if (useVia.length > 0) {
        seenClassRule.add(g.id);
        classViaRule(L, g, cls.name, useVia, (name) => resolvePadForm(L, name)?.id);
        groupWish(g).useVia = useVia.slice();
      } else if (classDefs.has(g.id) && groupWish(g).viaRuleName === undefined) {
        seenClassRule.add(g.id);
        buildDefaultViaRule(L, g.name, classDefs.get(g.id)!);
        groupWish(g).classRuleName = g.name;
      }
    }
    resolveGroupViaRules(L);
  }

  // ---- wiring (F-110 … F-112) ------------------------------------------------------------------

  private netIdFor(name: string | undefined, subnet: number | undefined): number | null {
    if (name === undefined) return null;
    const ids = this.netsByName.get(name);
    if (!ids || ids.length === 0) return null;
    if (subnet !== undefined) {
      const id = this.netByKey.get(this.netKey(name, subnet));
      return id ?? null;
    }
    return ids[0]!;
  }

  wiring(): void {
    const L = this.L;
    const w = this.doc.wiring;
    if (!w) return;
    for (const wire of w.wires) {
      const sheets = this.sheetsOf(wire.shape.layer);
      const sheet = sheets && sheets.length === 1 ? sheets[0]! : undefined;
      if (sheet === undefined) { warn(this.diags, "layer-unknown", `wire on layer '${wire.shape.layer}' dropped`); continue; }
      const shape = shapeToLu(L.frame, wire.shape);
      if (!shape) { warn(this.diags, "shape-unsupported", "qarc wire dropped"); continue; }
      const net = this.netIdFor(wire.net, wire.subnet);
      if (wire.net !== undefined && net === null) info(this.diags, "net-unknown", `wire names unknown net '${wire.net}'; kept with no net`);
      const hold = netHold(wire.type);
      if (wire.shape.kind === "path" || wire.shape.kind === "polyline_path") {
        if (shape.kind !== "path" || shape.pts.length < 2) { warn(this.diags, "wire-degenerate", "wire path with fewer than two distinct vertices dropped"); continue; }
        if (L.stack[sheet]!.role === "plane") info(this.diags, "wire-on-plane", `wire on plane Sheet '${L.stack[sheet]!.name}' kept`);
        const t = { id: this.id(), net, sheet, pts: shape.pts, width: 2 * shape.halfWidth, kind: 1, hold };
        L.tracks.push(t);
        if (wire.clearanceClass !== undefined) this.explicitItemKinds.push({ id: t.id, kind: wire.clearanceClass });
      } else {
        const outline = outlineOf(shape);
        if (outline.length < 3) { warn(this.diags, "wire-degenerate", "wire area without area dropped"); continue; }
        const holes: Pt[][] = [];
        for (const win of wire.windows) {
          const ws = shapeToLu(L.frame, win);
          if (!ws) continue;
          const ring = outlineOf(ws);
          if (ring.length >= 3) holes.push(ring);
        }
        const p = { id: this.id(), net, sheet, outline, holes, kind: 1, hold };
        L.pours.push(p);
        if (wire.clearanceClass !== undefined) this.explicitItemKinds.push({ id: p.id, kind: wire.clearanceClass });
      }
    }
    for (const via of w.vias) {
      const form = resolvePadForm(L, via.padstack);
      if (!form) { warn(this.diags, "padstack-unknown", `wiring via padstack '${via.padstack}' unresolved; via dropped`); continue; }
      const net = this.netIdFor(via.net, via.subnet);
      if (via.net !== undefined && net === null) info(this.diags, "net-unknown", `via names unknown net '${via.net}'; kept with no net`);
      const hold = netHold(via.type);
      const cls = via.other.find((o) => o.head.toLowerCase() === "clearance_class");
      const clsName = cls && typeof cls.items[0] === "string" ? cls.items[0] : undefined;
      for (let i = 0; i + 1 < via.points.length; i += 2) {
        const b = {
          id: this.id(), net, at: { x: toLu(L.frame, via.points[i]!), y: toLu(L.frame, via.points[i + 1]!) }, form: form.id,
          fromSheet: form.sheets[0]!, toSheet: form.sheets[form.sheets.length - 1]!, kind: 1, hold,
        };
        L.barrels.push(b);
        if (clsName !== undefined) this.explicitItemKinds.push({ id: b.id, kind: clsName });
      }
    }
  }

  // ---- Fences (F-66, F-67, KO-01 … KO-05) ------------------------------------------------------

  private addFences(k: DocKeepout, owner: "board" | "part", mapSheet: (s: number) => number, rigid: Rigid | undefined, cls: string | undefined): void {
    const L = this.L;
    const scope: Fence["scope"] = k.kind === "via_keepout" ? "barrel" : k.kind === "place_keepout" ? "place" : "track";
    const sheets = this.sheetsOf(k.shape.layer);
    if (!sheets) { warn(this.diags, "layer-unknown", `${k.kind} on unknown layer '${k.shape.layer}' dropped`); return; }
    let shape = shapeToLu(L.frame, k.shape);
    if (!shape) { warn(this.diags, "shape-unsupported", `${k.kind}: qarc dropped`); return; }
    if (isDegenerate(shape)) { warn(this.diags, "keepout-degenerate", `${k.kind} '${k.name ?? ""}' has no area; dropped`); return; }
    if (rigid) shape = transformShape(shape, rigid);
    for (const s of sheets) {
      const f: FenceX = { id: this.id(), sheet: mapSheet(s), scope, shape, owner, kind: 1, hold: "locked" };
      L.fences.push(f);
      if (cls !== undefined) this.explicitFenceKinds.push({ id: f.id, kind: cls });
    }
  }

  boardFences(): void {
    for (const k of this.doc.structure.keepouts) this.addFences(k, "board", (s) => s, undefined, k.clearanceClass);
  }

  // ---- Rim (F-62 … F-65) -----------------------------------------------------------------------

  rim(): void {
    const L = this.L;
    const rings: Pt[][] = [];
    let rect: Pt[] | undefined;
    let anyShape = false;
    for (const b of this.doc.structure.boundaries) {
      if (b.clearanceClass !== undefined) L.rimClass = b.clearanceClass;
      for (const s of b.shapes) {
        const layer = s.layer.toLowerCase();
        anyShape = true;
        if (s.kind === "rect" && layer === "pcb") {
          const sh = shapeToLu(L.frame, s);
          if (sh && sh.kind === "box") rect = [{ x: sh.box.x0, y: sh.box.y0 }, { x: sh.box.x1, y: sh.box.y0 }, { x: sh.box.x1, y: sh.box.y1 }, { x: sh.box.x0, y: sh.box.y1 }];
          continue;
        }
        if (layer !== "pcb" && layer !== "signal" && !this.sheetByName.has(s.layer)) { warn(this.diags, "layer-unknown", `boundary shape on unknown layer '${s.layer}' ignored`); continue; }
        if (s.kind === "path" || s.kind === "polygon" || s.kind === "polyline_path" || s.kind === "rect") {
          const sh = shapeToLu(L.frame, s);
          if (!sh) continue;
          const ring = simplifyRing(sh.kind === "path" ? ringOf(sh.pts) : outlineOf(sh));
          if (ring.length >= 3) rings.push(ringOf(ring));
        }
      }
    }
    const outer = rings.length > 0 ? rings : rect ? [rect] : [];
    if (outer.length === 0) {
      if (anyShape) warn(this.diags, "outline-missing", "boundary shapes give no usable outline");
      else warn(this.diags, "outline-missing", "no boundary shape");
      L.rim = null;
      return;
    }
    // F-64: a ring whose vertices all lie inside another ring is a cut-out.
    const isInside = (inner: Pt[], outerRing: Pt[]) => inner.every((p) => pointInRing(outerRing, p) !== "outside");
    const outers: Pt[][] = [];
    const cutouts: Pt[][] = [];
    for (let i = 0; i < outer.length; i++) {
      const r = outer[i]!;
      let contained = false;
      for (let j = 0; j < outer.length; j++) if (i !== j && isInside(r, outer[j]!) && !isInside(outer[j]!, r)) { contained = true; break; }
      (contained ? cutouts : outers).push(r);
    }
    if (outers.length === 0) outers.push(cutouts.shift()!);
    const all = [...outers, ...cutouts];
    const box = ringBox(all.flat());
    if (box.x1 - box.x0 === 0 && box.y1 - box.y0 === 0) {
      warn(this.diags, "outline-missing", "boundary has zero width and height");
      L.rim = null;
      return;
    }
    L.rim = { outline: outers[0]!, outers, cutouts, kind: 1 };
  }

  // ---- final resolution ------------------------------------------------------------------------

  finish(): void {
    const L = this.L;
    const doc = this.doc;
    // Explicit item Kinds (C-11 last row, KO-05).
    for (const { pad, kind } of this.explicitPinKinds) {
      const k = L.spacing.find(kind);
      if (k < 0) continue;
      const p = L.pads.find((x) => x.id === pad);
      if (p) { p.kind = k; L.explicitKinds.add(pad); }
    }
    for (const { id, kind } of this.explicitItemKinds) {
      const k = kind === "" ? 0 : L.spacing.find(kind);
      if (k < 0) continue;
      const item = L.tracks.find((x) => x.id === id) ?? L.barrels.find((x) => x.id === id) ?? L.pours.find((x) => x.id === id);
      if (item) { item.kind = k; L.explicitKinds.add(id); }
    }
    for (const { id, kind } of this.explicitFenceKinds) {
      const k = L.spacing.find(kind);
      const f = L.fences.find((x) => x.id === id);
      if (f) { f.kind = k >= 0 ? k : 0; L.explicitKinds.add(id); }
    }
    refreshItemKinds(L, L.explicitKinds);
    // Angle mode (F-72).
    const snap = doc.structure.snapAngle;
    L.angleMode = snap === "ninety_degree" ? "90" : snap === "none" ? "any" : "45";
    // Turn gap (C-12).
    if (!L.turnGapSet) {
      L.pinEdgeToTurnLu = L.defaultWidthSet ? Math.min(...L.structureWidth.map((w) => w / 2)) : BUILTIN_TURN_GAP_LU;
    }
    // Settings from the file (F-73, settings.md).
    if (doc.structure.autorouteSettings) L.settingsFromFile = settingsFromDoc(L, doc.structure.autorouteSettings, this.diags);
    // NetGroup usable Sheets: signal Sheets, restricted by use_layer (L-04, N-06).
    for (const g of L.netGroups) g.usableSheets = g.usable.slice();
    L.pinEdgeToTurnLu = Math.round(L.pinEdgeToTurnLu);
  }
}

/** Sheet ids a layer reference names on a built Layout: a Sheet, `signal` or `pcb`. */
export function sheetsOfLayer(L: LayoutX, layer: string): number[] | undefined {
  const s = L.stack.find((x) => x.name === layer);
  if (s) return [s.id];
  const l = layer.toLowerCase();
  if (l === "pcb") return L.stack.map((x) => x.id);
  if (l === "signal") return L.stack.filter((x) => x.role === "signal").map((x) => x.id);
  return undefined;
}

/** F-95 … F-97: add a PadForm from a padstack definition; undefined when dropped (P-5 duplicates, F-96). */
export function addPadForm(L: LayoutX, ps: DocPadstack, sheetsOf: (layer: string) => number[] | undefined, diags: Diagnostic[], dupLevel: "warning" | "info"): PadFormX | undefined {
  const normName = normalisePadstackName(ps.name);
  const normKey = normName.toLowerCase();
  if (L.padForms.some((p) => p.normKey === normKey)) {
    diags.push({ level: dupLevel, code: "padstack-duplicate", message: `padstack '${ps.name}' repeats an earlier definition; dropped` });
    return undefined;
  }
  const perSheet = new Map<number, ShapeOnSheet[]>();
  for (const entry of ps.shapes) {
    const sheets = sheetsOf(entry.shape.layer);
    if (!sheets) { warn(diags, "layer-unknown", `padstack '${ps.name}': shape on unknown layer '${entry.shape.layer}' dropped`); continue; }
    const shape = shapeToLu(L.frame, entry.shape);
    if (!shape) { warn(diags, "shape-unsupported", `padstack '${ps.name}': qarc shape dropped`); continue; }
    if (isDegenerate(shape)) { warn(diags, "padstack-shape-degenerate", `padstack '${ps.name}': shape without area dropped`); continue; }
    for (const s of sheets) {
      const list = perSheet.get(s) ?? [];
      list.push(shape);
      perSheet.set(s, list);
    }
  }
  if (perSheet.size === 0) { warn(diags, "padstack-empty", `padstack '${ps.name}' has no shape; dropped`); return undefined; }
  const sheets = [...perSheet.keys()].sort((a, b) => a - b);
  const pf: PadFormX = {
    id: L.padForms.length,
    name: ps.name,
    normName,
    normKey,
    perSheet,
    sheets,
    attachAllowed: ps.attach,
    attachOff: !ps.attach,
    absolute: ps.absolute,
  };
  if (sheets.length >= 2) {
    const r = drillRadius(pf);
    pf.drill = { diameter: 2 * r, fromSheet: sheets[0]!, toSheet: sheets[sheets.length - 1]! };
  }
  L.padForms.push(pf);
  return pf;
}

function isDefaultName(name: string): boolean {
  const l = name.toLowerCase();
  return l === "default" || l === "kicad_default";
}

function norm360(r: number): number {
  const v = ((r % 360) + 360) % 360;
  return v === 360 ? 0 : v;
}

function transformPoint(p: Pt, t: Rigid): Pt {
  return transformShape({ kind: "disk", c: p, r: 0 }, t).kind === "disk" ? (transformShape({ kind: "disk", c: p, r: 0 }, t) as { c: Pt }).c : p;
}

/** The outline ring of an area shape (box, disk approximated by a 32-gon, ring). */
function outlineOf(s: ShapeOnSheet): Pt[] {
  switch (s.kind) {
    case "ring": return s.pts;
    case "box": return [{ x: s.box.x0, y: s.box.y0 }, { x: s.box.x1, y: s.box.y0 }, { x: s.box.x1, y: s.box.y1 }, { x: s.box.x0, y: s.box.y1 }];
    case "disk": {
      if (s.r <= 0) return [];
      const pts: Pt[] = [];
      for (let i = 0; i < 32; i++) {
        const a = (i * 2 * Math.PI) / 32;
        pts.push({ x: s.c.x + Math.round(s.r * Math.cos(a)), y: s.c.y + Math.round(s.r * Math.sin(a)) });
      }
      return cleanRing(pts);
    }
    case "path": {
      // A closed path used as an area: its vertex ring.
      return ringOf(s.pts);
    }
    case "capsule": return [];
  }
}

function ringBox(pts: readonly Pt[]): { x0: number; y0: number; x1: number; y1: number } {
  return shapeBox({ kind: "ring", pts: pts.slice() });
}

/** Bounding box of the boundary shapes in LU (for synthetic plane Pours). */
function boardBox(doc: DsnDocument, frame: LayoutX["frame"]): { x0: number; y0: number; x1: number; y1: number } | undefined {
  let box: { x0: number; y0: number; x1: number; y1: number } | undefined;
  for (const b of doc.structure.boundaries) {
    for (const s of b.shapes) {
      const sh = shapeToLu(frame, s);
      if (!sh) continue;
      const bb = shapeBox(sh);
      box = box ? { x0: Math.min(box.x0, bb.x0), y0: Math.min(box.y0, bb.y0), x1: Math.max(box.x1, bb.x1), y1: Math.max(box.y1, bb.y1) } : bb;
    }
  }
  return box;
}

/** P-10: the hole radius inferred from the name and the smallest half-extent of the shapes. */
function drillRadius(pf: PadFormX): number {
  let r = Infinity;
  for (const shapes of pf.perSheet.values()) {
    for (const s of shapes) {
      const b = shapeBox(s);
      r = Math.min(r, Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2);
    }
  }
  if (!Number.isFinite(r)) r = 0;
  const name = pf.name;
  const colon = name.indexOf(":");
  if (colon >= 0) {
    const afterColon = name.slice(colon + 1);
    const dEnd = afterColon.indexOf("_");
    const dText = (dEnd >= 0 ? afterColon.slice(0, dEnd) : afterColon).replace(/[^0-9.]/g, "");
    const before = name.slice(0, colon);
    const us = before.lastIndexOf("_");
    const oText = us >= 0 ? before.slice(us + 1).replace(/[^0-9.]/g, "") : "";
    const d = Number(dText), o = Number(oText);
    if (us >= 0 && dText !== "" && oText !== "" && Number.isFinite(d) && Number.isFinite(o) && o > 0) return Math.round((r * d) / o);
  }
  return Math.round(0.45 * r);
}

/** V-02 / F-R15: a `(via NAME PADSTACK [KIND] [attach])` definition. */
export function viaDefFromSExpr(L: LayoutX, o: SExpr, diags: Diagnostic[]): ViaDef | undefined {
  const items = o.items.filter((x): x is string | number => typeof x !== "object").map(String);
  const name = items[0];
  const padstack = items[1];
  if (name === undefined || padstack === undefined) { warn(diags, "malformed-via", "network via definition needs a name and a padstack"); return undefined; }
  const pf = resolvePadForm(L, padstack);
  if (!pf) { warn(diags, "padstack-unknown", `via '${name}': padstack '${padstack}' unresolved; dropped`); return undefined; }
  let kind = 1;
  let attach = false;
  for (const t of items.slice(2)) {
    if (t.toLowerCase() === "attach") { attach = true; continue; }
    const k = L.spacing.find(t);
    if (k >= 0) kind = k;
  }
  return { name, form: pf.id, kind, attach };
}

/** settings.md "Settings from the file": the autoroute_settings block as a Partial<RouteSettings>. */
export function settingsFromDoc(L: LayoutX, a: DocAutorouteSettings, diags: Diagnostic[]): Partial<RouteSettings> {
  const s: Partial<RouteSettings> = {};
  if (a.vias !== undefined) s.viasAllowed = a.vias;
  if (a.viaCosts !== undefined) s.viaCost = a.viaCosts;
  if (a.planeViaCosts !== undefined) s.planeViaCost = a.planeViaCosts;
  if (a.startRipupCosts !== undefined) s.startRipupCost = a.startRipupCosts;
  if (a.autoroute !== undefined) s.routerEnabled = a.autoroute;
  if (a.postroute !== undefined) s.optimizerEnabled = a.postroute;
  const layers: Record<string, SheetOverride> = {};
  for (const lr of a.layerRules) {
    if (!L.stack.some((sh) => sh.name === lr.layer)) { warn(diags, "layer-unknown", `autoroute_settings layer_rule names unknown layer '${lr.layer}'; skipped`); continue; }
    const o: SheetOverride = {};
    if (lr.active !== undefined) o.active = lr.active;
    if (lr.preferredDirection !== undefined) o.preferDir = lr.preferredDirection === "horizontal" ? "h" : "v";
    if (lr.preferredDirectionTraceCosts !== undefined) o.alongCost = lr.preferredDirectionTraceCosts;
    if (lr.againstPreferredDirectionTraceCosts !== undefined) o.againstCost = lr.againstPreferredDirectionTraceCosts;
    layers[lr.layer] = o;
  }
  if (Object.keys(layers).length > 0) s.layers = layers;
  return s;
}
