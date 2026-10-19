/** Conservative comparison of embedded board rules. Separate from the permissive DSN
 * reader: native board strings have backslash escapes and malformed input must fail. */
type Expression = string | Expression[];

function parseBoard(text: string): Expression[] {
  let offset = 0;
  const whitespace = () => { while (offset < text.length && /\s/.test(text[offset]!)) offset++; };
  function expression(depth: number): Expression {
    if (depth > 256) throw new Error("Native board nesting limit exceeded");
    whitespace();
    if (text[offset] === "(") {
      offset++;
      const values: Expression[] = [];
      while (true) {
        whitespace();
        if (offset >= text.length) throw new Error("Unclosed native board expression");
        if (text[offset] === ")") { offset++; return values; }
        values.push(expression(depth + 1));
      }
    }
    const start = offset;
    if (text[offset] === '"') {
      offset++;
      while (offset < text.length) {
        const char = text[offset++];
        if (char === "\\") { offset++; continue; }
        if (char === '"') {
          if (offset < text.length && !/[\s()]/.test(text[offset]!)) throw new Error("Missing native board string separator");
          return text.slice(start, offset);
        }
      }
      throw new Error("Unclosed native board string");
    }
    while (offset < text.length && !/[\s()"]/.test(text[offset]!)) offset++;
    if (start === offset) throw new Error("Malformed native board token");
    const token = text.slice(start, offset);
    // Ignore numeric formatting, but never reinterpret quoted strings as numbers.
    return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(token) && Number.isFinite(Number(token)) ? String(Number(token)) : token;
  }
  const board = expression(0);
  whitespace();
  if (offset !== text.length || !Array.isArray(board) || board[0] !== "kicad_pcb") throw new Error("Expected exactly one native board expression");
  return board;
}

export function embeddedBoardRules(text: string): string {
  const board = parseBoard(text);
  return JSON.stringify(["layers", "setup"].map(head => {
    const matches = board.filter(node => Array.isArray(node) && node[0] === head);
    if (matches.length !== 1) throw new Error(`Expected exactly one native board ${head}`);
    const section = matches[0] as Expression[];
    // Native save supplies default display aliases for user layers. These are
    // presentation metadata; retain IDs, canonical names, types and table order.
    return head === "layers" ? [head, ...section.slice(1).map(layer => {
      if (!Array.isArray(layer) || layer.length < 3 || layer.length > 4 || layer.some(value => typeof value !== "string")) throw new Error("Malformed native layer definition");
      return layer.slice(0, 3);
    })] : section;
  }));
}

export function assertEmbeddedBoardRules(input: string, candidate: string): void {
  if (embeddedBoardRules(input) !== embeddedBoardRules(candidate)) throw new Error("Candidate embedded board rules differ from input");
}

/** Preserve the multiset of original board-level tracks and vias. Additional routes
 * are permitted. This deliberately does not certify pads, zones or other metadata. */
export function assertSourceCopper(input: string, candidate: string): void {
  const inventory = (text: string) => {
    const counts = new Map<string, number>();
    for (const node of parseBoard(text)) {
      if (!Array.isArray(node) || !["segment", "arc", "via"].includes(String(node[0]))) continue;
      // Named fields may be reordered by a native save; keep each field's internal
      // order (notably via layer span and arc geometry) intact.
      const fields = node.slice(1).filter(field => !(Array.isArray(field) && field[0] === "uuid"));
      const key = JSON.stringify([node[0], ...fields.map(field => {
        // Tracks and arcs are physically undirected; native save may reverse them.
        if (Array.isArray(field) && ["segment", "arc"].includes(String(node[0])) && ["start", "end"].includes(String(field[0]))) return JSON.stringify(["endpoint", ...field.slice(1)]);
        return JSON.stringify(field);
      }).sort()]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };
  const available = inventory(candidate);
  for (const [key, count] of inventory(input)) {
    if ((available.get(key) ?? 0) < count) throw new Error("Candidate source copper differs from input");
  }
}
