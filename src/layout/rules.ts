/**
 * Rule semantics shared by the DSN builder and the rules-file overlay: Kinds and the
 * SpacingTable (spec/rules/clearance.md C-03 … C-13), NetGroups from `class` scopes
 * (spec/rules/nets.md N-05, N-06), via definitions and via rules (spec/rules/vias.md V-01 …
 * V-05), and the `type` text split of spec/formats/rules.md F-R12. Everything here mutates a
 * LayoutX in place and records diagnostics on `layout.warnings`.
 *
 * Public surface: splitTypeText, applyRuleEntries, applyLayerRule, applyClass, applyClassClass,
 * ensureGroup, defaultGroup, addViaDef, addViaRuleFromNames, resolveGroupViaRules,
 * buildDefaultViaRule, classViaRule, refreshItemKinds, RuleContext.
 */
import type { Diagnostic, ViaRule } from "../../spec/types/layout.ts";
import type { DocCircuit, DocClass, DocClassClass, DocLayerRule, DocRuleEntry } from "../../spec/types/dsn.ts";
import { CATEGORIES, type ItemCategory, type LayoutX, type NetGroupX, type ViaDef } from "./model.ts";
import { DEFAULT_KIND } from "./spacing.ts";
import { spacingLu, toLu, widthLu } from "./units.ts";

const CATEGORY_KIND_NAMES: Record<string, ItemCategory> = { smd: "smd", via: "barrel", pin: "pin", area: "area" };
const TURN_GAP_NAMES = new Set(["smd_to_turn_gap", "pad_to_turn_gap"]);
const IGNORED_SPECIAL = new Set(["buried_via_gap", "antipad_gap"]);

export interface RuleContext {
  /** Sheet the rules apply to; undefined = every Sheet. */
  sheet?: number;
  /** The NetGroup whose class scope holds the rule (C-08 / C-09); undefined at structure level. */
  group?: NetGroupX;
}

function diag(L: LayoutX, level: "warning" | "info", code: string, message: string): void {
  const d: Diagnostic = { level, code, message };
  L.warnings.push(d);
}

export function defaultGroup(L: LayoutX): NetGroupX {
  return L.netGroups[0]!;
}

function isDefaultClassName(name: string): boolean {
  const l = name.toLowerCase();
  return l === "default" || l === "kicad_default";
}

/**
 * F-R12: split a `type` text into items at separators and `-` outside quotes; a quoted segment
 * is an item of its own; quotes are removed. Returns the items in order.
 */
export function splitTypeText(text: string): string[] {
  const items: string[] = [];
  let cur = "";
  let has = false;
  const flush = () => { if (has) items.push(cur); cur = ""; has = false; };
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === "\"" || c === "'") {
      flush();
      let j = i + 1;
      while (j < text.length && text[j] !== c) j++;
      items.push(text.slice(i + 1, j));
      i = j < text.length ? j + 1 : text.length;
      continue;
    }
    if (c === "-" || c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v") { flush(); i++; continue; }
    cur += c;
    has = true;
    i++;
  }
  flush();
  return items;
}

/** Resolve a Kind name for a rule: `wire` is `default`; unknown names are created (C-07). */
function kindFor(L: LayoutX, name: string, copyFrom?: number): number {
  if (name.toLowerCase() === "wire") return 1;
  const k = L.spacing.find(name);
  if (k >= 0) return k;
  const idx = L.spacing.add(name);
  if (copyFrom !== undefined && copyFrom !== 1) copyRow(L, idx, copyFrom);
  onKindCreated(L, idx);
  return idx;
}

/** C-09: a Kind created inside a class copies the class Kind's row rather than the default row. */
function copyRow(L: LayoutX, k: number, from: number): void {
  const n = L.spacing.kinds.length;
  for (let s = 0; s < L.spacing.sheetCount; s++) {
    for (let x = 1; x < n; x++) {
      if (x === k) continue;
      L.spacing.set(k, x, L.spacing.get(from, x, s), s);
    }
    L.spacing.set(k, k, L.spacing.get(from, from, s), s);
  }
}

/** C-11: a Kind named like an item category becomes that category's Kind for every group still on `default`. */
function onKindCreated(L: LayoutX, k: number): void {
  const cat = CATEGORY_KIND_NAMES[L.spacing.kinds[k]!.toLowerCase()];
  if (!cat) return;
  for (const g of L.netGroups) if (g.categoryKinds[cat] === 1) g.categoryKinds[cat] = k;
}

/** Interpret a `(type …)` text as a Kind pair, a turn-gap rule, or nothing (ignored special). */
function resolveType(L: LayoutX, text: string, group: NetGroupX | undefined): { a: number; b: number } | "turn-gap" | "ignored" {
  let items = splitTypeText(text);
  if (items.length === 0) return "ignored";
  if (items.length === 1) {
    const x = items[0]!;
    const lx = x.toLowerCase();
    if (TURN_GAP_NAMES.has(lx)) return "turn-gap";
    if (IGNORED_SPECIAL.has(lx)) return "ignored";
    // A single name is a pair only when it carries a `_` (split at the first one); a lone name
    // has no effect (parse summary of Issue413-test.dsn, rules cases of Issue593 / Issue742).
    if (x.includes("_")) { const i = x.indexOf("_"); items = [x.slice(0, i), x.slice(i + 1)]; }
    else return "ignored";
  }
  const ha = items[0]!;
  const hb = items[items.length - 1]!;
  const lowerText = `${ha.toLowerCase()}_${hb.toLowerCase()}`;
  if (!group) {
    // C-03 step 2: a wire pair brings the four category Kinds into being.
    if (lowerText.startsWith("wire_") || lowerText.endsWith("_wire")) for (const n of ["via", "smd", "pin", "area"]) kindFor(L, n);
    return { a: kindFor(L, ha), b: kindFor(L, hb) };
  }
  // C-09 inside a class X: `wire` names X, another half h names X-h (copied from X's row).
  const X = group.kind;
  const half = (h: string): number => {
    if (h.toLowerCase() === "wire") return X;
    const name = `${L.spacing.kinds[X]}-${h}`;
    const existing = L.spacing.find(name);
    const k = existing >= 0 ? existing : kindFor(L, name, X);
    const cat = CATEGORY_KIND_NAMES[h.toLowerCase()];
    if (cat) group.categoryKinds[cat] = k;
    return k;
  };
  return { a: half(ha), b: half(hb) };
}

/**
 * Apply `rule` entries: at structure level (`ctx.group` undefined) widths go to the default
 * group and clearances to the table (C-06, C-09); inside a class the width is the group's and a
 * clearance is C-08 / C-09.
 */
export function applyRuleEntries(L: LayoutX, entries: readonly DocRuleEntry[], ctx: RuleContext): void {
  const frame = L.frame;
  const group = ctx.group;
  for (const e of entries) {
    if (e.kind === "width") {
      const w = widthLu(frame, e.value);
      const g = group ?? defaultGroup(L);
      setGroupWidth(g, w, ctx.sheet);
      if (!group) {
        L.defaultWidthSet = true;
        if (ctx.sheet === undefined) for (let s = 0; s < L.structureWidth.length; s++) L.structureWidth[s] = w;
        else if (ctx.sheet < L.structureWidth.length) L.structureWidth[ctx.sheet] = w;
      }
      continue;
    }
    if (e.kind !== "clearance") continue;
    const v = spacingLu(frame, e.value);
    if (e.type === undefined) {
      if (!group) L.spacing.setAllPairs(v, ctx.sheet);
      else applyClassClearance(L, group, v, ctx.sheet);
      continue;
    }
    const r = resolveType(L, e.type, group && group !== defaultGroup(L) ? group : undefined);
    if (r === "turn-gap") { L.pinEdgeToTurnLu = Math.max(0, toLu(frame, e.value)); L.turnGapSet = true; continue; }
    if (r === "ignored") continue;
    L.spacing.set(r.a, r.b, v, ctx.sheet);
  }
}

function setGroupWidth(g: NetGroupX, w: number, sheet: number | undefined): void {
  if (sheet === undefined) for (let s = 0; s < g.widthBySheet.length; s++) g.widthBySheet[s] = w;
  else if (sheet >= 0 && sheet < g.widthBySheet.length) g.widthBySheet[sheet] = w;
  g.trackWidth = g.widthBySheet[0] ?? w;
}

/** C-08: a class's own clearance. */
function applyClassClearance(L: LayoutX, group: NetGroupX, v: number, sheet: number | undefined): void {
  const def = defaultGroup(L);
  if (group === def) {
    // The default class supplies the default group's rules: Kind `default` itself.
    const n = L.spacing.kinds.length;
    const sheets = sheet === undefined ? range(L.spacing.sheetCount) : [sheet];
    for (const s of sheets) {
      for (let y = 2; y < n; y++) L.spacing.set(1, y, Math.max(L.spacing.get(1, y, s), v), s);
      L.spacing.set(1, 1, v, s);
    }
    return;
  }
  const X = kindFor(L, group.name);
  const n = L.spacing.kinds.length;
  const sheets = sheet === undefined ? range(L.spacing.sheetCount) : [sheet];
  for (const s of sheets) {
    for (let y = 1; y < n; y++) if (y !== X) L.spacing.set(X, y, Math.max(L.spacing.get(X, y, s), v), s);
    L.spacing.set(X, X, v, s);
  }
  for (const c of CATEGORIES) group.categoryKinds[c] = X;
  group.kind = X;
}

function range(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
}

/** F-71 / F-R13: a `layer_rule` scope restricted to named Sheets. Unknown Sheets are skipped. */
export function applyLayerRule(L: LayoutX, lr: DocLayerRule, group?: NetGroupX): void {
  for (const name of lr.layers) {
    const s = L.stack.findIndex((sh) => sh.name === name);
    if (s < 0) { diag(L, "warning", "layer-unknown", `layer_rule names unknown layer '${name}'`); continue; }
    applyRuleEntries(L, lr.rules, group ? { sheet: s, group } : { sheet: s });
  }
}

/** Find a NetGroup by exact name, or create it as a copy of the default group (N-05). */
export function ensureGroup(L: LayoutX, name: string): NetGroupX {
  if (isDefaultClassName(name)) return defaultGroup(L);
  const existing = L.netGroups.find((g) => g.name === name);
  if (existing) return existing;
  const def = defaultGroup(L);
  const g: NetGroupX = {
    id: L.netGroups.length,
    name,
    nets: [],
    trackWidth: def.trackWidth,
    widthBySheet: def.widthBySheet.slice(),
    kind: def.kind,
    categoryKinds: { ...def.categoryKinds },
    usable: def.usable.slice(),
    useLayerGiven: false,
    shoveFixed: false,
    pullTight: true,
    ignored: false,
    ...(def.viaRule !== undefined ? { viaRule: def.viaRule } : {}),
  };
  L.netGroups.push(g);
  return g;
}

function moveNet(L: LayoutX, netId: number, to: NetGroupX): void {
  const net = L.nets[netId]!;
  if (net.group === to.id) return;
  const from = L.netGroups[net.group];
  if (from) from.nets = from.nets.filter((n) => n !== netId);
  net.group = to.id;
  to.nets.push(netId);
}

/** Per-group via-rule wishes recorded from class scopes, resolved by resolveGroupViaRules. */
export interface GroupViaWish { viaRuleName?: string; useVia?: string[]; classRuleName?: string; classRuleId?: number }
const wishes = new WeakMap<NetGroupX, GroupViaWish>();
export function groupWish(g: NetGroupX): GroupViaWish {
  let w = wishes.get(g);
  if (!w) { w = {}; wishes.set(g, w); }
  return w;
}

/**
 * F-102 / F-R17 / C-08: apply a `class` scope. `fromRules` selects the rules-file membership
 * semantics (a non-empty net list replaces the group's membership).
 */
export function applyClass(L: LayoutX, cls: DocClass, fromRules: boolean): NetGroupX {
  const g = ensureGroup(L, cls.name);
  const def = defaultGroup(L);
  if (cls.nets.length > 0) {
    const listed = new Set<number>();
    for (const name of cls.nets) {
      const ids = L.nets.filter((n) => n.name === name).map((n) => n.id);
      if (ids.length === 0) continue; // N-04: a class list creates nothing
      for (const id of ids) {
        const net = L.nets[id]!;
        if (!fromRules && net.group !== 0 && net.group !== g.id) diag(L, "warning", "net-in-two-classes", `net '${name}' listed in two classes; last wins`);
        moveNet(L, id, g);
        listed.add(id);
      }
    }
    if (fromRules && g !== def) for (const id of g.nets.slice()) if (!listed.has(id)) moveNet(L, id, def);
  }
  applyRuleEntries(L, cls.rules, { group: g });
  for (const lr of cls.layerRules) applyLayerRule(L, lr, g);
  if (cls.clearanceClass !== undefined) {
    let k = L.spacing.find(cls.clearanceClass);
    if (k < 0 && g === def && isDefaultClassName(cls.clearanceClass)) k = 1;
    if (k < 0 && fromRules) k = kindFor(L, cls.clearanceClass);
    if (k >= 0) { g.kind = k; g.categoryKinds.track = k; }
    else diag(L, "warning", "kind-unknown", `class '${cls.name}': clearance_class '${cls.clearanceClass}' names no Kind`);
  }
  if (cls.viaRule !== undefined) groupWish(g).viaRuleName = cls.viaRule;
  if (cls.circuit) applyCircuit(L, g, cls.circuit);
  return g;
}

function applyCircuit(L: LayoutX, g: NetGroupX, c: DocCircuit): void {
  if (c.useVia.length > 0) groupWish(g).useVia = c.useVia.slice();
  if (c.useLayer.length > 0) {
    const usable: number[] = [];
    for (const name of c.useLayer) {
      const s = L.stack.findIndex((sh) => sh.name === name);
      if (s < 0) { diag(L, "warning", "layer-unknown", `use_layer names unknown layer '${name}'`); continue; }
      if (L.stack[s]!.role !== "signal") continue;
      if (!usable.includes(s)) usable.push(s);
    }
    g.usable = usable.sort((a, b) => a - b);
    g.useLayerGiven = true;
    g.usableSheets = g.usable.slice();
  }
  for (const o of c.other) {
    const h = o.head.toLowerCase();
    if (h === "length") {
      const mx = typeof o.items[0] === "number" ? o.items[0] : undefined;
      const mn = typeof o.items[1] === "number" ? o.items[1] : undefined;
      if (mx !== undefined) g.maxLength = toLu(L.frame, mx);
      if (mn !== undefined) g.minLength = toLu(L.frame, mn);
    } else if (h === "shove_fixed") g.shoveFixed = String(o.items[0]).toLowerCase() === "on";
    else if (h === "pull_tight") g.pullTight = String(o.items[0]).toLowerCase() !== "off";
  }
}

/** C-10: pairwise rules between the listed NetGroups' Kinds. */
export function applyClassClass(L: LayoutX, cc: DocClassClass): void {
  const kinds: number[] = [];
  for (const name of cc.classes) {
    const g = isDefaultClassName(name) ? defaultGroup(L) : L.netGroups.find((x) => x.name === name);
    if (!g) { diag(L, "warning", "class-unknown", `class_class names unknown class '${name}'`); continue; }
    kinds.push(g.kind);
  }
  const setPairs = (entries: readonly DocRuleEntry[], sheet?: number) => {
    for (const e of entries) {
      if (e.kind !== "clearance" || e.type !== undefined) continue;
      const v = spacingLu(L.frame, e.value);
      for (let i = 0; i < kinds.length; i++) for (let j = i; j < kinds.length; j++) L.spacing.set(kinds[i]!, kinds[j]!, v, sheet);
    }
  };
  setPairs(cc.rules);
  for (const lr of cc.layerRules) {
    for (const name of lr.layers) {
      const s = L.stack.findIndex((sh) => sh.name === name);
      if (s < 0) { diag(L, "warning", "layer-unknown", `layer_rule names unknown layer '${name}'`); continue; }
      setPairs(lr.rules, s);
    }
  }
}

// ---- vias -------------------------------------------------------------------------------------

/** Add or replace a via definition by name (V-02, F-R15). */
export function addViaDef(L: LayoutX, def: ViaDef): void {
  const i = L.viaDefs.findIndex((d) => d.name === def.name);
  if (i >= 0) L.viaDefs[i] = def; else L.viaDefs.push(def);
  if (!L.viaForms.includes(def.form)) L.viaForms.push(def.form);
}

/** V-03 / F-R16: define or replace a via rule from via-definition names. */
export function addViaRuleFromNames(L: LayoutX, name: string, viaNames: readonly string[], dropUnknown: boolean): ViaRule | undefined {
  const forms: ViaDef[] = [];
  for (const v of viaNames) {
    const d = L.viaDefs.find((x) => x.name === v);
    if (!d) {
      diag(L, "warning", "via-unknown", `via_rule '${name}' names unknown via '${v}'`);
      if (!dropUnknown) return undefined;
      continue;
    }
    forms.push(d);
  }
  return putViaRule(L, name, forms);
}

function putViaRule(L: LayoutX, name: string, defs: ViaDef[]): ViaRule {
  const i = L.viaRules.findIndex((r) => r.name === name);
  const rule: ViaRule = {
    id: i >= 0 ? L.viaRules[i]!.id : L.viaRules.length,
    name,
    forms: defs.map((d) => d.form),
    entries: defs.map((d) => ({ form: d.form, kind: d.kind, attach: d.attach })),
  };
  if (i >= 0) L.viaRules[i] = rule; else L.viaRules.push(rule);
  return rule;
}

/** Pad extent of a PadForm on a Sheet: the larger side of its bounding box there (LU). */
function padExtent(L: LayoutX, form: number, sheet: number): number {
  const pf = L.padForms[form];
  if (!pf) return Infinity;
  const shapes = pf.perSheet.get(sheet);
  if (!shapes || shapes.length === 0) return Infinity;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const s of shapes) {
    if (s.kind === "disk") { add(s.c.x - s.r, s.c.y - s.r); add(s.c.x + s.r, s.c.y + s.r); }
    else if (s.kind === "box") { add(s.box.x0, s.box.y0); add(s.box.x1, s.box.y1); }
    else if (s.kind === "ring") for (const p of s.pts) add(p.x, p.y);
    else if (s.kind === "capsule") { add(s.a.x - s.r, s.a.y - s.r); add(s.a.x + s.r, s.a.y + s.r); add(s.b.x - s.r, s.b.y - s.r); add(s.b.x + s.r, s.b.y + s.r); }
    else for (const p of s.pts) { add(p.x - s.halfWidth, p.y - s.halfWidth); add(p.x + s.halfWidth, p.y + s.halfWidth); }
  }
  return Math.max(x1 - x0, y1 - y0);
}

function spanOf(L: LayoutX, form: number): [number, number] {
  const pf = L.padForms[form]!;
  return [pf.sheets[0] ?? 0, pf.sheets[pf.sheets.length - 1] ?? 0];
}

/**
 * V-03 / V-05: build a rule named `name` from `defs`: per distinct span, the definition with the
 * smallest pad extent on the span's first Sheet, spans in order of first appearance.
 */
export function buildDefaultViaRule(L: LayoutX, name: string, defs: readonly ViaDef[]): ViaRule {
  const spans: string[] = [];
  const best = new Map<string, ViaDef>();
  for (const d of defs) {
    const [a, b] = spanOf(L, d.form);
    const key = `${a}-${b}`;
    const cur = best.get(key);
    if (!cur) { spans.push(key); best.set(key, d); continue; }
    if (padExtent(L, d.form, a) < padExtent(L, cur.form, a)) best.set(key, d);
  }
  return putViaRule(L, name, spans.map((k) => best.get(k)!));
}

/** V-04: a class's `use_via` list as a via rule named after the class. */
export function classViaRule(L: LayoutX, g: NetGroupX, ruleName: string, useVia: readonly string[], resolveForm: (name: string) => number | undefined): ViaRule {
  const defs: ViaDef[] = [];
  for (const name of useVia) {
    const f = resolveForm(name);
    if (f === undefined) { diag(L, "warning", "via-padstack-unknown", `use_via '${name}' resolves to no padstack`); continue; }
    if (!L.viaForms.includes(f)) L.viaForms.push(f);
    for (const d of L.viaDefs) if (d.form === f && d.kind === g.categoryKinds.barrel && !defs.some((x) => x.form === d.form)) defs.push(d);
  }
  // Appended as a new rule even when a rule of that name exists (a class named `default` with a
  // `use_via` list yields a second rule named `default`, Issue508-SMD-routing-issue-demo.dsn).
  const rule: ViaRule = { id: L.viaRules.length, name: ruleName, forms: defs.map((d) => d.form), entries: defs.map((d) => ({ form: d.form, kind: d.kind, attach: d.attach })) };
  L.viaRules.push(rule);
  groupWish(g).classRuleId = rule.id;
  return rule;
}

/** Assign each group's via rule: the named rule, else the first rule (V-03). */
export function resolveGroupViaRules(L: LayoutX): void {
  for (const g of L.netGroups) {
    const w = groupWish(g);
    let rule: ViaRule | undefined;
    if (w.viaRuleName !== undefined) {
      rule = L.viaRules.find((r) => r.name === w.viaRuleName);
      if (!rule) diag(L, "warning", "via-rule-unknown", `class '${g.name}': via_rule '${w.viaRuleName}' is not defined`);
    }
    if (!rule && w.classRuleId !== undefined) rule = L.viaRules[w.classRuleId];
    if (!rule && w.classRuleName !== undefined) rule = L.viaRules.find((r) => r.name === w.classRuleName);
    if (!rule) rule = L.viaRules[0];
    if (rule) g.viaRule = rule.id; else delete g.viaRule;
  }
}

/** C-11: recompute the Kind of every item that has no explicit clearance class. */
export function refreshItemKinds(L: LayoutX, explicit: ReadonlySet<number>): void {
  const groupOf = (net: number | null): NetGroupX => (net === null ? defaultGroup(L) : L.netGroups[L.nets[net]!.group] ?? defaultGroup(L));
  for (const p of L.pads) {
    if (explicit.has(p.id)) continue;
    const g = groupOf(p.net);
    p.kind = p.sheets.length === 1 ? g.categoryKinds.smd : g.categoryKinds.pin;
  }
  for (const t of L.tracks) if (!explicit.has(t.id)) t.kind = groupOf(t.net).categoryKinds.track;
  for (const b of L.barrels) if (!explicit.has(b.id)) b.kind = groupOf(b.net).categoryKinds.barrel;
  for (const p of L.pours) if (!explicit.has(p.id)) p.kind = groupOf(p.net).categoryKinds.area;
  for (const f of L.fences) if (!explicit.has(f.id)) f.kind = defaultGroup(L).categoryKinds.area;
  if (L.rim) {
    const k = L.rimClass !== undefined ? L.spacing.find(L.rimClass) : -1;
    L.rim.kind = k >= 0 ? k : defaultGroup(L).categoryKinds.area;
  }
}

export { DEFAULT_KIND };
