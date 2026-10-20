import { expect, test } from "bun:test";
import { assertSourceCopper } from "../tools/kicad-board-rules.ts";
const segment = '(segment (start 1 2) (end 3 4) (width 0.25) (layer "F.Cu") (net 1) (uuid "source"))';
const board = (items: string) => `(kicad_pcb ${items})`;
test("retains original copper while permitting added routes", () => {
  expect(() => assertSourceCopper(board(segment), board(segment + segment.replace('"source"', '"added"')))).not.toThrow();
});
test("blocks deleted, moved, narrowed or reassigned original copper", () => {
  for (const changed of ['', segment.replace('3 4', '3 5'), segment.replace('0.25', '0.2'), segment.replace('(net 1)', '(net 2)')]) {
    expect(() => assertSourceCopper(board(segment), board(changed))).toThrow('Candidate source copper differs');
  }
});
test("preserves duplicate item multiplicity and accepts numeric formatting and field order", () => {
  expect(() => assertSourceCopper(board(segment + segment), board(segment))).toThrow();
  const reordered = '(segment (uuid "source") (net 1) (layer "F.Cu") (width .250) (end 3.0 4) (start 1 2))';
  expect(() => assertSourceCopper(board(segment), board(reordered))).not.toThrow();
});
test("also preserves source vias and arcs", () => {
  for (const item of ['(via (at 1 2) (size 0.6) (drill 0.3) (layers "F.Cu" "B.Cu") (net 1))', '(arc (start 1 2) (mid 2 3) (end 3 2) (width 0.25) (layer "F.Cu") (net 1))']) {
    expect(() => assertSourceCopper(board(item), board(''))).toThrow();
    expect(() => assertSourceCopper(board(item), board(item))).not.toThrow();
  }
});

test("accepts regenerated UUIDs and reversed endpoints without losing geometry", () => {
  const saved = segment.replace('"source"', '"new-id"').replace('(start 1 2) (end 3 4)', '(start 3 4) (end 1 2)');
  expect(() => assertSourceCopper(board(segment), board(saved))).not.toThrow();
});
