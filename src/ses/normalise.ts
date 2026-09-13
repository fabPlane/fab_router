/**
 * The canonical session tree of spec/formats/ses.md F-S50 — what the `ses-roundtrip` acceptance
 * case compares. The text is lexed and folded with the DSN rules (src/dsn), quotes stripped;
 * non-scope items become numbers unless they stand in a name position; `placement` merges
 * components by image and sorts; `parser` reduces to its sorted entry heads; `library_out`
 * padstacks are sorted by name with shapes sorted by layer then canonical text and a 3-item
 * circle expanded to `(circle L D 0 0)`; `network_out` nets are sorted by name with their
 * entries sorted by canonical text; every `path` loses duplicate and collinear interior points;
 * every `polygon` loses a repeated closing vertex, is turned counter-clockwise and rotated to its
 * lexicographically smallest vertex. "Canonical text" is the JSON of a node without whitespace.
 *
 * Public surface: SesTree, normaliseSes, canonicalText.
 */
import { lex } from "../dsn/lex.ts";
import { buildTree, isNode, type Item, type Node } from "../dsn/tree.ts";
import type { Diagnostic } from "../../spec/types/layout.ts";

export type SesTree = Array<string | number | SesTree>;

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const NAME_HEADS = new Set(["session", "base_design", "component", "place", "padstack", "net", "via", "path", "polygon", "circle", "rect", "resolution", "host_cad", "host_version", "type", "attach", "layer", "clearance_class", "pins"]);

export function canonicalText(x: string | number | SesTree): string {
  return JSON.stringify(x);
}

/** Step 2: a scope as a tree with typed items. */
function typed(node: Node): SesTree {
  const head = node.head ?? node.headText.toLowerCase();
  const out: SesTree = [head];
  node.items.forEach((it: Item, i) => {
    if (isNode(it)) { out.push(typed(it)); return; }
    const idx = i + 1;
    const namePos = (idx === 1 && NAME_HEADS.has(head)) || (head === "place" && idx === 4);
    if (!namePos && NUMBER.test(it.text)) { out.push(Number(it.text)); return; }
    out.push(it.text);
  });
  return out;
}

const headOf = (t: SesTree): string => (typeof t[0] === "string" ? t[0] : "");
const children = (t: SesTree, head: string): SesTree[] => t.slice(1).filter((x): x is SesTree => Array.isArray(x) && headOf(x) === head);
const child = (t: SesTree, head: string): SesTree | undefined => children(t, head)[0];
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
function sortBy<T>(xs: T[], key: (x: T) => string): T[] {
  return xs.map((x, i) => ({ x, i, k: key(x) })).sort((a, b) => cmp(a.k, b.k) || a.i - b.i).map((e) => e.x);
}

type Pair = [number, number];
function pointsOf(items: Array<string | number | SesTree>): { pts: Pair[]; rest: Array<string | number | SesTree> } {
  const nums = items.filter((x): x is number => typeof x === "number");
  const rest = items.filter((x) => typeof x !== "number");
  const pts: Pair[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const p: Pair = [nums[i]!, nums[i + 1]!];
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  return { pts, rest };
}

/** Step 6: `path` with duplicates and exactly collinear interior points removed. */
function canonPath(t: SesTree): SesTree {
  const fixed = t.slice(0, 3);
  let { pts, rest } = pointsOf(t.slice(3));
  let changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    const next: Pair[] = [pts[0]!];
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
  return [...fixed, ...pts.flat(), ...rest];
}

/** Step 7: `polygon` without its closing vertex, counter-clockwise, starting at the smallest vertex. */
function canonPolygon(t: SesTree): SesTree {
  const fixed = t.slice(0, 3);
  let { pts, rest } = pointsOf(t.slice(3));
  if (pts.length > 1 && pts[0]![0] === pts[pts.length - 1]![0] && pts[0]![1] === pts[pts.length - 1]![1]) pts.pop();
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; area2 += a[0] * b[1] - b[0] * a[1]; }
  if (area2 < 0) pts.reverse();
  let k = 0;
  for (let i = 1; i < pts.length; i++) { const p = pts[i]!, q = pts[k]!; if (p[0] < q[0] || (p[0] === q[0] && p[1] < q[1])) k = i; }
  pts = pts.slice(k).concat(pts.slice(0, k));
  return [...fixed, ...pts.flat(), ...rest];
}

function canonGeometry(t: SesTree): SesTree {
  const h = headOf(t);
  let n: SesTree = t.map((x) => (Array.isArray(x) ? canonGeometry(x) : x));
  if (h === "path") n = canonPath(n);
  else if (h === "polygon") n = canonPolygon(n);
  else if (h === "circle" && n.length === 3) n = [...n, 0, 0];
  return n;
}

/** F-S50: the canonical tree of a session text, or null when it has no `session` scope. */
export function normaliseSes(text: string): SesTree | null {
  const diags: Diagnostic[] = [];
  const roots = buildTree(lex(text), diags).map(typed);
  const session = roots.find((r) => headOf(r) === "session");
  if (!session) return null;
  const baseDesign = child(session, "base_design");
  const placement = child(session, "placement");
  const routes = child(session, "routes");

  const placementOut: SesTree = ["placement"];
  if (placement) {
    const res = child(placement, "resolution");
    if (res) placementOut.push(res);
    const byImage = new Map<string, SesTree[]>();
    for (const comp of children(placement, "component")) {
      const image = String(comp[1] ?? "");
      const list = byImage.get(image) ?? [];
      list.push(...children(comp, "place"));
      byImage.set(image, list);
    }
    for (const image of [...byImage.keys()].sort(cmp)) {
      const places = sortBy(byImage.get(image)!, (p) => `${String(p[1] ?? "")} ${canonicalText(p)}`);
      placementOut.push(["component", image, ...places]);
    }
  }

  const routesOut: SesTree = ["routes"];
  if (routes) {
    const res = child(routes, "resolution");
    if (res) routesOut.push(res);
    const parser = child(routes, "parser");
    if (parser) routesOut.push(["parser", ...parser.slice(1).filter((x): x is SesTree => Array.isArray(x)).map(headOf).sort(cmp)]);
    const lib = child(routes, "library_out");
    if (lib) {
      const padstacks = sortBy(children(lib, "padstack"), (p) => String(p[1] ?? "")).map((p) => {
        const shapes = sortBy(children(p, "shape").map(canonGeometry), (s) => {
          const inner = Array.isArray(s[1]) ? s[1] : [];
          return `${String(inner[1] ?? "")} ${canonicalText(s)}`;
        });
        const others = sortBy(p.slice(2).filter((x): x is SesTree => Array.isArray(x) && headOf(x) !== "shape"), canonicalText);
        return ["padstack", p[1] ?? "", ...shapes, ...others] as SesTree;
      });
      routesOut.push(["library_out", ...padstacks]);
    }
    const net = child(routes, "network_out");
    if (net) {
      const nets = sortBy(children(net, "net"), (n) => String(n[1] ?? "")).map((n) => {
        const entries = sortBy(n.slice(2).filter((x): x is SesTree => Array.isArray(x)).map(canonGeometry), canonicalText);
        return ["net", n[1] ?? "", ...entries] as SesTree;
      });
      routesOut.push(["network_out", ...nets]);
    }
  }
  return ["session", session[1] ?? "", ["base_design", baseDesign?.[1] ?? ""], placementOut, ["was_is"], routesOut];
}
