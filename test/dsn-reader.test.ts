/**
 * Reader, builder and rules-overlay checks against the clauses of spec/formats/dsn.md,
 * spec/formats/padstack-names.md, spec/formats/rules.md and spec/rules/*.md that the parse
 * summaries do not pin directly: robustness on garbage input (F-20, never throws), the stray
 * quote of F-14, pin-reference splitting (F-101), back-side pad placement (§11 example),
 * polyline_path corners (F-54), padstack normalisation and drill inference (P-1, P-10),
 * rules-file acceptance and idempotence (F-R1, F-R19).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyRules, readDsn, readRules } from "../src/api.ts";
import { normalisePadstackName } from "../src/layout/build.ts";
import type { LayoutX } from "../src/layout/model.ts";
import { polylineCorners } from "../src/layout/shapes.ts";
import { splitTypeText } from "../src/layout/rules.ts";

const BOARDS = resolve(import.meta.dir, "..", "spec", "acceptance", "boards");
const board = (f: string) => readFileSync(join(BOARDS, f), "utf8");

describe("readDsn robustness (F-20, F-13, F-24)", () => {
  test("garbage never throws and only a missing pcb head fails", () => {
    for (const t of ["", "   ", ")", "(", "((", "x", "(pcb", "(PCB", "(pcb x", "(pcb x))", String.fromCharCode(0, 1), "(pcb \"unterminated", "(pcb x (structure (layer", "(rules pcb x)"]) {
      const r = readDsn(t);
      const shouldFail = !/^\s*\(\s*pcb/i.test(t);
      expect(r.ok).toBe(!shouldFail);
    }
    const binary = readDsn(board("Issue006-LPC18XX_43XX_SCH.dsn"));
    expect(binary.ok).toBe(false);
    if (!binary.ok) expect(binary.error.line).toBe(1);
  });
  test("a lost parenthesis inside placement does not swallow the rest of the board (F-21)", () => {
    const t = "(pcb x (structure (layer F.Cu (type signal)) (boundary (rect pcb 0 0 100 100))) (placement (component im (place R1 1 2 front 0) (library (image im (pin p 1 0 0)) (padstack p (shape (circle F.Cu 10)))) (network (net n (pins R1-1)))))";
    const r = readDsn(t);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layout.pads.length).toBe(1);
    expect(r.layout.nets.length).toBe(1);
  });
  test("the stray inch mark of Issue229 loses four Parts (F-14)", () => {
    const r = readDsn(board("Issue229-display-8-digit-hc595.dsn"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layout.parts.length).toBe(22);
    const refs = r.layout.parts.map((p) => p.ref);
    for (const lost of ["DP3", "DP5", "DP6", "DP8"]) expect(refs).not.toContain(lost);
    expect(r.diagnostics.some((d) => d.code === "string-spans-lines")).toBe(true);
    expect(r.diagnostics.some((d) => d.code === "keepout-degenerate")).toBe(true);
  });
});

describe("pin references (F-101)", () => {
  test("split at the first hyphen outside quotes", () => {
    const t = `(pcb x (network (net n (pins U1-1 SW1-A' B1-- "FP-Altair1"-1 "J1"-"D+" u1-1e31 U18-- "J2(--)"-"GND" nohyphen))))`;
    const r = readDsn(t);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.document.network.nets[0]!.pins).toEqual([
      { component: "U1", pin: "1" }, { component: "SW1", pin: "A'" }, { component: "B1", pin: "-" }, { component: "FP-Altair1", pin: "1" },
      { component: "J1", pin: "D+" }, { component: "u1", pin: "1e31" }, { component: "U18", pin: "-" }, { component: "J2(--)", pin: "GND" },
    ]);
    expect(r.diagnostics.filter((d) => d.code === "pin-reference-malformed").length).toBe(1);
  });
});

describe("pad placement (dsn.md §11)", () => {
  test("Issue035 R3 on the back side lands its pins on B.Cu at the mirrored positions", () => {
    const r = readDsn(board("Issue035-ReadPlaceScope.dsn"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const L = r.layout as LayoutX;
    const part = L.parts.find((p) => p.ref === "R3")!;
    expect(part.side).toBe("back");
    expect(part.rotationDeg).toBe(270);
    const pads = L.pads.filter((p) => p.part === part.id).sort((a, b) => (a.pinName < b.pinName ? -1 : 1));
    expect(pads.map((p) => [p.pinName, p.at.x, p.at.y, p.sheets])).toEqual([["1", 2559050, -649150, [1]], ["2", 2559050, -628650, [1]]]);
  });
  test("rotate_first mirrors after rotating (F-115)", () => {
    const mk = (flip: string) => `(pcb x (resolution um 10) (structure (layer F.Cu (type signal)) (layer B.Cu (type signal)) (boundary (rect pcb 0 0 100 100)) (flip_style ${flip}))
      (placement (component im (place R1 0 0 back 90))) (library (image im (pin p 1 100 0)) (padstack p (shape (rect F.Cu -1 -1 1 1)))))`;
    const mirrorFirst = readDsn(mk("mirror_first"));
    const rotateFirst = readDsn(mk("rotate_first"));
    expect(mirrorFirst.ok && rotateFirst.ok).toBe(true);
    if (!mirrorFirst.ok || !rotateFirst.ok) return;
    // mirror first: (−100, 0) rotated by 90° → (0, −100); rotate first: (100, 0) → (0, 100) → mirrored (0, 100).
    expect(mirrorFirst.layout.pads[0]!.at).toEqual({ x: 0, y: -1000 });
    expect(rotateFirst.layout.pads[0]!.at).toEqual({ x: 0, y: 1000 });
    expect(mirrorFirst.layout.pads[0]!.sheets).toEqual([1]);
  });
});

describe("shapes", () => {
  test("polyline_path corners (F-54 example, in LU at resolution um 10)", () => {
    const pts = [
      { x: 786892, y: -1401570 }, { x: 786891, y: -1401570 },
      { x: 786892, y: -1401570 }, { x: 786892, y: -1401569 },
      { x: 0, y: -1390317 }, { x: -1, y: -1390317 },
    ];
    expect(polylineCorners(pts)).toEqual([{ x: 786892, y: -1401570 }, { x: 786892, y: -1390317 }]);
  });
  test("padstack names normalise and resolve; drills follow P-10", () => {
    expect(normalisePadstackName("Via[0-1]_685.8:330.2_um")).toBe("Via[0-1]_685:330_um");
    expect(normalisePadstackName("RoundRect[A][600,0]Pad_2600x1600.2_401.572_um_0.000000_0")).toBe("RoundRect[A][600,0]Pad_2600x1600_401_um_0_0");
    expect(normalisePadstackName("via-0.5:auto-1.0:auto-tht")).toBe("via-0:auto-1:auto-tht");
    const t = `(pcb x (resolution um 10) (structure (layer F.Cu (type signal)) (layer B.Cu (type signal)) (boundary (rect pcb 0 0 100 100)) (via "Via[0-1]_800:400_um" Via[0-1]_685.8:330.2_um))
      (library (padstack "Via[0-1]_800:400_um" (shape (circle F.Cu 800)) (shape (circle B.Cu 800)))
               (padstack "Via[0-1]_685.8:330.2_um" (shape (circle F.Cu 685.8)) (shape (circle B.Cu 685.8)))
               (padstack "Via[0-1]_685.80:330.2_um" (shape (circle F.Cu 1)))
               (padstack "Round[A]Pad_1524_um" (shape (circle F.Cu 1524)) (shape (circle B.Cu 1524)))
               (padstack "Rect[T]Pad_1x1_um" (shape (rect F.Cu -5 -5 5 5)))))`;
    const r = readDsn(t);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const L = r.layout as LayoutX;
    expect(L.padForms.map((p) => p.name)).toEqual(["Via[0-1]_800:400_um", "Via[0-1]_685.8:330.2_um", "Round[A]Pad_1524_um", "Rect[T]Pad_1x1_um"]);
    expect(r.diagnostics.some((d) => d.code === "padstack-duplicate")).toBe(true);
    expect(L.padForms[0]!.drill).toEqual({ diameter: 4000, fromSheet: 0, toSheet: 1 });
    expect(L.padForms[1]!.drill!.diameter).toBe(2 * Math.round(3429 * 330.2 / 685.8));
    expect(L.padForms[2]!.drill!.diameter).toBe(2 * Math.round(0.45 * 7620));
    expect(L.padForms[3]!.drill).toBeUndefined();
    expect(L.viaForms).toEqual([0, 1]);
  });
});

describe("rules files (rules.md)", () => {
  test("readRules refuses only a missing head", () => {
    expect(readRules("not a rules file").ok).toBe(false);
    expect(readRules("(((").ok).toBe(false);
    expect(readRules("").ok).toBe(false);
    const ok = readRules("(RULES PCB x (rule (width 3)) (bogus 1))");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.rules.name).toBe("x");
      expect(ok.rules.body.length).toBe(2);
      expect(ok.diagnostics.some((d) => d.code === "unknown-scope")).toBe(true);
    }
  });
  test("type texts are split into items when read (F-R12)", () => {
    expect(splitTypeText("\"default\"-\"1A EXTERNAL 1oz\"")).toEqual(["default", "1A EXTERNAL 1oz"]);
    expect(splitTypeText("smd_smd")).toEqual(["smd_smd"]);
    expect(splitTypeText("smd-smd")).toEqual(["smd", "smd"]);
    expect(splitTypeText("default_\"1A EXTERNAL 1oz\"")).toEqual(["default_", "1A EXTERNAL 1oz"]);
    const r = readRules("(rules pcb x (rule (clear 190.6 (type \"default\"-\"1A EXTERNAL 1oz\"))))");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rule = r.rules.body[0]!;
    const clear = rule.items[0] as { head: string; items: unknown[] };
    const type = clear.items[1] as { head: string; items: unknown[] };
    expect(type.items).toEqual(["default", "1A EXTERNAL 1oz"]);
  });
  test("applying a rules file twice is idempotent (F-R19) and replaces the settings block (F-R18)", () => {
    const read = readDsn(board("Issue029-hw48na.dsn"), { name: "Issue029-hw48na.dsn" });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const rules = readRules(board("Issue029-hw48na_valid.rules"));
    expect(rules.ok).toBe(true);
    if (!rules.ok) return;
    const snapshot = (L: LayoutX) => JSON.stringify({
      kinds: L.spacing.kinds, groups: L.netGroups.map((g) => [g.name, g.nets.length, g.widthBySheet, g.kind, g.categoryKinds, g.viaRule]),
      viaRules: L.viaRules, defs: L.viaDefs, gap: L.pinEdgeToTurnLu, angle: L.angleMode, settings: L.settingsFromFile,
      spacing: L.spacing.kinds.map((_, a) => L.spacing.kinds.map((_, b) => L.spacing.get(a, b, 0))),
      pads: L.pads.map((p) => p.kind),
    });
    const L = read.layout as LayoutX;
    applyRules(L, rules.rules);
    const once = snapshot(L);
    applyRules(L, rules.rules);
    expect(snapshot(L)).toBe(once);
    expect(L.settingsFromFile?.viaCost).toBe(50);
    expect(L.settingsFromFile?.layers?.["F.Cu"]).toEqual({ active: true, preferDir: "v", alongCost: 1, againstCost: 2 });
    expect(L.spacing.find("kicad_default")).toBeGreaterThan(1);
    expect(L.warnings.some((d) => d.code === "rules-design-mismatch")).toBe(false);
  });
  test("a rules file naming another design is applied with a warning (F-R1)", () => {
    const read = readDsn(board("Issue269-NoViasOnPowerPlanes-Issue269-NoViasOnPowerPlanes.dsn"));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const rules = readRules(board("Issue269-NoWiresOnPowerLayers-proba.rules"));
    expect(rules.ok).toBe(true);
    if (!rules.ok) return;
    applyRules(read.layout, rules.rules);
    expect(read.layout.warnings.some((d) => d.code === "rules-design-mismatch")).toBe(true);
  });
});

describe("Layout details", () => {
  test("wiring holds, plane nets and synthetic plane pours (F-112, L-05, L-06)", () => {
    const t = `(pcb x (resolution um 10) (structure (layer F.Cu (type signal)) (layer In1.Cu (type power) (use_net GND)) (layer B.Cu (type signal))
      (boundary (rect pcb 0 0 1000 1000)) (plane VCC (polygon B.Cu 0 0 0 100 0 100 100)) (rule (width 200) (clearance 200)))
      (library (padstack v (shape (circle F.Cu 300)) (shape (circle B.Cu 300))))
      (network (net GND (pins)) (net VCC (pins)) (net S (pins)))
      (wiring (wire (path F.Cu 200 0 0 100 0) (net S) (type fix)) (wire (path F.Cu 200 0 0 100 0) (net S) (type protect)) (wire (path F.Cu 200 0 0 100 0) (net S))
              (wire (path F.Cu 200 0 0 100 0) (net S) (type shove_fixed)) (wire (path F.Cu 200 5 5 5 5) (net S)) (via v 10 10 (net S) (type route)) (via v 20 20 30 30 (net NOPE))))`;
    const r = readDsn(t);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const L = r.layout as LayoutX;
    expect(L.tracks.map((w) => w.hold)).toEqual(["locked", "held", "free", "free"]);
    expect(r.diagnostics.some((d) => d.code === "wire-degenerate")).toBe(true);
    expect(L.barrels.length).toBe(3);
    expect(L.barrels[0]!.hold).toBe("held");
    expect(L.barrels[1]!.net).toBeNull();
    expect(L.nets.find((n) => n.name === "GND")!.plane).toBe(true);
    expect(L.nets.find((n) => n.name === "VCC")!.plane).toBe(true);
    expect(L.nets.find((n) => n.name === "S")!.plane).toBe(false);
    expect(L.pours.length).toBe(2);
    const synthetic = L.pours.find((p) => p.sheet === 1)!;
    expect(synthetic.kind).toBe(0);
    expect(L.stack[1]!.planeNet).toBe(L.nets.find((n) => n.name === "GND")!.id);
    expect(L.netGroups[0]!.usable).toEqual([0, 2]);
    // One id space across item kinds (Q-I3-15).
    const ids = [...L.pads, ...L.barrels, ...L.tracks, ...L.pours, ...L.fences].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test("keepouts on signal and pcb pseudo-layers fan out per Sheet (F-66)", () => {
    const t = `(pcb x (resolution um 10) (structure (layer F.Cu (type signal)) (layer In1.Cu (type power)) (layer B.Cu (type signal)) (boundary (rect pcb 0 0 1000 1000))
      (keepout "" (polygon signal 0 0 0 10 0 10 10)) (via_keepout (circle pcb 20 5 5)) (place_keepout k (rect B.Cu 0 0 1 1)) (keepout bad (polygon signal 0 1 1 1 1 1 1))))`;
    const r = readDsn(t);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const L = r.layout as LayoutX;
    expect(L.fences.map((f) => [f.scope, f.sheet])).toEqual([["track", 0], ["track", 2], ["barrel", 0], ["barrel", 1], ["barrel", 2], ["place", 2]]);
    expect(r.diagnostics.some((d) => d.code === "keepout-degenerate")).toBe(true);
  });
});
