import { expect, test } from "bun:test";
import { applySes, readDsn } from "../src/api.ts";

// One millimetre is 1,000,000 file ticks but only 100,000 internal LU.
const DSN = `(pcb units
  (resolution mm 1000000) (unit mm)
  (structure (layer F.Cu (type signal))
    (boundary (rect pcb 0 0 20 20))
    (rule (width 0.2) (clearance 0.2)))
  (network (net N)))`;
const wire = `(network_out (net N (wire (path F.Cu 200000 1000000 1000000 2000000 1000000))))`;
const session = `(session units (routes ${wire}))`;
function layout() {
  const r = readDsn(DSN);
  if (!r.ok) throw new Error("fixture did not parse");
  return r.layout;
}
function expectMillimetreTrack(L: ReturnType<typeof layout>) {
  expect(L.tracks).toHaveLength(1);
  expect(L.tracks[0]).toMatchObject({
    width: 200 * L.frame.luPerUm,
    pts: [{ x: 1000 * L.frame.luPerUm, y: 1000 * L.frame.luPerUm },
      { x: 2000 * L.frame.luPerUm, y: 1000 * L.frame.luPerUm }],
  });
}

test("resolution-less session uses file metadata on a copied layout", () => {
  const L = { ...layout() }; // hidden document is deliberately not copied
  expect(Object.hasOwn(L, "document")).toBe(false);
  expect(applySes(L, session).ok).toBe(true);
  expectMillimetreTrack(L);
});

test("public file resolution takes precedence over the attached document", () => {
  const L = layout();
  // Change file facts to um/100: the same tick count now describes ten times the distance.
  const changed = { ...L, file: { ...L.file!, unit: "um", perUnit: 100 } };
  Object.defineProperty(changed, "document", { value: (L as unknown as { document: unknown }).document });
  expect(applySes(changed, session).ok).toBe(true);
  expect(changed.tracks[0]!.pts[0]).toEqual({ x: 10000 * L.frame.luPerUm, y: 10000 * L.frame.luPerUm });
});

test("legacy layout without file facts still uses its attached document", () => {
  const L = layout();
  delete (L as { file?: unknown }).file;
  expect(applySes(L, session).ok).toBe(true);
  expectMillimetreTrack(L);
});

test("explicit session resolution overrides file facts", () => {
  const L = { ...layout() };
  expect(applySes(L, `(session units (routes (resolution um 1000) ${wire}))`).ok).toBe(true);
  expectMillimetreTrack(L);
});
