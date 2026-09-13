/**
 * F-ROUNDTRIP (spec/formats/dsn.md §14): for every corpus board that reads with status `ok` or
 * `outline-missing`, `readDsn(writeDsn(readDsn(t).document)).document` deep-equals
 * `readDsn(t).document`. Also checks that the writer's quoting keeps names spelled like numbers,
 * empty names and names holding the other quote character intact.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readDsn, writeDsn } from "../src/api.ts";
import { firstDifference } from "../tools/acceptance/schema.ts";

const BOARDS = resolve(import.meta.dir, "..", "spec", "acceptance", "boards");

describe("DSN round trip over the corpus", () => {
  const files = readdirSync(BOARDS).filter((f) => f.endsWith(".dsn")).sort();
  expect(files.length).toBeGreaterThan(100);
  for (const f of files) {
    test(f, () => {
      const text = readFileSync(join(BOARDS, f), "utf8");
      const first = readDsn(text, { name: f });
      if (!first.ok) {
        expect(f).toBe("Issue006-LPC18XX_43XX_SCH.dsn");
        return;
      }
      const written = writeDsn(first.document);
      expect(written.length).toBeGreaterThan(10);
      const second = readDsn(written, { name: f });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      const diff = firstDifference(second.document, first.document);
      expect(diff).toBeNull();
      // The Layout built from the re-read document has the same item counts.
      expect(second.layout.pads.length).toBe(first.layout.pads.length);
      expect(second.layout.tracks.length).toBe(first.layout.tracks.length);
      expect(second.layout.barrels.length).toBe(first.layout.barrels.length);
      expect(second.layout.nets.length).toBe(first.layout.nets.length);
      expect(second.layout.spacing.kinds).toEqual(first.layout.spacing.kinds);
    });
  }
});

describe("DSN writer quoting", () => {
  test("names that would lex as numbers, empty names and quote characters survive", () => {
    const text = `(pcb "" (parser (string_quote ") (space_in_quoted_tokens on) (host_cad "KiCad's Pcbnew"))
      (resolution um 10) (unit um)
      (structure (layer 1 (type signal)) (layer "16#Bottom" (type signal)) (boundary (rect pcb 0 0 10 10)))
      (placement (component "Реле:SRD" (place K1 100 -100 front 0 (PN 09561617712)) (place "J1 + - ( )" 1 2 back 90 (PN "2x20 pin 0.1'' header"))))
      (library (image "Реле:SRD" (pin p0e29 0e29 1 2) (pin p1 A' 3 4)) (padstack p0e29 (shape (circle 1 2))) (padstack p1 (shape (rect 1 -1 -1 1 1))))
      (network (net " 1" (pins K1-0e29 "J1 + - ( )"-A' B1--)) (net 100 1 (pins)) (class '' (rule (width 15.75) (clearance 0.8 (type "default"-"1A EXTERNAL 1oz")))))
    )`;
    const first = readDsn(text);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const doc = first.document;
    expect(doc.name).toBe("");
    expect(doc.placement.components[0]!.places[0]!.partNumber).toBe("09561617712");
    expect(doc.library.images[0]!.pins[0]!.name).toBe("0e29");
    expect(doc.network.nets[0]!.pins).toEqual([{ component: "K1", pin: "0e29" }, { component: "J1 + - ( )", pin: "A'" }, { component: "B1", pin: "-" }]);
    expect(doc.network.classes[0]!.name).toBe("");
    expect(doc.network.classes[0]!.rules[1]).toEqual({ kind: "clearance", value: 0.8, type: "\"default\"-\"1A EXTERNAL 1oz\"" });
    const again = readDsn(writeDsn(doc));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(firstDifference(again.document, doc)).toBeNull();
  });
});
