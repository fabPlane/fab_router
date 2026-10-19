import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { normaliseSes } from "../src/ses/index.ts";
import { readDsn, writeSes } from "../src/api.ts";

function board(x = 70405.952, y = -26615, unit = "um") {
  const r = readDsn(`(pcb precision (resolution um 10) (unit ${unit})
    (structure (layer F.Cu (type signal)) (layer B.Cu (type signal))
      (boundary (rect pcb 0 -200000 200000 0)))
    (placement (component one (place U1 ${x} ${y} front 0)))
    (library (image one (pin pad 1 0 0))
      (padstack pad (shape (circle F.Cu 1000))))
    (network (net N (pins U1-1))))`, { name: "precision.dsn" });
  if (!r.ok) throw new Error("fixture read failed");
  return r.layout;
}

test("session preserves source placement finer than the routing lattice", () => {
  const layout = board();
  const text = writeSes(layout);
  expect(text).toContain("(placement\n    (resolution um 1000)");
  expect(text).toContain("(place U1 70405952 -26615000 front 0)");
  expect(text).toContain("(routes\n    (resolution um 10)");
});

test("source placement preserves both off-lattice axes", () => {
  expect(writeSes(board(168657.392, -44931.946))).toContain("(place U1 168657392 -44931946 front 0)");
});

test("on-lattice placement keeps the existing session resolution", () => {
  expect(writeSes(board(70406))).toContain("(place U1 704060 -266150 front 0)");
});

test("explicitly moved parts use their current lattice placement", () => {
  const layout = board();
  layout.parts[0]!.at.x += 10;
  expect(writeSes(layout)).toContain("(place U1 704070 -266150 front 0)");
});

test("source placement respects a distinct coordinate unit", () => {
  const text = writeSes(board(70.405952, -26.615, "mm"));
  expect(text).toContain("(place U1 70405952 -26615000 front 0)");
});

test("fine placement resolution also scales newly added parts", () => {
  const layout = board();
  const extended = { ...layout, parts: [...layout.parts, { ...layout.parts[0]!, id: 1, ref: "U2", at: { x: 100, y: -200 } }] };
  Object.defineProperty(extended, "document", { value: (layout as unknown as { document: unknown }).document });
  expect(writeSes(extended)).toContain("(place U2 10000 -20000 front 0)");
});

// This checks authored coordinates directly rather than relying on regenerated snapshots.

test("every corpus session preserves authored placement to native nanometres", () => {
  const root = `${import.meta.dir}/../spec/acceptance/boards`;
  const nm = { inch: 25400000, mil: 25400, cm: 10000000, mm: 1000000, um: 1000 };
  for (const file of readdirSync(root).filter(name => name.endsWith(".dsn"))) {
    const r = readDsn(readFileSync(`${root}/${file}`, "utf8"), { name: file });
    if (!r.ok) continue;
    const tree = normaliseSes(writeSes(r.layout)) as unknown as unknown[][];
    const placement = tree.find(scope => scope[0] === "placement")!;
    const resolution = placement[1] as [string, keyof typeof nm, number];
    const scale = nm[resolution[1]] / resolution[2];
    const sourceScale = nm[r.document.unit.unit];
    const sources = new Map(r.document.placement.components.flatMap(c => c.places.map(p => [p.ref, p] as const)));
    for (const component of placement.slice(2) as unknown[][]) {
      for (const place of component.slice(2) as [string, string, number, number][]) {
        const source = sources.get(place[1])!;
        expect(Math.round(place[2] * scale), `${file} ${place[1]} x`).toBe(Math.round(source.x! * sourceScale));
        expect(Math.round(place[3] * scale), `${file} ${place[1]} y`).toBe(Math.round(source.y! * sourceScale));
      }
    }
  }
});
