// Diagnostic witnesses, not a production repair or frozen benchmark score.
import { readDsn, route, checkDrc } from "../../../src/api.ts";
const text = await Bun.file(new URL("minimal.dsn", import.meta.url)).text();
const options = { timeBudgetMs: 30000, maxPasses: 100, copperToEdgeClearanceUm: 500,
  holeClearanceUm: 250, strictDrc: true, neckWidthUm: 0, fanoutEnabled: false, seed: 1 };
const rows = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  for (const variant of ["original", "via-witness", "inset-vertex"] as const) {
    const read = readDsn(text);
    if (!read.ok) throw new Error(JSON.stringify(read));
    const layout = read.layout, pad = layout.pads[0]!;
    if (layout.pads.length !== 1 || layout.pours.length !== 1 || layout.tracks.length || layout.barrels.length)
      throw new Error("Fixture is no longer one pad and one pour");
    const net = layout.nets.find(n => n.id === pad.net)!;
    const group = layout.netGroups.find(g => g.id === net.group)!;
    if (variant === "via-witness") {
      const form = layout.padForms.find(f => f.name === "Via[0-1]_600:300_um")!;
      (layout.barrels as unknown as Array<unknown>).push({ id: 99999, net: pad.net, at: { ...pad.at },
        form: form.id, fromSheet: 0, toSheet: 1, kind: group.categoryKinds.barrel, hold: "free", origin: "router" });
    }
    if (variant === "inset-vertex") {
      // Diagnostic input change only: never proposed as a board/rule repair.
      (layout.pours[0]!.outline as Array<{x: number; y: number}>)[1] = { x: 610000, y: -880000 };
    }
    const before = checkDrc(layout, options).counts;
    const report = route(layout, options);
    const after = checkDrc(layout, options).counts;
    const expected = variant === "original" ? 1 : 0;
    if (before.violations || after.violations || after.incompletes !== expected || report.timedOut || report.aborted)
      throw new Error(JSON.stringify({ repeat, variant, before, report, after }));
    if (variant === "original" && (report.stoppedBy !== "stagnant" || report.added.tracks || report.added.barrels))
      throw new Error("Original failure changed; reconsider this diagnostic");
    rows.push({ repeat, variant, before, report, after });
  }
}
console.log(JSON.stringify({ fixtureSha256: new Bun.CryptoHasher("sha256").update(text).digest("hex"), rows }, null, 2));
