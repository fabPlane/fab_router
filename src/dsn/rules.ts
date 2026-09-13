/**
 * Rules files (spec/formats/rules.md F-R1 … F-R20): `readRules` keeps the file as its scope tree
 * (`RulesFile { name, body }`), `applyRules` interprets the entries in file order on top of a
 * Layout read from the design file, with the semantics of spec/rules/clearance.md C-13,
 * spec/rules/nets.md and spec/rules/vias.md. The entries are read with the same scope readers as
 * the design file (read.ts) and applied with the same rule engine (src/layout/rules.ts).
 *
 * `type` texts are split into their items (F-R12) when the file is read, so that the retained
 * SExpr — which cannot carry lexeme adjacency — still carries the pair the writer meant.
 *
 * Public surface: readRules, applyRules.
 */
import type { Diagnostic, Layout } from "../../spec/types/layout.ts";
import type { RulesFile, SExpr } from "../../spec/types/dsn.ts";
import { addPadForm, resolvePadForm, settingsFromDoc, sheetsOfLayer, viaDefFromSExpr } from "../layout/build.ts";
import type { LayoutX } from "../layout/model.ts";
import {
  addViaDef, addViaRuleFromNames, applyClass, applyClassClass, applyLayerRule, applyRuleEntries, classViaRule, groupWish,
  refreshItemKinds, resolveGroupViaRules, splitTypeText,
} from "../layout/rules.ts";
import type { RulesResult } from "./index.ts";
import { lex } from "./lex.ts";
import { readAutorouteSettings, readClass, readClassClass, readPadstack, readRuleEntries, readViaRule, info, warn } from "./read.ts";
import { buildTree, fromSExpr, isNode, itemsText, lexemesOf, nameOf, nodesOf, toSExpr, type Node } from "./tree.ts";

/** Retain a scope; `type` scopes under `clearance` keep their F-R12 items instead of raw lexemes. */
function retain(node: Node, underClearance: boolean): SExpr {
  if (underClearance && node.head === "type") {
    return { head: node.headText, items: splitTypeText(itemsText(node)) };
  }
  const items: SExpr["items"] = [];
  for (const it of node.items) {
    if (isNode(it)) items.push(retain(it, node.head === "clearance"));
    else if (it.kind === "number" && it.value !== undefined) items.push(it.value);
    else items.push(it.text);
  }
  return { head: node.headText, items };
}

/** F-R1 … F-R3: read a rules file; `ok: false` only without the `(rules pcb NAME` head. */
export function readRules(text: string): RulesResult {
  const diagnostics: Diagnostic[] = [];
  const lexemes = lex(text);
  const first = lexemes[0];
  const second = lexemes[1];
  const third = lexemes[2];
  const headOk = first?.kind === "open" && second && (second.kind === "ident" || second.kind === "number") && second.text.toLowerCase() === "rules"
    && third && (third.kind === "ident" || third.kind === "number") && third.text.toLowerCase() === "pcb";
  if (!headOk) {
    const at = first ?? { line: 1, column: 1 };
    return { ok: false, error: { line: at.line, column: at.column, message: "not a rules file: expected '(rules pcb NAME' at the start" }, diagnostics };
  }
  const roots = buildTree(lexemes, diagnostics);
  const root = roots.find((r) => r.head === "rules");
  if (!root) return { ok: false, error: { line: 1, column: 1, message: "no rules scope" }, diagnostics };
  const items = root.items.slice();
  // items[0] is the literal `pcb`; the name follows when it is a lexeme.
  items.shift();
  let name = "";
  const nameItem = items[0];
  if (nameItem && !isNode(nameItem)) { name = nameOf(nameItem); items.shift(); }
  const body: SExpr[] = [];
  for (const it of items) {
    if (!isNode(it)) continue;
    body.push(retain(it, false));
    const h = it.head ?? "";
    if (!["snap_angle", "autoroute_settings", "rule", "layer", "layer_rule", "padstack", "via", "via_rule", "class", "class_class"].includes(h)) {
      info(diagnostics, "unknown-scope", `unknown scope '${it.headText}' in rules`, it);
    }
  }
  for (const r of roots) if (r !== root) info(diagnostics, "unknown-scope", `scope '${r.headText}' outside the rules scope ignored`, r);
  return { ok: true, rules: { name, body }, diagnostics };
}

function nameMatches(L: LayoutX, name: string): boolean {
  const candidates = new Set<string>();
  const add = (s: string | undefined) => {
    if (s === undefined) return;
    candidates.add(s);
    const base = s.split(/[\\/]/).pop() ?? s;
    candidates.add(base);
    candidates.add(base.replace(/\.dsn$/i, ""));
  };
  add(L.name);
  add(L.boardName);
  return candidates.has(name) || candidates.has(name.replace(/\.dsn$/i, ""));
}

/** F-R10 … F-R19: apply a rules file to a Layout produced by readDsn; returns the same Layout. */
export function applyRules(layout: Layout, rules: RulesFile): Layout {
  const L = layout as LayoutX;
  if (!Array.isArray(L.netGroups) || L.netGroups.length === 0 || L.spacing === undefined || typeof (L.spacing as { add?: unknown }).add !== "function") return layout;
  const diags = L.warnings;
  if (!nameMatches(L, rules.name)) warn(diags, "rules-design-mismatch", `rules file names design '${rules.name}', the Layout is '${L.name}'`);
  const sheetsOf = (layer: string) => sheetsOfLayer(L, layer);
  for (const e of rules.body) {
    const node = fromSExpr(e);
    switch (node.head) {
      case "snap_angle": {
        const t = lexemesOf(node)[0]?.text.toLowerCase();
        if (t === "ninety_degree") L.angleMode = "90";
        else if (t === "fortyfive_degree") L.angleMode = "45";
        else if (t === "none") L.angleMode = "any";
        else warn(diags, "malformed-snap_angle", "snap_angle needs ninety_degree|fortyfive_degree|none");
        break;
      }
      case "autoroute_settings":
        L.settingsFromFile = settingsFromDoc(L, readAutorouteSettings(node, diags), diags);
        break;
      case "rule":
        applyRuleEntries(L, readRuleEntries(node, diags), {});
        break;
      case "layer": {
        const name = lexemesOf(node)[0];
        const s = name ? L.stack.findIndex((sh) => sh.name === nameOf(name)) : -1;
        if (s < 0) { warn(diags, "layer-unknown", `rules: layer '${name?.text ?? ""}' is not a Sheet; entry skipped`); break; }
        for (const c of nodesOf(node)) if (c.head === "rule") applyRuleEntries(L, readRuleEntries(c, diags), { sheet: s });
        break;
      }
      case "layer_rule": {
        const layers = lexemesOf(node).map(nameOf);
        const entries = nodesOf(node).filter((c) => c.head === "rule").flatMap((c) => readRuleEntries(c, diags));
        applyLayerRule(L, { layers, rules: entries });
        break;
      }
      case "padstack": {
        const ps = readPadstack(node, diags);
        if (ps) addPadForm(L, ps, sheetsOf, diags, "info");
        break;
      }
      case "via": {
        const d = viaDefFromSExpr(L, toSExpr(node), diags);
        if (d) addViaDef(L, d);
        break;
      }
      case "via_rule": {
        const vr = readViaRule(node, diags);
        if (vr) addViaRuleFromNames(L, vr.name, vr.vias, true);
        break;
      }
      case "class": {
        const cls = readClass(node, diags);
        if (!cls) break;
        const g = applyClass(L, cls, true);
        const useVia = cls.circuit?.useVia ?? [];
        if (useVia.length > 0) classViaRule(L, g, cls.name, useVia, (n) => resolvePadForm(L, n)?.id);
        if (cls.viaRule !== undefined) groupWish(g).viaRuleName = cls.viaRule;
        break;
      }
      case "class_class":
        applyClassClass(L, readClassClass(node, diags));
        break;
      default:
        info(diags, "unknown-scope", `rules: scope '${node.headText}' ignored`);
    }
  }
  resolveGroupViaRules(L);
  refreshItemKinds(L, L.explicitKinds);
  return layout;
}
