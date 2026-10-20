import { expect, test } from "bun:test";
import { assertBoardZones } from "../tools/kicad-board-rules.ts";
const zone = `(zone (net 1) (layer "F.Cu") (uuid "source")
  (connect_pads (clearance 0.2)) (min_thickness 0.25)
  (fill yes (thermal_gap 0.3) (thermal_bridge_width 0.3))
  (polygon (pts (xy 1 1) (xy 9 1) (xy 9 9) (xy 1 9))))`;
const board = (items: string) => `(kicad_pcb ${items})`;
test("protects thermal, clearance, connection, geometry and ownership fields", () => {
  for (const changed of [zone.replace('thermal_gap 0.3', 'thermal_gap 0.1'), zone.replace('thermal_bridge_width 0.3', 'thermal_bridge_width 0.1'), zone.replace('clearance 0.2', 'clearance 0.1'), zone.replace('(connect_pads', '(connect_pads yes'), zone.replace('xy 1 1', 'xy 2 1'), zone.replace('(net 1)', '(net 2)'), zone.replace('F.Cu', 'B.Cu'), zone.replace('(min_thickness 0.25)', '(min_thickness 0.1)')]) {
    expect(() => assertBoardZones(board(zone), board(changed))).toThrow("Candidate zone definitions differ");
  }
});
test("permits refreshed fill caches, regenerated identifiers and numeric formatting", () => {
  const saved = zone.replace('(uuid "source")', '(uuid "saved") (filled_polygon (layer "F.Cu") (pts (xy 2 2) (xy 8 2) (xy 8 8))) (filled_segments (pts (xy 2 2) (xy 8 2)))').replace('thermal_gap 0.3', 'thermal_gap .300');
  expect(() => assertBoardZones(board(zone), board(saved))).not.toThrow();
  expect(() => assertBoardZones(board(saved), board(zone))).not.toThrow();
});
test("preserves zone multiplicity and unknown future authored fields", () => {
  for (const changed of ['', zone + zone, zone.replace('(net 1)', '(future_rule 1) (net 1)'), zone.replace('(net 1)', '(keepout (tracks not_allowed)) (net 1)')]) {
    expect(() => assertBoardZones(board(zone), board(changed))).toThrow();
  }
  expect(() => assertBoardZones(board(zone + zone), board(zone))).toThrow();
});
test("permits zone and named-field reordering but protects polygon vertex order", () => {
  const second = zone.replace('F.Cu', 'B.Cu');
  const reordered = zone.replace('(net 1) (layer "F.Cu")', '(layer "F.Cu") (net 1)');
  expect(() => assertBoardZones(board(zone + second), board(second + reordered))).not.toThrow();
  expect(() => assertBoardZones(board(zone), board(zone.replace('(xy 1 1) (xy 9 1)', '(xy 9 1) (xy 1 1)')))).toThrow();
});
