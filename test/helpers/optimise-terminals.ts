import { readDsn } from "../../src/api.ts";
import { buildLattice } from "../../src/lattice/index.ts";
import { createJournal } from "../../src/route/journal.ts";

export function fixture(extraTerminal = true) {
  const read = readDsn(`(pcb terminal-swap (resolution um 1)
    (structure (layer F.Cu (type signal))
      (boundary (rect pcb -6000 -2000 6000 6000))
      (rule (width 200) (clearance 200)))
    (placement (component P (place A -4000 0 front 0) (place B 4000 0 front 0)
      (place C 0 4000 front 0) ${extraTerminal ? "(place D 0 0 front 0)" : ""}))
    (library (image P (pin S 1 0 0)) (padstack S (shape (circle F.Cu 200))))
    (network (net N (pins A-1 B-1 C-1 ${extraTerminal ? "D-1" : ""}))))`);
  if (!read.ok) throw new Error(JSON.stringify(read));
  const layout = read.layout;
  const lattice = buildLattice(layout);
  const journal = createJournal(layout, lattice);
  const pad = (ref: string) => layout.pads.find(p => p.part === layout.parts.find(x => x.ref === ref)!.id)!;
  const track = journal.addTrack({ net: layout.nets[0]!.id, sheet: 0,
    pts: [pad("A").at, pad("C").at, pad("B").at], width: 200, kind: pad("A").kind, hold: "free" });
  return { layout, lattice, journal, pad, track };
}

