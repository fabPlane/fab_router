import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const { checkNativeBoards } = await import(pathToFileURL(resolve(process.argv[2]!)).href);
const directory = resolve(process.argv[3]!);
await mkdir(directory, { recursive: false });
const board = (clearance: number) => `(kicad_pcb (version 20260206) (generator "pcbnew")
  (general (thickness 1.6)) (paper "A4")
  (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (25 "Edge.Cuts" user))
  (setup (pad_to_mask_clearance ${clearance}))
      (gr_rect (start 0 0) (end 10 10) (stroke (width 0.05) (type default))
        (fill none) (layer "Edge.Cuts") (uuid "00000000-0000-0000-0000-000000000001")))`;
const rows = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const before = join(directory, `before-${repeat}.kicad_pcb`), after = join(directory, `after-${repeat}.kicad_pcb`);
  await writeFile(before, board(0.2)); await writeFile(after, board(0));
  for (const path of [before, after]) await writeFile(path.replace(".kicad_pcb", ".kicad_pro"), "{}");
  try {
    const result = await checkNativeBoards(before, after);
    await writeFile(join(directory, `report-${repeat}.json`), JSON.stringify(result, null, 2));
    rows.push({ repeat, accepted: result.accepted, newErrors: result.newErrors.length, opens: result.opensAfter });
  } catch (error) { rows.push({ repeat, accepted: false, error: String(error) }); }
}
await writeFile(join(directory, "results.json"), JSON.stringify(rows, null, 2));
console.log(rows);
