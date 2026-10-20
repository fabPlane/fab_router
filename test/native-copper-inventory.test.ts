import { expect, test } from "bun:test";
import { nativeCopperPreserved } from "../tools/kicad-board-rules.ts";
const segment = '(segment (start 1 2) (end 3 4) (width 0.25) (layer "F.Cu") (net 1) (uuid "a"))';
const board = (items: string, nets = '(net 0 "") (net 1 "A")') => `(kicad_pcb ${nets} ${items})`;
test("native copper resolves legacy net codes and protects ownership, geometry and duplicates", () => {
  const named = segment.replace('(net 1)', '(net "A")').replace('"a"', '"b"');
  expect(nativeCopperPreserved(board(segment), board(named, ''))).toBe(true);
  expect(nativeCopperPreserved(board(segment), board(segment.replace('(net 1)', '(net 9)'), '(net 9 "A")'))).toBe(true);
  expect(nativeCopperPreserved(board(segment), board(named.replace('(start 1 2) (end 3 4)', '(end 1.0 2) (start 3 4.0)'), ''))).toBe(true);
  for (const changed of [named.replace('"A"', '"B"'), named.replace('3 4', '3 5'), named.replace('0.25', '0.2'), '', named + named]) {
    expect(nativeCopperPreserved(board(segment), board(changed, ''))).toBe(false);
  }
  expect(nativeCopperPreserved(board(segment + segment), board(named, ''))).toBe(false);
  expect(nativeCopperPreserved(board(segment.replace('(net 1)', '(net 0)')), board(named.replace('(net "A")', ''), ''))).toBe(true);
});
test("native copper fails closed on unresolved or ambiguous electrical ownership", () => {
  for (const items of [segment.replace('(net 1)', '(net 9)'), segment.replace('(net 1)', '(net 1) (net 1)'), segment.replace('(net 1)', '(net)')]) {
    expect(() => nativeCopperPreserved(board(items), board(segment))).toThrow();
  }
  expect(() => nativeCopperPreserved(board(segment, '(net 1 "A") (net 1 "B")'), board(segment))).toThrow();
});
test("native copper also checks via and arc ownership", () => {
  for (const item of ['(via (at 1 2) (size 0.6) (drill 0.3) (layers "F.Cu" "B.Cu") (net 1))', '(arc (start 1 2) (mid 2 3) (end 3 2) (width 0.25) (layer "F.Cu") (net 1))']) {
    expect(nativeCopperPreserved(board(item), board(item.replace('(net 1)', '(net "A")'), ''))).toBe(true);
    expect(nativeCopperPreserved(board(item), board(item.replace('(net 1)', '(net "B")'), ''))).toBe(false);
  }
});
