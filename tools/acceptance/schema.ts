/**
 * A small JSON-Schema (draft 2020-12 subset) validator with no dependencies: enough for
 * spec/acceptance/schema/*.json — `type`, `required`, `properties`, `additionalProperties`
 * (boolean or schema), `enum`, `pattern`, `minimum`, `items`, `$ref` to `#/$defs/...`, and the
 * empty schema `{}` (anything). Unknown keywords are ignored.
 *
 * Public surface: validate(schema, value) → string[] of "path: message" problems (empty = valid).
 */

export type JsonSchema = Record<string, unknown>;

export function validate(schema: JsonSchema, value: unknown): string[] {
  const problems: string[] = [];
  walk(schema, schema, value, "$", problems);
  return problems;
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function resolveRef(root: JsonSchema, ref: string): JsonSchema {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref ${ref}`);
  let cur: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    if (typeof cur !== "object" || cur === null) throw new Error(`bad $ref ${ref}`);
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur as JsonSchema;
}

function walk(root: JsonSchema, schema: JsonSchema | boolean, value: unknown, path: string, out: string[]): void {
  if (schema === true) return;
  if (schema === false) { out.push(`${path}: not allowed`); return; }
  if (typeof schema.$ref === "string") { walk(root, resolveRef(root, schema.$ref), value, path, out); return; }

  const t = schema.type;
  if (t !== undefined) {
    const types = Array.isArray(t) ? (t as string[]) : [t as string];
    const actual = typeOf(value);
    const ok = types.some((x) => x === actual || (x === "integer" && actual === "number" && Number.isInteger(value)) || (x === "number" && actual === "number"));
    if (!ok) { out.push(`${path}: expected ${types.join("|")}, got ${actual}`); return; }
  }
  if (Array.isArray(schema.enum)) {
    if (!(schema.enum as unknown[]).some((e) => deepEqual(e, value))) out.push(`${path}: not one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === "string" && typeof schema.pattern === "string") {
    if (!new RegExp(schema.pattern).test(value)) out.push(`${path}: does not match ${schema.pattern}`);
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) out.push(`${path}: below minimum ${schema.minimum}`);
    if (typeof schema.maximum === "number" && value > schema.maximum) out.push(`${path}: above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value) && schema.items !== undefined) {
    value.forEach((item, i) => walk(root, schema.items as JsonSchema | boolean, item, `${path}[${i}]`, out));
  }
  if (typeOf(value) === "object") {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, JsonSchema | boolean>;
    for (const req of (schema.required ?? []) as string[]) {
      if (!(req in obj)) out.push(`${path}: missing required '${req}'`);
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k in props) { walk(root, props[k]!, v, `${path}.${k}`, out); continue; }
      const ap = schema.additionalProperties;
      if (ap === false) out.push(`${path}: unexpected property '${k}'`);
      else if (typeof ap === "object" && ap !== null) walk(root, ap as JsonSchema, v, `${path}.${k}`, out);
    }
  }
}

/** Structural equality of JSON values (object key order ignored). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeOf(a) !== typeOf(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeOf(a) === "object") {
    const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>;
    const ak = Object.keys(ao).sort(), bk = Object.keys(bo).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) if (ak[i] !== bk[i]) return false;
    for (const k of ak) if (!deepEqual(ao[k], bo[k])) return false;
    return true;
  }
  return false;
}

/** First path at which two JSON values differ, or null when equal. */
export function firstDifference(a: unknown, b: unknown, path = "$"): string | null {
  if (a === b) return null;
  if (typeOf(a) !== typeOf(b)) return `${path}: ${typeOf(a)} vs ${typeOf(b)}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { const d = firstDifference(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    return null;
  }
  if (typeOf(a) === "object") {
    const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>;
    for (const k of Object.keys(ao)) {
      if (!(k in bo)) return `${path}.${k}: present vs missing`;
      const d = firstDifference(ao[k], bo[k], `${path}.${k}`); if (d) return d;
    }
    for (const k of Object.keys(bo)) if (!(k in ao)) return `${path}.${k}: missing vs present`;
    return null;
  }
  return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}
