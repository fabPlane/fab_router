/** Reproduce both three-repeat engine experiments; supply baseline and candidate source roots. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { padEscapeBoard } from "../../../test/helpers/pad-escape.ts";

const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate) throw new Error("usage: bun regressions.ts BASELINE_SOURCE CANDIDATE_SOURCE");
const fixture = [], corpus = [];
const text = await Bun.file(new URL("../../../spec/acceptance/boards/Issue026-J2_reference.dsn", import.meta.url)).text();
for (const [version, source] of [["before", baseline], ["after", candidate]]) {
  const api = await import(pathToFileURL(resolve(source!, "src/api.ts")).href);
  for (let repeat = 1; repeat <= 3; repeat++) {
    for (const reverse of [false, true]) {
      const layout = padEscapeBoard(reverse);
      const report = api.route(layout, {
        maxPasses: 3, fanoutEnabled: false, optimizerEnabled: false,
        copperToEdgeClearanceUm: 500, holeClearanceUm: 250, neckWidthUm: 0,
        ignoreNetGroups: ["obstacles"],
      });
      fixture.push({ version, repeat, reverse, incomplete: report.incompleteAfter,
        violationsAdded: report.violationsAdded, tracks: report.added.tracks, barrels: report.added.barrels });
    }
    const read = api.readDsn(text);
    if (!read.ok) throw new Error("corpus parse failed");
    const report = api.route(read.layout, { maxPasses: 100 });
    corpus.push({ version, repeat, report, stats: api.layoutStats(read.layout), drc: api.checkDrc(read.layout).counts });
  }
}
await Bun.write(new URL("regression-results.json", import.meta.url), JSON.stringify(fixture, null, 2) + "\n");
await Bun.write(new URL("corpus-results.json", import.meta.url), JSON.stringify(corpus, null, 2) + "\n");
console.log("Wrote fixture and corpus results for three repeats of each version.");
