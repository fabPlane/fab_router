/** Repeat the actual public routing fixture, optionally against a second checkout. */
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(process.argv[2] ?? ".");
const { route, checkDrc } = await import(pathToFileURL(join(root, "src/api.ts")).href);
const { board } = await import(pathToFileURL(join(root, "test/helpers/ignored-routing.ts")).href);
const rows = [];
for (const detailedNegotiation of [false, true]) for (const shoveEnabled of [false, true])
for (const ignored of [false, true]) for (let repeat = 1; repeat <= 3; repeat++) {
  const L = board([{ net: 1, pts: [{ x: 0, y: -96_000 }, { x: 0, y: 96_000 }] }]);
  L.nets[1]!.group = 1;
  L.netGroups.push({ ...L.netGroups[0]!, id: 1, name: "protected", nets: [1] });
  const before = structuredClone(L.tracks);
  const report = route(L, { detailedNegotiation, shoveEnabled, ignoreNetGroups: ignored ? ["protected"] : [],
    maxPasses: 3, maxStagnantPasses: 0, shoveWindowUm: 8000, optimizerEnabled: false, viasAllowed: false });
  rows.push({ detailedNegotiation, shoveEnabled, ignored, repeat,
    preserved: JSON.stringify(L.tracks.filter((t: {net: number}) => t.net === 1)) === JSON.stringify(before),
    before, tracks: L.tracks, pads: L.pads, report, drc: checkDrc(L) });
}
console.log(JSON.stringify(rows, null, 2));
