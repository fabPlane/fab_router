/**
 * Lexeme stream → scope tree (spec/formats/dsn.md F-13, F-14) and the conversion of a scope to
 * the retained `SExpr` form of the document model (§13). The internal `Node` keeps every lexeme
 * (kind, source text, quote character, glue, position) so that readers can apply F-7 (names
 * spelled like numbers), F-9 (adjacency) and F-101 (pin references); `SExpr` keeps only what the
 * document model needs and no positions, so that F-ROUNDTRIP deep-equality is well defined.
 *
 * Public surface: Node, Item, isNode, buildTree, toSExpr, fromSExpr, canonicalHead, lexemesOf, nodesOf,
 * nameOf, numberOf, rawText, itemsText.
 */
import type { Diagnostic } from "../../spec/types/layout.ts";
import type { SExpr } from "../../spec/types/dsn.ts";
import type { Lexeme } from "./lex.ts";
import { parseNumberText } from "./lex.ts";

export interface Node {
  /** Canonical head: lowercased, aliases resolved (F-10); null for an anonymous scope. */
  head: string | null;
  /** The head lexeme as written ("" for an anonymous scope). */
  headText: string;
  /** Items after the head (for an anonymous scope: every item). */
  items: Item[];
  line: number;
  column: number;
}
export type Item = Node | Lexeme;

export function isNode(x: Item): x is Node {
  return (x as Node).items !== undefined;
}

const ALIASES: Record<string, string> = {
  circ: "circle",
  rectangle: "rect",
  poly: "polygon",
  clear: "clearance",
  comp: "component",
};

/** F-10: case-insensitive head with the accepted aliases resolved. */
export function canonicalHead(text: string): string {
  const lower = text.toLowerCase();
  return ALIASES[lower] ?? lower;
}

/**
 * F-13: fold lexemes into scopes. A stray `)` is ignored (`stray-close`), scopes open at the end
 * are closed (`unclosed-scope`), a string that spans lines is noted (`string-spans-lines`, info).
 * Lexemes outside every scope are dropped. Returns the top-level scopes in file order.
 */
export function buildTree(lexemes: Lexeme[], diags: Diagnostic[]): Node[] {
  const roots: Node[] = [];
  const stack: Node[] = [];
  let unclosedReported = false;
  for (const lx of lexemes) {
    if (lx.kind === "open") {
      const node: Node = { head: null, headText: "", items: [], line: lx.line, column: lx.column };
      const parent = stack[stack.length - 1];
      if (parent) parent.items.push(node); else roots.push(node);
      stack.push(node);
      continue;
    }
    if (lx.kind === "close") {
      if (stack.length === 0) {
        diags.push({ level: "warning", code: "stray-close", message: "closing parenthesis with no open scope", where: { line: lx.line, column: lx.column } });
        continue;
      }
      stack.pop();
      continue;
    }
    if (lx.kind === "string" && lx.text.includes("\n")) {
      diags.push({ level: "info", code: "string-spans-lines", message: "quoted string spans lines", where: { line: lx.line, column: lx.column } });
    }
    const cur = stack[stack.length - 1];
    if (!cur) continue; // lexeme outside every scope
    if (cur.items.length === 0 && cur.head === null && (lx.kind === "ident" || lx.kind === "number")) {
      cur.head = canonicalHead(lx.text);
      cur.headText = lx.text;
      continue;
    }
    cur.items.push(lx);
  }
  if (stack.length > 0 && !unclosedReported) {
    unclosedReported = true;
    const top = stack[stack.length - 1]!;
    diags.push({ level: "warning", code: "unclosed-scope", message: `${stack.length} scope(s) still open at end of input; closed`, where: { line: top.line, column: top.column } });
  }
  return roots;
}

/** Document-model form of a scope: original head spelling, numbers as values, names as strings. */
export function toSExpr(node: Node): SExpr {
  const items: Array<SExpr | string | number> = [];
  for (const it of node.items) {
    if (isNode(it)) items.push(toSExpr(it));
    else if (it.kind === "number" && it.value !== undefined) items.push(it.value);
    else items.push(it.text);
  }
  return { head: node.headText, items };
}

/**
 * The inverse of toSExpr for re-interpretation (rules files): strings become string lexemes,
 * numbers number lexemes; positions are zero. Glue is lost, which is why readRules pre-splits
 * `type` texts before retaining them.
 */
export function fromSExpr(e: SExpr): Node {
  const items: Item[] = [];
  for (const it of e.items) {
    if (typeof it === "number") items.push({ kind: "number", text: String(it), value: it, line: 0, column: 0, glued: false });
    else if (typeof it === "string") items.push({ kind: "string", text: it, quote: "\"", line: 0, column: 0, glued: false });
    else items.push(fromSExpr(it));
  }
  return { head: e.head === "" ? null : canonicalHead(e.head), headText: e.head, items, line: 0, column: 0 };
}

/** The lexeme items of a scope (nodes skipped), in order. */
export function lexemesOf(node: Node): Lexeme[] {
  const out: Lexeme[] = [];
  for (const it of node.items) if (!isNode(it)) out.push(it);
  return out;
}

/** The child scopes of a scope, in order. */
export function nodesOf(node: Node): Node[] {
  const out: Node[] = [];
  for (const it of node.items) if (isNode(it)) out.push(it);
  return out;
}

/** F-7: a name is the lexeme's source text (quotes already removed for strings). */
export function nameOf(lx: Lexeme): string {
  return lx.text;
}

/** F-8: a number from any lexeme kind, or undefined. */
export function numberOf(lx: Lexeme | undefined): number | undefined {
  if (!lx) return undefined;
  if (lx.kind === "number") return lx.value;
  return parseNumberText(lx.text);
}

/** The lexeme as it stood in the source (strings re-quoted with their own quote character). */
export function rawText(lx: Lexeme): string {
  return lx.kind === "string" ? `${lx.quote ?? "\""}${lx.text}${lx.quote ?? "\""}` : lx.text;
}

/**
 * The text of a scope's lexeme items as written: lexemes separated by one space unless glued
 * (used for `(type …)` texts, rules.md F-R12). Child scopes are ignored.
 */
export function itemsText(node: Node): string {
  let s = "";
  let first = true;
  for (const it of node.items) {
    if (isNode(it)) continue;
    if (!first && !it.glued) s += " ";
    s += rawText(it);
    first = false;
  }
  return s;
}
