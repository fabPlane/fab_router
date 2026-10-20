import { pathToFileURL } from "node:url";
const { compareNativeReports } = await import(pathToFileURL(process.argv[2]!).href);
const endpoint = { description: "Pad 1 [GND] of U1 on F.Cu", pos: { x: 1, y: 2 } };
const connection = { type: "unconnected_items", severity: "error", description: "Missing connection between items", items: [endpoint, { ...endpoint, pos: { x: 3, y: 2 } }] };
const report = (entries: unknown[]) => ({ coordinate_units: "mm", kicad_version: "10.0.6", included_severities: ["error", "warning", "exclusion"], violations: [], ignored_checks: [], unconnected_items: entries });
const malformed = [null, {}, { ...connection, type: "clearance" }, { ...connection, severity: "warning" }, { ...connection, items: [] }, { ...connection, items: [endpoint] }, { ...connection, items: [endpoint, { ...endpoint, pos: { x: NaN, y: 2 } }] }];
const rows=[];
for (let repeat=1;repeat<=3;repeat++) for (const [index,bad] of malformed.entries()) for (const side of ["input", "candidate"]) {
  let blocked=false;
  try { compareNativeReports(report(side === "input" ? [bad] : [connection]), report(side === "candidate" ? [bad] : [connection])); } catch { blocked=true; }
  rows.push({ repeat, corruption:index, side, blocked });
}
console.log(JSON.stringify({perRepeat:[1,2,3].map(repeat=>rows.filter(r=>r.repeat===repeat&&r.blocked).length),rows},null,2));
