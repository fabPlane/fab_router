import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const api = await import(`${resolve(process.argv[2] ?? ".")}/src/api.ts`);
const input = JSON.parse(readFileSync(new URL("branch.srj.json", import.meta.url), "utf8"));
const rows=[];
for(let repeat=1; repeat<=3; repeat++) {
  const start=performance.now();
  const result=api.routeSrj(input, {});
  rows.push({repeat,seconds:(performance.now()-start)/1000,result});
}
console.log(JSON.stringify(rows,null,2));
