import { expect, test } from "bun:test";
import { applySes, readDsn, writeSes } from "../src/api.ts";

import { SESSION_QUOTE_DSN as DSN } from "./helpers/session-quotes.ts";

function layout() {
  const r = readDsn(DSN);
  if (!r.ok) throw new Error("fixture did not parse");
  expect(r.layout.tracks).toHaveLength(1);
  return r.layout;
}
function roundtrip(L: ReturnType<typeof layout>, text = writeSes(L)) {
  const before = L.tracks.map(({ net, sheet, pts, width }) => ({ net, sheet, pts, width }));
  const result = applySes(L, text);
  expect(result.ok).toBe(true);
  expect(result.diagnostics).toEqual([]);
  expect(result.applied).toEqual({ tracks: 1, barrels: 0 });
  expect(L.tracks.map(({ net, sheet, pts, width }) => ({ net, sheet, pts, width }))).toEqual(before);
}

test("session import uses the design quote for names with spaces and parentheses", () => roundtrip(layout()));

test("copied layout retains the public design quote", () => {
  const L = { ...layout() };
  expect(Object.hasOwn(L, "document")).toBe(false);
  roundtrip(L);
});

test("public quote overrides stale attached document facts", () => {
  const L = layout();
  const text = writeSes(L);
  const changed = { ...L, file: { ...L.file!, quote: '"' } };
  Object.defineProperty(changed, "document", { value: (L as unknown as { document: unknown }).document });
  roundtrip(changed, text.replaceAll("'", '"'));
});

test("legacy layout falls back to the attached design quote", () => {
  const L = layout();
  const text = writeSes(L);
  delete (L as { file?: unknown }).file;
  roundtrip(L, text);
});

test("session quote declaration overrides the inherited design quote", () => {
  const L = layout();
  const text = writeSes(L).replaceAll("'", '"').replace("(routes", '(routes (parser (string_quote "))');
  roundtrip(L, text);
});

test("ordinary double-quoted designs keep working", () => {
  const r = readDsn(DSN.replace("(string_quote ')", '(string_quote ")').replaceAll("'", '"'));
  if (!r.ok) throw new Error("fixture did not parse");
  roundtrip(r.layout);
});

test("quoted layer names resolve even when the net needs no quoting", () => {
  const r = readDsn(DSN.replaceAll("'signal (A)'", "N"));
  if (!r.ok) throw new Error("fixture did not parse");
  roundtrip(r.layout);
});
