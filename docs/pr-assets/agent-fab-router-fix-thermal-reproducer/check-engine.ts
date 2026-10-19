// Characterise the DSN model only; native thermal acceptance is checked separately.
import { checkDrc, readDsn } from "../../../src/api.ts";
const result = readDsn(await Bun.file(process.argv[2]!).text());
if (!result.ok) throw new Error(JSON.stringify(result));
const drc = checkDrc(result.layout);
if (result.layout.pads.length !== 1 || result.layout.tracks.length !== 2 || result.layout.barrels.length !== 1 || result.layout.pours.length !== 1) {
  throw new Error("The exported minimal fixture lost geometry");
}
if (drc.counts.violations !== 0 || drc.counts.incompletes !== 0) throw new Error(JSON.stringify(drc));
console.log(JSON.stringify({ pads: 1, tracks: 2, vias: 1, pours: 1, ...drc.counts }));
