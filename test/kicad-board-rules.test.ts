import { expect, test } from "bun:test";
import { assertEmbeddedBoardRules, embeddedBoardRules } from "../tools/kicad-board-rules.ts";

const board = `(kicad_pcb (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
  (setup (pad_to_mask_clearance 0.2) (stackup (layer "F.Cu" (thickness 0.035))))
  (gr_text "escaped \\"setup\\" (layers)" (at 1 2)))`;

test("permits added routing and whitespace/numeric formatting while preserving rules", () => {
  const candidate = board.slice(0, -1) + " (segment (start 0 0) (end 1 1)))";
  expect(() => assertEmbeddedBoardRules(board, candidate.replace("0.2", "2e-1").replace("(setup", "( setup\n"))).not.toThrow();
});

test("protects layer order, stackup and unknown embedded setup fields", () => {
  for (const candidate of [board.replace("0.2", "0"), board.replace("0.035", "0.07"), board.replace('"B.Cu"', '"In1.Cu"'), board.replace("(setup", "(setup (future_rule yes)")]) {
    expect(() => assertEmbeddedBoardRules(board, candidate)).toThrow("Candidate embedded board rules differ");
  }
});

test("permits native-added layer display aliases without changing physical layer definitions", () => {
  expect(() => assertEmbeddedBoardRules(board, board.replace('(2 "B.Cu" signal)', '(2 "B.Cu" signal "Back copper")'))).not.toThrow();
});

test("does not ignore trailing text, duplicate/missing sections or malformed strings", () => {
  for (const malformed of [board + ")", board + " atom", board.slice(0, -1), board.replace("(setup", "(other"), board.slice(0, -1) + " (setup))", board.replace("(gr_text", '(gr_text "')]) {
    expect(() => embeddedBoardRules(malformed)).toThrow();
  }
});
