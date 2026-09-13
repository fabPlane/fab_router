/**
 * Session-file canonicalisation for the `ses-roundtrip` case (spec/formats/ses.md F-S50), with a
 * self-contained s-expression lexer following spec/formats/dsn.md F-1 … F-13 (separators,
 * parentheses, quoted strings with no escapes using only the declared quote character, bare
 * lexemes, the `string_quote` exception, tree folding). Kept independent of src/dsn so the runner checks the writer with its own eyes.
 *
 * Public surface: lex, toTree, normaliseSession, canon.
 */

export type Node = Array<string | number | Node> & { 0?: string };
export type Item = string | number | Node;
export interface Lexeme { kind: "open" | "close" | "ident" | "number" | "string"; text: string }

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export function lex(text: string): Lexeme[] {
  const out: Lexeme[] = [];
  const n = text.length;
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  let afterStringQuoteHead = false;
  let quote = '"'; // F-4 / Q-I1-29: only the declared quote character quotes (default `"`)
  const isSep = (c: number) => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0c || c === 0x0b || c < 0x20;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (isSep(c)) { i++; continue; }
    const ch = text[i]!;
    if (ch === "(") { out.push({ kind: "open", text: "(" }); i++; afterStringQuoteHead = false; continue; }
    if (ch === ")") { out.push({ kind: "close", text: ")" }); i++; afterStringQuoteHead = false; continue; }
    if (ch === quote && !afterStringQuoteHead) {
      const end = text.indexOf(ch, i + 1);
      const body = end < 0 ? text.slice(i + 1) : text.slice(i + 1, end);
      out.push({ kind: "string", text: body });
      i = end < 0 ? n : end + 1;
      continue;
    }
    let j = i;
    while (j < n) {
      const d = text.charCodeAt(j);
      if (isSep(d) || text[j] === "(" || text[j] === ")") break;
      j++;
    }
    const tok = text.slice(i, j);
    out.push({ kind: NUMBER.test(tok) ? "number" : "ident", text: tok });
    // F-11: the lexeme after the head `string_quote` is read bare even if it starts with a quote.
    if (afterStringQuoteHead && tok.length === 1) quote = tok; // F-30: declared from here on
    const prev = out[out.length - 2];
    afterStringQuoteHead = prev?.kind === "open" && tok.toLowerCase() === "string_quote";
    i = j;
  }
  return out;
}

/** Fold lexemes into trees (F-13). Returns the top-level scopes; stray closes are ignored. */
export function toTree(lexemes: Lexeme[]): Node[] {
  const roots: Node[] = [];
  const stack: Node[] = [];
  for (const t of lexemes) {
    if (t.kind === "open") { const node: Node = []; stack.push(node); continue; }
    if (t.kind === "close") {
      const node = stack.pop();
      if (!node) continue;
      const parent = stack[stack.length - 1];
      if (parent) parent.push(node); else roots.push(node);
      continue;
    }
    const cur = stack[stack.length - 1];
    if (!cur) continue;
    cur.push(t.text); // numbers are decided later per F-S50 step 2 (name positions)
  }
  while (stack.length) { const node = stack.pop()!; const parent = stack[stack.length - 1]; if (parent) parent.push(node); else roots.push(node); }
  return roots;
}

const NAME_POSITION_HEADS = new Set(["session", "base_design", "component", "place", "padstack", "net", "via", "path", "polygon", "circle", "rect", "resolution", "host_cad", "host_version", "type", "attach", "layer", "clearance_class", "pins"]);

function head(node: Node): string {
  return typeof node[0] === "string" ? node[0].toLowerCase() : "";
}

/** F-S50 step 2: numbers become JSON numbers except in name positions. */
function typeItems(node: Node): Node {
  const h = head(node);
  const out: Node = [];
  node.forEach((it, idx) => {
    if (Array.isArray(it)) { out.push(typeItems(it as Node)); return; }
    if (idx === 0) { out.push(h); return; }
    const namePos = (idx === 1 && NAME_POSITION_HEADS.has(h)) || (h === "place" && idx === 4);
    if (!namePos && typeof it === "string" && NUMBER.test(it)) { out.push(Number(it)); return; }
    out.push(it);
  });
  return out;
}

/** "Canonical text" of a node: its JSON serialisation without whitespace. */
export function canon(x: Item): string {
  return JSON.stringify(x);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function children(node: Node, name: string): Node[] {
  return node.slice(1).filter((x): x is Node => Array.isArray(x) && head(x as Node) === name) as Node[];
}
function child(node: Node, name: string): Node | undefined {
  return children(node, name)[0];
}

/** F-S50 step 6: a path's point list with duplicates and collinear interior points removed. */
function simplifyPath(path: Node): Node {
  const fixed = path.slice(0, 3); // path LAYER WIDTH
  const nums = path.slice(3).filter((x): x is number => typeof x === "number");
  const rest = path.slice(3).filter((x) => typeof x !== "number");
  let pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const p: [number, number] = [nums[i]!, nums[i + 1]!];
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  let changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    const next: Array<[number, number]> = [pts[0]!];
    for (let i = 1; i + 1 < pts.length; i++) {
      const a = next[next.length - 1]!, b = pts[i]!, c = pts[i + 1]!;
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const inBox = Math.min(a[0], c[0]) <= b[0] && b[0] <= Math.max(a[0], c[0]) && Math.min(a[1], c[1]) <= b[1] && b[1] <= Math.max(a[1], c[1]);
      if (cross === 0 && inBox) { changed = true; continue; }
      next.push(b);
    }
    next.push(pts[pts.length - 1]!);
    pts = next;
  }
  return [...fixed, ...pts.flat(), ...rest] as Node;
}

/** F-S50 step 7: a polygon ring in canonical orientation and rotation. */
function canonPolygon(poly: Node): Node {
  const fixed = poly.slice(0, 3); // polygon LAYER APERTURE
  const nums = poly.slice(3).filter((x): x is number => typeof x === "number");
  const rest = poly.slice(3).filter((x) => typeof x !== "number");
  let pts: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const p: [number, number] = [nums[i]!, nums[i + 1]!];
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  if (pts.length > 1 && pts[0]![0] === pts[pts.length - 1]![0] && pts[0]![1] === pts[pts.length - 1]![1]) pts.pop();
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    area2 += a[0] * b[1] - b[0] * a[1];
  }
  if (area2 < 0) pts.reverse();
  let k = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!, q = pts[k]!;
    if (p[0] < q[0] || (p[0] === q[0] && p[1] < q[1])) k = i;
  }
  pts = pts.slice(k).concat(pts.slice(0, k));
  return [...fixed, ...pts.flat(), ...rest] as Node;
}

/** Apply path / polygon / circle canonicalisation recursively. */
function canonGeometry(node: Node): Node {
  const h = head(node);
  let n: Node = node.map((x) => (Array.isArray(x) ? canonGeometry(x as Node) : x)) as Node;
  if (h === "path") n = simplifyPath(n);
  else if (h === "polygon") n = canonPolygon(n);
  else if (h === "circle" && n.length === 3) n = [...n, 0, 0] as Node;
  return n;
}

function sortBy<T>(xs: T[], key: (x: T) => string): T[] {
  return xs.map((x, i) => ({ x, i, k: key(x) })).sort((a, b) => cmp(a.k, b.k) || a.i - b.i).map((e) => e.x);
}

/** F-S50: the canonical tree of a session text. */
export function normaliseSession(text: string): Node | null {
  const roots = toTree(lex(text)).map(typeItems);
  const session = roots.find((r) => head(r) === "session");
  if (!session) return null;
  const sessionName = session[1] ?? "";
  const baseDesign = child(session, "base_design");
  const placement = child(session, "placement");
  const routes = child(session, "routes");

  // placement
  const placementOut: Node = ["placement"];
  if (placement) {
    const res = child(placement, "resolution");
    if (res) placementOut.push(res);
    const byImage = new Map<string, Node[]>();
    for (const comp of children(placement, "component")) {
      const image = String(comp[1] ?? "");
      const list = byImage.get(image) ?? [];
      list.push(...children(comp, "place"));
      byImage.set(image, list);
    }
    for (const image of [...byImage.keys()].sort(cmp)) {
      const places = sortBy(byImage.get(image)!, (p) => `${String(p[1] ?? "")} ${canon(p)}`);
      placementOut.push(["component", image, ...places]);
    }
  }

  // routes
  const routesOut: Node = ["routes"];
  if (routes) {
    const res = child(routes, "resolution");
    if (res) routesOut.push(res);
    const parser = child(routes, "parser");
    if (parser) {
      const heads = parser.slice(1).filter((x): x is Node => Array.isArray(x)).map((x) => head(x as Node));
      routesOut.push(["parser", ...heads.sort(cmp)]);
    }
    const lib = child(routes, "library_out");
    if (lib) {
      const padstacks = sortBy(children(lib, "padstack"), (p) => String(p[1] ?? "")).map((p) => {
        const shapes = sortBy(children(p, "shape").map(canonGeometry), (s) => {
          const inner = (s[1] as Node | undefined) ?? [];
          return `${String((inner as Node)[1] ?? "")} ${canon(s)}`;
        });
        const others = sortBy(p.slice(2).filter((x): x is Node => Array.isArray(x) && head(x as Node) !== "shape"), canon);
        return ["padstack", p[1] ?? "", ...shapes, ...others] as Node;
      });
      routesOut.push(["library_out", ...padstacks]);
    }
    const net = child(routes, "network_out");
    if (net) {
      const nets = sortBy(children(net, "net"), (n) => String(n[1] ?? "")).map((n) => {
        const entries = sortBy(n.slice(2).filter((x): x is Node => Array.isArray(x)).map(canonGeometry), canon);
        return ["net", n[1] ?? "", ...entries] as Node;
      });
      routesOut.push(["network_out", ...nets]);
    }
  }

  return ["session", sessionName, ["base_design", baseDesign?.[1] ?? ""], placementOut, ["was_is"], routesOut] as Node;
}
