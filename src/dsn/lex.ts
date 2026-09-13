/**
 * DSN lexer — the lexical rules of spec/formats/dsn.md §1 (F-1 … F-14), written from the
 * SPECCTRA Design Language Reference (Cadence, "Syntax Conventions") and the lexeme vectors in
 * spec/behaviour/dsn-tokens. A lexeme is `open`, `close`, `ident`, `number` or `string`; a string
 * keeps the quote character it was written with (so pin references can be re-assembled, F-101),
 * every lexeme keeps its exact source text, its line/column, and whether it was glued to the
 * previous lexeme (F-9).
 *
 * Exactly one quote character is in effect at any point (F-4, ruling Q-I1-29): `"` unless the
 * caller says otherwise, switching to the character declared by `(string_quote c)` from that
 * declaration onward (F-11, F-30). Every other quote-like character is ordinary everywhere.
 *
 * Public surface: Lexeme, LexemeKind, LexOptions, lex, decodeDsnBytes, parseNumberText,
 * isNumberText.
 */

export type LexemeKind = "open" | "close" | "ident" | "number" | "string";

export interface Lexeme {
  kind: LexemeKind;
  /** Source text; for a string the text between the quotes. */
  text: string;
  line: number;
  column: number;
  /** True when no separator lies between this lexeme and the previous one (neither a paren). */
  glued: boolean;
  /** For `number`: the numeric value (F-6). */
  value?: number;
  /** For `string`: the quote character used. */
  quote?: string;
}

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** F-6: does this text spell a number? */
export function isNumberText(text: string): boolean {
  return NUMBER_RE.test(text);
}

/** F-6 / F-8: the value of a number-shaped text, or undefined. `-0` reads as 0. */
export function parseNumberText(text: string): number | undefined {
  if (!NUMBER_RE.test(text)) return undefined;
  const v = Number(text);
  if (!Number.isFinite(v)) return undefined;
  return v === 0 ? 0 : v;
}

/**
 * F-1: decode bytes as UTF-8, dropping a byte-order mark; byte sequences that are not valid
 * UTF-8 are decoded as Windows-1252 (one character per byte). Never fails.
 */
export function decodeDsnBytes(bytes: Uint8Array): string {
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  const body = start ? bytes.subarray(start) : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return decodeMixed(body);
  }
}

/** Decode valid UTF-8 runs as UTF-8 and every other byte as Windows-1252. */
function decodeMixed(b: Uint8Array): string {
  const strict = new TextDecoder("utf-8", { fatal: true });
  let out = "";
  let i = 0;
  const n = b.length;
  while (i < n) {
    const c = b[i]!;
    if (c < 0x80) { out += String.fromCharCode(c); i++; continue; }
    let len = 0;
    if (c >= 0xc2 && c <= 0xdf) len = 2;
    else if (c >= 0xe0 && c <= 0xef) len = 3;
    else if (c >= 0xf0 && c <= 0xf4) len = 4;
    if (len && i + len <= n) {
      try {
        out += strict.decode(b.subarray(i, i + len));
        i += len;
        continue;
      } catch { /* fall through to single-byte decoding */ }
    }
    out += CP1252[c - 0x80] ?? String.fromCharCode(c);
    i++;
  }
  return out;
}

// Windows-1252 upper half (0x80–0x9F map to typographic characters, the rest is Latin-1).
const CP1252: string[] = (() => {
  const t: string[] = [];
  const high = [0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
    0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178];
  for (let i = 0; i < 32; i++) t.push(String.fromCharCode(high[i]!));
  for (let i = 0xa0; i < 0x100; i++) t.push(String.fromCharCode(i));
  return t;
})();

export interface LexOptions {
  /** The quote character in effect at the start of the text (F-4). Default `"`. */
  stringQuote?: string;
}

/**
 * F-2 … F-11: split `text` into lexemes. Never throws. A leading BOM is dropped (F-1). The
 * `string_quote` exception (F-11) is applied by looking at the previous two lexemes; the
 * declared character becomes the quote character from there on (F-4, F-30).
 */
export function lex(text: string, options: LexOptions = {}): Lexeme[] {
  const out: Lexeme[] = [];
  const n = text.length;
  let i = 0;
  let quoteCode = options.stringQuote !== undefined && options.stringQuote.length === 1 ? options.stringQuote.charCodeAt(0) : 0x22;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) i = 1;
  let line = 1;
  let lineStart = i;
  let sawSeparator = true; // start of input counts as separated
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c <= 0x20) {
      if (c === 0x0a) { line++; lineStart = i + 1; }
      sawSeparator = true;
      i++;
      continue;
    }
    const column = i - lineStart + 1;
    if (c === 0x28) { out.push({ kind: "open", text: "(", line, column, glued: false }); sawSeparator = true; i++; continue; }
    if (c === 0x29) { out.push({ kind: "close", text: ")", line, column, glued: false }); sawSeparator = true; i++; continue; }
    const glued = !sawSeparator && out.length > 0 && out[out.length - 1]!.kind !== "open" && out[out.length - 1]!.kind !== "close";
    sawSeparator = false;
    const declaring = afterStringQuoteHead(out);
    if (c === quoteCode && !declaring) {
      // F-4: quoted string to the next occurrence of the quote character, no escapes.
      const q = text[i]!;
      let j = i + 1;
      const startLine = line;
      while (j < n && text.charCodeAt(j) !== c) {
        if (text.charCodeAt(j) === 0x0a) { line++; lineStart = j + 1; }
        j++;
      }
      const body = text.slice(i + 1, j);
      out.push({ kind: "string", text: body, line: startLine, column, glued, quote: q });
      i = j < n ? j + 1 : n;
      continue;
    }
    // F-5: bare lexeme up to the next separator or parenthesis.
    let j = i + 1;
    while (j < n) {
      const d = text.charCodeAt(j);
      if (d <= 0x20 || d === 0x28 || d === 0x29) break;
      j++;
    }
    const t = text.slice(i, j);
    const v = parseNumberText(t);
    if (v !== undefined) out.push({ kind: "number", text: t, line, column, glued, value: v });
    else out.push({ kind: "ident", text: t, line, column, glued });
    // F-11 / F-30: a one-character declaration switches the quote character from here on.
    if (declaring && t.length === 1) quoteCode = t.charCodeAt(0);
    i = j;
  }
  return out;
}

/** F-11: true when the previous lexemes are `(` `string_quote`. */
function afterStringQuoteHead(out: Lexeme[]): boolean {
  const k = out.length;
  if (k < 2) return false;
  const head = out[k - 1]!;
  const open = out[k - 2]!;
  return open.kind === "open" && head.kind === "ident" && head.text.toLowerCase() === "string_quote";
}
