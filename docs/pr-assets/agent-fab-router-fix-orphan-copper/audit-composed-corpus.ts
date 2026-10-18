/** Audit the intended cleanup delta on Issue026, independently of its route fingerprint.
 * bun audit-composed-corpus.ts PAD_ESCAPE_SOURCE COMPOSED_SOURCE OUTPUT_JSON
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const [beforeDir, afterDir, output] = process.argv.slice(2);
if (!beforeDir || !afterDir || !output) throw new Error("expected two source directories and output path");
const sources = [beforeDir, afterDir].map(p => resolve(p));
const apis = await Promise.all(sources.map(p => import(pathToFileURL(`${p}/src/api.ts`).href)));
const file = "Issue026-J2_reference.dsn";
const text = await Bun.file(`${sources[0]}/spec/acceptance/boards/${file}`).text();
if (text !== await Bun.file(`${sources[1]}/spec/acceptance/boards/${file}`).text()) throw new Error("board mismatch");
const evidence = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const runs = apis.map(api => {
    const r = api.readDsn(text);
    if (!r.ok) throw new Error("DSN parse failed");
    const report = api.route(r.layout, { maxPasses: 100 });
    if (report.timedOut || report.aborted || report.violationsAdded) throw new Error("invalid route");
    return { report, layout: r.layout, stats: api.layoutStats(r.layout) };
  });
  const [before, after] = runs;
  const retainedIds = new Set(after.layout.tracks.map((t: { id: number }) => t.id));
  const removed = before.layout.tracks.filter((t: { id: number }) => !retainedIds.has(t.id));
  assert.equal(before.layout.tracks.length, 108);
  assert.equal(after.layout.tracks.length, 99);
  assert.equal(removed.length, 9);
  assert.equal(before.layout.barrels.length, 37);
  assert.equal(after.layout.barrels.length, 37);
  assert.equal(after.report.incompleteAfter, 1);
  for (const track of after.layout.tracks) {
    if (JSON.stringify(track) !== JSON.stringify(before.layout.tracks.find((t: { id: number }) => t.id === track.id))) {
      throw new Error("retained track changed");
    }
  }
  if (JSON.stringify(before.layout.barrels) !== JSON.stringify(after.layout.barrels)) throw new Error("via changed");
  if (before.report.incompleteAfter !== after.report.incompleteAfter) throw new Error("terminal completion changed");
  evidence.push({ repeat, before: { report: before.report, stats: before.stats },
    after: { report: after.report, stats: after.stats }, removedTracks: removed,
    retainedTracksIdentical: true, barrelsIdentical: true });
}
await Bun.write(output, JSON.stringify({ board_sha256: createHash("sha256").update(text).digest("hex"), evidence }, null, 2) + "\n");
console.log(JSON.stringify(evidence.map(r => ({ repeat: r.repeat, before: r.before.stats.items,
  after: r.after.stats.items, incompletes: r.after.report.incompleteAfter, removed: r.removedTracks.length }))));
