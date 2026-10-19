// Fixture-specific native-context experiment, not a production routing policy.
import { checkDrc, readDsn, route, writeSes } from "../../../../src/api.ts";
import type { Fence } from "../../../../spec/types/layout.ts";

const [input, metadataPath, mode, output, reportPath] = process.argv.slice(2);
if (!input || !metadataPath || !output || !reportPath || !["baseline", "protected"].includes(mode!)) {
  throw new Error("expected input metadata baseline|protected output report");
}
const metadata = await Bun.file(metadataPath).json() as {
  net: string; layer: string; centre_x_nm: number; pad_bottom_nm: number;
  thermal_gap_nm: number; bridge_width_nm: number; min_thickness_nm: number;
  native_clearance_nm: number;
};
const read = readDsn(await Bun.file(input).text());
if (!read.ok) throw new Error(JSON.stringify(read));
const layout = read.layout;
const net = layout.nets.find(n => n.name === metadata.net);
const sheet = layout.stack.find(s => s.name === metadata.layer);
if (!net || !sheet) throw new Error("native guard net/layer absent from DSN");
const luPerNm = layout.frame.luPerUm / 1000;
const engineClearanceNm = layout.spacing.get(1, 1, sheet.id) / luPerNm;
const inflation = Math.max(0, metadata.native_clearance_nm - engineClearanceNm);
// Manually select the fixture's downward spoke. Preserve a full bridge-width
// strip through the gap and one minimum-thickness strip into the plane.
// No general spoke discovery, overridden pad rules, or arbitrary rotations.
const nativeBox = {
  x0: metadata.centre_x_nm - metadata.bridge_width_nm / 2 - inflation,
  y0: metadata.pad_bottom_nm - inflation,
  x1: metadata.centre_x_nm + metadata.bridge_width_nm / 2 + inflation,
  y1: metadata.pad_bottom_nm + metadata.thermal_gap_nm + metadata.min_thickness_nm + inflation,
};
const nextId = Math.max(...[layout.pads, layout.barrels, layout.tracks, layout.pours, layout.fences]
  .flatMap(items => items.map(item => item.id))) + 1;
const guard: Fence = {
  id: nextId, sheet: sheet.id, scope: "track", kind: 1, net: net.id,
  shape: { kind: "box", box: {
    x0: Math.round(nativeBox.x0 * luPerNm), x1: Math.round(nativeBox.x1 * luPerNm),
    y0: Math.round(-nativeBox.y1 * luPerNm), y1: Math.round(-nativeBox.y0 * luPerNm),
  } },
};
if (mode === "protected") (layout.fences as Fence[]).push(guard);
const before = checkDrc(layout);
if (before.violations.length || before.incompletes.length !== 1) throw new Error(JSON.stringify(before));
const report = route(layout, { seed: 1 });
const after = checkDrc(layout);
if (after.violations.length || after.incompletes.length || report.violationsAdded || report.incompleteAfter || report.timedOut || report.aborted) {
  throw new Error(JSON.stringify({ report, after }));
}
await Bun.write(output, writeSes(layout));
await Bun.write(reportPath, JSON.stringify({ mode, metadata, engineClearanceNm, nativeBox, guard, before, report, after }, null, 2) + "\n");
