/**
 * DSN writer: `DsnDocument` → text (spec/formats/dsn.md §14 F-ROUNDTRIP). Every scope the document
 * model has a field for is written from that field; retained `SExpr`s are written verbatim after
 * the modelled entries of their scope. Names are quoted with the document's quote character when
 * they are empty, contain a separator, a parenthesis, the other quote character or one of
 * `; - _ / ~ { }`, would lex as a number, or begin with a quote character; a name holding the
 * document's own quote character is written with the other one, and one holding both loses the
 * document's. Numbers are written in the shortest form that reproduces their value. The layout of
 * the text (indentation, line breaks) is not specified and is chosen for readability.
 *
 * Public surface: writeDsn, formatName, formatNumber.
 */
import type {
  DocAutorouteSettings, DocClass, DocClassClass, DocKeepout, DocLayerRule, DocNet, DocPadstack, DocPinRef, DocRuleEntry, DocShape,
  DsnDocument, SExpr,
} from "../../spec/types/dsn.ts";
import { isNumberText } from "./lex.ts";

const FORCE_QUOTE = /[\s\x00-\x1f();\-_/~{}]/;

/** Write a name (F-ROUNDTRIP quoting rules). */
export function formatName(name: string, quote: string): string {
  const other = quote === "\"" ? "'" : "\"";
  const hasOwn = name.includes(quote);
  const hasOther = name.includes(other);
  if (hasOwn && hasOther) return `${quote}${name.split(quote).join("")}${quote}`;
  if (hasOwn) return `${other}${name}${other}`;
  const needs = name.length === 0 || FORCE_QUOTE.test(name) || hasOther || isNumberText(name) || name[0] === "\"" || name[0] === "'";
  return needs ? `${quote}${name}${quote}` : name;
}

/** Shortest decimal form that reproduces the value (`String` gives it for finite numbers). */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return String(v === 0 ? 0 : v);
}

class Out {
  private parts: string[] = [];
  private depth = 0;
  constructor(readonly quote: string) {}
  line(s: string): void { this.parts.push("  ".repeat(this.depth) + s); }
  open(s: string): void { this.line(s); this.depth++; }
  close(): void { this.depth--; this.line(")"); }
  name(n: string): string { return formatName(n, this.quote); }
  num(v: number): string { return formatNumber(v); }
  text(): string { return this.parts.join("\n") + "\n"; }
}

function sexpr(o: Out, e: SExpr, anonymous = false): string {
  const items = e.items.map((it, i) => {
    if (typeof it === "number") return o.num(it);
    if (typeof it === "string") return anonymous && i === 0 ? `${o.quote}${it.split(o.quote).join("")}${o.quote}` : o.name(it);
    return sexpr(o, it, it.head === "");
  });
  const head = e.head === "" ? "" : e.head;
  return `(${head}${head && items.length ? " " : ""}${items.join(" ")})`;
}

function others(o: Out, list: readonly SExpr[]): void {
  for (const e of list) o.line(sexpr(o, e, e.head === ""));
}

function shape(o: Out, s: DocShape): string {
  const L = o.name(s.layer);
  const nums = (a: readonly number[]) => a.map((v) => o.num(v)).join(" ");
  switch (s.kind) {
    case "rect": return `(rect ${L} ${nums([s.x1, s.y1, s.x2, s.y2])})`;
    case "circle": return `(circle ${L} ${nums([s.diameter, s.cx, s.cy])})`;
    case "polygon": return `(polygon ${L} ${o.num(s.aperture)} ${nums(s.pts)})`;
    case "path": return `(path ${L} ${o.num(s.width)} ${nums(s.pts)}${s.apertureType ? ` (aperture_type ${s.apertureType})` : ""})`;
    case "polyline_path": return `(polyline_path ${L} ${o.num(s.width)} ${nums(s.pts)})`;
    case "qarc": return `(qarc ${L} ${o.num(s.width)} ${nums(s.pts)})`;
  }
}

function ruleEntries(o: Out, entries: readonly DocRuleEntry[]): void {
  if (entries.length === 0) return;
  o.open("(rule");
  for (const e of entries) {
    if (e.kind === "width") o.line(`(width ${o.num(e.value)})`);
    else if (e.kind === "clearance") o.line(`(clearance ${o.num(e.value)}${e.type !== undefined ? ` (type ${e.type})` : ""})`);
    else o.line(sexpr(o, e.raw));
  }
  o.close();
}

function layerRule(o: Out, lr: DocLayerRule): void {
  o.open(`(layer_rule ${lr.layers.map((l) => o.name(l)).join(" ")}`);
  const rules = lr.rules.filter((r) => r.kind !== "other");
  ruleEntries(o, rules);
  for (const r of lr.rules) if (r.kind === "other") o.line(sexpr(o, r.raw));
  o.close();
}

function keepout(o: Out, k: DocKeepout): void {
  o.open(`(${k.kind}${k.name !== undefined ? ` ${o.name(k.name)}` : ""}`);
  o.line(shape(o, k.shape));
  for (const w of k.windows) o.line(`(window ${shape(o, w)})`);
  if (k.clearanceClass !== undefined) o.line(`(clearance_class ${o.name(k.clearanceClass)})`);
  others(o, k.other);
  o.close();
}

function autorouteSettings(o: Out, a: DocAutorouteSettings): void {
  o.open("(autoroute_settings");
  const flag = (k: string, v: boolean | undefined) => { if (v !== undefined) o.line(`(${k} ${v ? "on" : "off"})`); };
  const num = (k: string, v: number | undefined) => { if (v !== undefined) o.line(`(${k} ${o.num(v)})`); };
  flag("fanout", a.fanout); flag("autoroute", a.autoroute); flag("postroute", a.postroute); flag("vias", a.vias);
  num("via_costs", a.viaCosts); num("plane_via_costs", a.planeViaCosts); num("start_ripup_costs", a.startRipupCosts); num("start_pass_no", a.startPassNo);
  for (const lr of a.layerRules) {
    o.open(`(layer_rule ${o.name(lr.layer)}`);
    flag("active", lr.active);
    if (lr.preferredDirection !== undefined) o.line(`(preferred_direction ${lr.preferredDirection})`);
    num("preferred_direction_trace_costs", lr.preferredDirectionTraceCosts);
    num("against_preferred_direction_trace_costs", lr.againstPreferredDirectionTraceCosts);
    others(o, lr.other);
    o.close();
  }
  others(o, a.other);
  o.close();
}

function pinRef(o: Out, r: DocPinRef): string {
  return `${o.name(r.component)}-${o.name(r.pin)}`;
}

function net(o: Out, n: DocNet): void {
  o.open(`(net ${o.name(n.name)}${n.subnet !== 1 ? ` ${o.num(n.subnet)}` : ""}`);
  o.line(`(${n.ordered ? "order" : "pins"}${n.pins.length ? " " : ""}${n.pins.map((p) => pinRef(o, p)).join(" ")})`);
  for (const ft of n.fromtos) o.line(`(fromto ${ft.map((p) => pinRef(o, p)).join(" ")})`);
  ruleEntries(o, n.rules);
  for (const lr of n.layerRules) layerRule(o, lr);
  if (n.circuit) circuit(o, n.circuit);
  others(o, n.other);
  o.close();
}

function circuit(o: Out, c: { useVia: string[]; useLayer: string[]; other: SExpr[] }): void {
  o.open("(circuit");
  if (c.useVia.length) o.line(`(use_via ${c.useVia.map((v) => o.name(v)).join(" ")})`);
  if (c.useLayer.length) o.line(`(use_layer ${c.useLayer.map((v) => o.name(v)).join(" ")})`);
  others(o, c.other);
  o.close();
}

function cls(o: Out, c: DocClass): void {
  o.open(`(class ${o.name(c.name)}${c.nets.length ? " " : ""}${c.nets.map((n) => o.name(n)).join(" ")}`);
  if (c.circuit) circuit(o, c.circuit);
  ruleEntries(o, c.rules);
  for (const lr of c.layerRules) layerRule(o, lr);
  if (c.clearanceClass !== undefined) o.line(`(clearance_class ${o.name(c.clearanceClass)})`);
  if (c.viaRule !== undefined) o.line(`(via_rule ${o.name(c.viaRule)})`);
  others(o, c.other);
  o.close();
}

function classClass(o: Out, cc: DocClassClass): void {
  o.open("(class_class");
  o.line(`(classes${cc.classes.length ? " " : ""}${cc.classes.map((n) => o.name(n)).join(" ")})`);
  ruleEntries(o, cc.rules);
  for (const lr of cc.layerRules) layerRule(o, lr);
  others(o, cc.other);
  o.close();
}

function padstack(o: Out, p: DocPadstack): void {
  o.open(`(padstack ${o.name(p.name)}`);
  for (const s of p.shapes) {
    if (s.other.length === 0) o.line(`(shape ${shape(o, s.shape)})`);
    else { o.open("(shape"); o.line(shape(o, s.shape)); others(o, s.other); o.close(); }
  }
  if (!p.attach || p.attachUseVia !== undefined) {
    o.line(`(attach ${p.attach ? "on" : "off"}${p.attachUseVia !== undefined ? ` (use_via ${o.name(p.attachUseVia)})` : ""})`);
  }
  if (p.absolute) o.line("(absolute on)");
  others(o, p.other);
  o.close();
}

/** Write a document as text (spec/api/contract.md `writeDsn`). */
export function writeDsn(doc: DsnDocument): string {
  const o = new Out(doc.parser.stringQuote === "'" ? "'" : "\"");
  o.open(`(pcb ${o.name(doc.name)}`);
  if (doc.parser.present) {
    const p = doc.parser;
    o.open("(parser");
    o.line(`(string_quote ${p.stringQuote})`);
    o.line(`(space_in_quoted_tokens ${p.spaceInQuotedTokens ? "on" : "off"})`);
    if (p.hostCad !== undefined) o.line(`(host_cad ${o.name(p.hostCad)})`);
    if (p.hostVersion !== undefined) o.line(`(host_version ${o.name(p.hostVersion)})`);
    others(o, p.other);
    o.close();
  }
  if (doc.resolution.present) o.line(`(resolution ${doc.resolution.unit} ${o.num(doc.resolution.perUnit)})`);
  if (doc.unit.present) o.line(`(unit ${doc.unit.unit})`);

  const s = doc.structure;
  o.open("(structure");
  for (const l of s.layers) {
    o.open(`(layer ${o.name(l.name)}`);
    if (l.type !== "") o.line(`(type ${o.name(l.type)})`);
    if (l.useNets.length) o.line(`(use_net ${l.useNets.map((n) => o.name(n)).join(" ")})`);
    ruleEntries(o, l.rules);
    if (l.direction !== undefined) o.line(`(direction ${o.name(l.direction)})`);
    others(o, l.other);
    o.close();
  }
  for (const b of s.boundaries) {
    o.open("(boundary");
    for (const sh of b.shapes) o.line(shape(o, sh));
    if (b.clearanceClass !== undefined) o.line(`(clearance_class ${o.name(b.clearanceClass)})`);
    others(o, b.other);
    o.close();
  }
  for (const k of s.keepouts) keepout(o, k);
  for (const p of s.planes) {
    o.open(`(plane ${o.name(p.net)}`);
    o.line(shape(o, p.shape));
    for (const w of p.windows) o.line(`(window ${shape(o, w)})`);
    if (p.clearanceClass !== undefined) o.line(`(clearance_class ${o.name(p.clearanceClass)})`);
    others(o, p.other);
    o.close();
  }
  if (s.vias.length || s.spareVias.length) {
    o.line(`(via${s.vias.length ? " " : ""}${s.vias.map((v) => o.name(v)).join(" ")}${s.spareVias.length ? ` (spare ${s.spareVias.map((v) => o.name(v)).join(" ")})` : ""})`);
  }
  ruleEntries(o, s.rules);
  for (const lr of s.layerRules) layerRule(o, lr);
  if (s.control.viaAtSmd !== undefined || s.control.other.length) {
    o.open("(control");
    if (s.control.viaAtSmd !== undefined) o.line(`(via_at_smd ${s.control.viaAtSmd ? "on" : "off"})`);
    others(o, s.control.other);
    o.close();
  }
  if (s.snapAngle !== undefined) o.line(`(snap_angle ${s.snapAngle})`);
  if (s.flipStyle !== undefined) o.line(`(flip_style ${s.flipStyle})`);
  if (s.autorouteSettings) autorouteSettings(o, s.autorouteSettings);
  others(o, s.other);
  o.close();

  const pl = doc.placement;
  o.open("(placement");
  const hasPlaceControl = pl.other.some((e) => e.head.toLowerCase() === "place_control");
  if (pl.flipStyle !== undefined && !hasPlaceControl) o.line(`(place_control (flip_style ${pl.flipStyle}))`);
  for (const c of pl.components) {
    o.open(`(component ${o.name(c.image)}`);
    for (const p of c.places) {
      const coords = p.x !== undefined && p.y !== undefined ? ` ${o.num(p.x)} ${o.num(p.y)} ${p.side ?? "front"} ${o.num(p.rotation ?? 0)}` : "";
      o.open(`(place ${o.name(p.ref)}${coords}`);
      if (p.partNumber !== undefined) o.line(`(PN ${o.name(p.partNumber)})`);
      if (p.lockType !== undefined) o.line(`(lock_type${p.lockType.length ? " " : ""}${p.lockType.map((t) => o.name(t)).join(" ")})`);
      for (const pc of p.pinClearance) o.line(`(pin ${o.name(pc.pin)} (clearance_class ${o.name(pc.clearanceClass)}))`);
      for (const kc of p.keepoutClearance) o.line(`(${kc.kind} ${o.name(kc.name)} (clearance_class ${o.name(kc.clearanceClass)}))`);
      others(o, p.other);
      o.close();
    }
    others(o, c.other);
    o.close();
  }
  others(o, pl.other);
  o.close();

  const lib = doc.library;
  o.open("(library");
  for (const im of lib.images) {
    o.open(`(image ${o.name(im.name)}`);
    if (im.side !== undefined) o.line(`(side ${im.side})`);
    for (const sh of im.outlines) o.line(`(outline ${shape(o, sh)})`);
    for (const p of im.pins) {
      const rot = p.rotation !== 0 ? ` (rotate ${o.num(p.rotation)})` : "";
      if (p.other.length === 0) o.line(`(pin ${o.name(p.padstack)}${rot} ${o.name(p.name)} ${o.num(p.x)} ${o.num(p.y)})`);
      else { o.open(`(pin ${o.name(p.padstack)}${rot} ${o.name(p.name)} ${o.num(p.x)} ${o.num(p.y)}`); others(o, p.other); o.close(); }
    }
    for (const k of im.keepouts) keepout(o, k);
    others(o, im.other);
    o.close();
  }
  for (const p of lib.padstacks) padstack(o, p);
  others(o, lib.other);
  o.close();

  const nw = doc.network;
  o.open("(network");
  for (const n of nw.nets) net(o, n);
  for (const c of nw.classes) cls(o, c);
  for (const cc of nw.classClasses) classClass(o, cc);
  for (const vr of nw.viaRules) {
    if (vr.other.length === 0) o.line(`(via_rule ${o.name(vr.name)}${vr.vias.length ? " " : ""}${vr.vias.map((v) => o.name(v)).join(" ")})`);
    else { o.open(`(via_rule ${o.name(vr.name)}${vr.vias.length ? " " : ""}${vr.vias.map((v) => o.name(v)).join(" ")}`); others(o, vr.other); o.close(); }
  }
  others(o, nw.other);
  o.close();

  if (doc.wiring) {
    const w = doc.wiring;
    o.open("(wiring");
    for (const wire of w.wires) {
      o.open("(wire");
      o.line(shape(o, wire.shape));
      if (wire.net !== undefined) o.line(`(net ${o.name(wire.net)}${wire.subnet !== undefined ? ` ${o.num(wire.subnet)}` : ""})`);
      if (wire.type !== undefined) o.line(`(type ${o.name(wire.type)})`);
      if (wire.clearanceClass !== undefined) o.line(`(clearance_class ${o.name(wire.clearanceClass)})`);
      for (const win of wire.windows) o.line(`(window ${shape(o, win)})`);
      others(o, wire.other);
      o.close();
    }
    for (const v of w.vias) {
      o.open(`(via ${o.name(v.padstack)} ${v.points.map((p) => o.num(p)).join(" ")}`);
      if (v.net !== undefined) o.line(`(net ${o.name(v.net)}${v.subnet !== undefined ? ` ${o.num(v.subnet)}` : ""})`);
      if (v.type !== undefined) o.line(`(type ${o.name(v.type)})`);
      others(o, v.other);
      o.close();
    }
    others(o, w.other);
    o.close();
  }
  others(o, doc.other);
  o.close();
  return o.text();
}
