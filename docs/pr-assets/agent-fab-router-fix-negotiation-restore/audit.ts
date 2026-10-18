import { resolve } from "node:path";
import { board } from "../../../test/helpers/negotiation-restore.ts";
const {route, checkDrc} = await import(resolve(process.argv[2]!, "src/api.ts"));
const baseline = process.argv.includes("--expect-unsafe");
const results = [];
for (const detailedNegotiation of [false, true]) for (let repeat=1; repeat<=3; repeat++) {
  const L=board([{net:1,pts:[{x:0,y:-96000},{x:0,y:96000}]}]);
  const before=checkDrc(L), original=structuredClone(L.tracks);
  const report=route(L,{detailedNegotiation,maxPasses:3,maxStagnantPasses:0,shoveEnabled:true,
    shoveWindowUm:8000,optimizerEnabled:false,viasAllowed:false});
  const after=checkDrc(L);
  const unsafe=baseline && detailedNegotiation;
  if (before.counts.violations!==0 || after.counts.violations!==(unsafe?1:0) || report.incompleteAfter!==0
      || L.tracks.filter(t=>t.net===1).length!==(unsafe?2:1)
      || L.tracks.some(t=>t.id===200)!==unsafe) throw Error("unexpected restoration outcome");
  results.push({repeat,detailedNegotiation,original,before,report,after,tracks:L.tracks});
}
console.log(JSON.stringify({baseline,results},null,2));
