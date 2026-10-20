import { expect, test } from "bun:test";
import { assertBoardNets } from "../tools/kicad-board-rules.ts";
const board = (nets: string) => `(kicad_pcb ${nets})`;
const nets = '(net 1 "GND") (net 2 "VCC")';
test("preserves net ownership independently of formatting and table order", () => {
  expect(() => assertBoardNets(board(nets), board('(net 2.0 "VCC") (net 01 "GND")'))).not.toThrow();
});
test("blocks renamed, exchanged, added and removed electrical nets", () => {
  for (const changed of ['(net 1 "OTHER") (net 2 "VCC")', '(net 1 "VCC") (net 2 "GND")', nets + '(net 3 "OTHER")', '(net 1 "GND")']) {
    expect(() => assertBoardNets(board(nets), board(changed))).toThrow("Candidate net table differs");
  }
});
test("rejects ambiguous or malformed net tables on either side", () => {
  for (const invalid of ['(net 1 "GND") (net 1 "VCC")', '(net 1 "GND") (net 2 "GND")', '(net 1)', '(net 1 GND)', '(net -1 "GND")', '(net 9007199254740992 "GND")', '(net 1 "GND" extra)']) {
    expect(() => assertBoardNets(board(invalid), board(nets))).toThrow("Malformed native net table");
    expect(() => assertBoardNets(board(nets), board(invalid))).toThrow("Malformed native net table");
  }
});
