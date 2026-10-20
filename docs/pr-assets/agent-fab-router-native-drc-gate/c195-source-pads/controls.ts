import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const { checkNativeBoards } = await import(pathToFileURL(resolve(process.argv[2]!)).href);
const directory = resolve(process.argv[3]!); await mkdir(directory);
const rows=[];
for(let repeat=1;repeat<=3;repeat++) {
 const before=join(directory, `before-${repeat}.kicad_pcb`), after=join(directory, `after-${repeat}.kicad_pcb`);
    const pad = '(pad "1" smd rect (at 0 0) (size 1 1) (layers "F.Cu" "F.Paste" "F.Mask") (thermal_gap 0.3))';
    const board = `(kicad_pcb (version 20260206) (generator "pcbnew")
      (general (thickness 1.6)) (paper "A4")
      (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (25 "Edge.Cuts" user)) (setup)
      (footprint "control" (layer "F.Cu") (at 5 5) ${pad})
      (gr_rect (start 0 0) (end 10 10) (stroke (width 0.05) (type default))
        (fill none) (layer "Edge.Cuts") (uuid "00000000-0000-0000-0000-000000000001")))`;
    await writeFile(before, board); await writeFile(after, board.replace(pad, ''));
    for (const path of [before, after]) await writeFile(path.replace(".kicad_pcb", ".kicad_pro"), "{}");

 try { const report=await checkNativeBoards(before,after); await writeFile(join(directory,`report-${repeat}.json`),JSON.stringify(report,null,2)); rows.push({repeat,accepted:report.accepted,errors:report.newErrors.length,opens:report.opensAfter}); }
 catch(error) { rows.push({repeat,accepted:false,error:String(error)}); }
}
await writeFile(join(directory,'results.json'),JSON.stringify(rows,null,2));console.log(rows);
