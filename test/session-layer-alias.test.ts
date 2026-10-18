import { expect, test } from "bun:test";
import { applySes, readDsn } from "../src/api.ts";

function layout(names: string[]) {
  const result = readDsn(`(pcb aliases (resolution um 10) (unit um)
    (structure ${names.map(name => `(layer ${name} (type signal))`).join(" ")}
      (boundary (rect pcb 0 0 10000 10000))
      (rule (width 200) (clearance 200)))
    (network (net N)))`);
  if (!result.ok) throw new Error("fixture did not parse");
  return result.layout;
}
function session(...layers: string[]) {
  return `(session aliases (routes (network_out (net N
    ${layers.map((name, i) => `(wire (path ${name} 2000 10000 ${10000 + i * 3000} 20000 ${10000 + i * 3000}))`).join(" ")}))))`;
}

test("Top and Bottom aliases survive differently cased actual layer names", () => {
  const L = layout(["top", "inner", "bottom"]);
  const result = applySes(L, session("Top", "Bottom", "Top", "Bottom"));
  expect(result.applied.tracks).toBe(4);
  expect(L.tracks.map(t => t.sheet)).toEqual([L.stack[0]!.id, L.stack[2]!.id, L.stack[0]!.id, L.stack[2]!.id]);
  expect(result.diagnostics.map(d => d.code)).toEqual(["layer-aliased", "layer-aliased"]);
});

test("exact Top and Bottom names take precedence over outer-layer aliases", () => {
  const L = layout(["F.Cu", "Top", "Bottom", "B.Cu"]);
  const result = applySes(L, session("Top", "Bottom"));
  expect(result.applied.tracks).toBe(2);
  expect(L.tracks.map(t => t.sheet)).toEqual([L.stack[1]!.id, L.stack[2]!.id]);
  expect(result.diagnostics).toEqual([]);
});

test("actual layer names stay case-sensitive outside the two explicit aliases", () => {
  const L = layout(["top", "Inner", "bottom"]);
  const result = applySes(L, session("top", "bottom", "inner", "TOP"));
  expect(result.applied.tracks).toBe(2);
  expect(L.tracks.map(t => t.sheet)).toEqual([L.stack[0]!.id, L.stack[2]!.id]);
  expect(result.diagnostics.map(d => d.code)).toEqual(["layer-unknown", "layer-unknown"]);
});
