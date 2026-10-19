import { expect, test } from "bun:test";
import { assertSourcePads } from "../tools/kicad-board-rules.ts";
const pad = '(pad "1" smd rect (at 1 2) (size 1 1) (layers "F.Cu" "F.Mask") (net "GND") (thermal_gap 0.3) (uuid "source"))';
const board = (p = pad, context = '(at 5 5) (layer "F.Cu") (clearance 0.2)') => `(kicad_pcb (footprint "control" ${context} ${p}))`;
test("protects pad geometry, ownership, rules, multiplicity and parent placement", () => {
  for (const p of ['', pad + pad, pad.replace('size 1 1', 'size 2 1'), pad.replace('at 1 2', 'at 2 2'), pad.replace('GND', 'OTHER'), pad.replace('thermal_gap 0.3', 'thermal_gap 0.1'), pad.replace('rect', 'circle'), pad.replace('F.Cu', 'B.Cu'), pad.replace('(uuid', '(future_rule 1) (uuid')]) expect(() => assertSourcePads(board(), board(p))).toThrow('Candidate source pads differ');
  for (const context of ['(at 5.000048 5) (layer "F.Cu") (clearance 0.2)', '(at 5 5 90) (layer "F.Cu") (clearance 0.2)', '(at 5 5) (layer "B.Cu") (clearance 0.2)', '(at 5 5) (layer "F.Cu") (clearance 0.1)']) expect(() => assertSourcePads(board(), board(pad, context))).toThrow();
});
test("permits regenerated pad IDs, numeric formatting and named-field order", () => {
  const changed = pad.replace('source', 'saved').replace('(at 1 2) (size 1 1)', '(size 1.0 1) (at 1 2.0)');
  expect(() => assertSourcePads(board(), board(changed))).not.toThrow();
  expect(() => assertSourcePads(board(pad + changed), board(changed + pad))).not.toThrow();
});
test("protects custom pad primitives and footprint thermal overrides", () => {
  const custom = pad.replace('(uuid', '(primitives (gr_poly (pts (xy 0 0) (xy 1 0) (xy 1 1)) (width 0))) (uuid');
  expect(() => assertSourcePads(board(custom), board(custom.replace('xy 1 0', 'xy 2 0')))).toThrow();
  expect(() => assertSourcePads(board(pad, '(thermal_gap 0.3)'), board(pad, '(thermal_gap 0.1)'))).toThrow();
});
