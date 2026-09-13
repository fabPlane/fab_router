/**
 * Task I2b — the Layout fields the session writer reads and the item `origin` marks.
 *
 *   - Q-I2-47: the builder populates `Layout.file` (unit, perUnit, quote, hostCad, hostVersion)
 *     and `Part.locked` (from `(lock_type position)`);
 *   - Q-I2-54 / DR-12: image keepouts carry their owning Part in `Fence.part`;
 *   - Q-I2-60: file wiring is `origin: "file"`, applied session items `origin: "session"`, and
 *     `writeSes({ includeFileWiring: false })` writes only `origin: "router"` items.
 */
import { describe, expect, test } from "bun:test";
import { applySes, readDsn, writeSes } from "../src/api.ts";

const DSN = `(pcb "test-fields.dsn"
  (parser
    (string_quote ")
    (host_cad "AcmeCAD")
    (host_version "9.9")
  )
  (resolution um 10)
  (unit um)
  (structure
    (layer F.Cu (type signal))
    (layer B.Cu (type signal))
    (boundary (rect pcb 0 0 100000 100000))
    (via "V1")
    (rule (width 1524) (clearance 1524))
  )
  (placement
    (component MOD1
      (place U1 50000 50000 front 0 (lock_type position))
      (place U2 20000 20000 front 0)
    )
  )
  (library
    (image MOD1
      (pin RECT 1 0 0)
      (keepout "ko1" (circle F.Cu 2000 0 0))
    )
    (padstack RECT
      (shape (rect F.Cu -500 -500 500 500))
      (shape (rect B.Cu -500 -500 500 500))
    )
    (padstack "V1"
      (shape (circle F.Cu 1000))
      (shape (circle B.Cu 1000))
    )
  )
  (network
    (net GND (pins U1-1 U2-1))
    (class kicad_default GND (rule (width 1524) (clearance 1524)))
  )
  (wiring
    (wire (path F.Cu 1524 50000 50000 60000 60000)(net GND))
    (via "V1" 55000 55000 (net GND))
  )
)`;

function build() {
  const r = readDsn(DSN, { name: "test-fields.dsn" });
  if (!r.ok) throw new Error("readDsn failed");
  return r.layout;
}

describe("Layout.file and Part.locked (Q-I2-47)", () => {
  test("file facts come from the parser and resolution scopes", () => {
    const L = build();
    expect(L.file).toBeDefined();
    expect(L.file!.unit).toBe("um");
    expect(L.file!.perUnit).toBe(10);
    expect(L.file!.quote).toBe("\"");
    expect(L.file!.hostCad).toBe("AcmeCAD");
    expect(L.file!.hostVersion).toBe("9.9");
  });

  test("Part.locked reflects (lock_type position)", () => {
    const L = build();
    const u1 = L.parts.find((p) => p.ref === "U1")!;
    const u2 = L.parts.find((p) => p.ref === "U2")!;
    expect(u1.locked).toBe(true);
    expect(u2.locked).toBe(false);
  });

  test("writeSes writes (lock_type position) only for the locked Part", () => {
    const L = build();
    const ses = writeSes(L);
    expect(ses).toContain("(place U1 500000 500000 front 0 (lock_type position))");
    expect(ses).toContain("(place U2 200000 200000 front 0)");
    expect(ses).toContain("(host_cad AcmeCAD)");
    // F-S30: "9.9" starts with a digit, so it is quoted.
    expect(ses).toContain("(host_version \"9.9\")");
  });
});

describe("Fence.part for image keepouts (Q-I2-54, DR-12)", () => {
  test("each part-owned keepout carries its owning Part id", () => {
    const L = build();
    const u1 = L.parts.find((p) => p.ref === "U1")!;
    const u2 = L.parts.find((p) => p.ref === "U2")!;
    const partFences = L.fences.filter((f) => f.part !== undefined);
    expect(partFences.length).toBeGreaterThan(0);
    expect(partFences.some((f) => f.part === u1.id)).toBe(true);
    expect(partFences.some((f) => f.part === u2.id)).toBe(true);
    for (const f of partFences) expect(L.parts.some((p) => p.id === f.part)).toBe(true);
  });
});

describe("item origin (Q-I2-60)", () => {
  test("file wiring is origin file", () => {
    const L = build();
    expect(L.tracks.length).toBeGreaterThan(0);
    expect(L.barrels.length).toBeGreaterThan(0);
    for (const t of L.tracks) expect(t.origin).toBe("file");
    for (const b of L.barrels) expect(b.origin).toBe("file");
  });

  test("applySes marks items origin session", () => {
    const L = build();
    const ses = writeSes(L);
    const before = { tracks: L.tracks.length, barrels: L.barrels.length };
    const r = applySes(L, ses);
    expect(r.ok).toBe(true);
    // Replacement removed the free file wiring and re-added it from the session.
    expect(L.tracks.length).toBe(before.tracks);
    expect(L.barrels.length).toBe(before.barrels);
    for (const t of L.tracks) expect(t.origin).toBe("session");
    for (const b of L.barrels) expect(b.origin).toBe("session");
  });

  test("includeFileWiring:false writes only router items", () => {
    const L = build();
    // File wiring ("file") is written by default and omitted when file wiring is excluded.
    expect(writeSes(L)).toContain("(wire");
    const routerOnly = writeSes(L, { includeFileWiring: false });
    expect(routerOnly).not.toContain("(wire");
    expect(routerOnly).not.toContain("(via ");
  });
});
