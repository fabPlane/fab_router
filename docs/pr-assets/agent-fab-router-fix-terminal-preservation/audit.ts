// Compare the same original fixture using the optimiser from a requested source tree.
import { fixture } from "../../../test/helpers/optimise-terminals.ts";
import { connectivity, incompleteCount } from "../../../src/drc/index.ts";
import { checkDrc } from "../../../src/api.ts";
import { resolveSettings } from "../../../src/pipeline/index.ts";
const [source, output] = process.argv.slice(2);
const { runOptimise } = await import(`${source}/src/route/optimise.ts`);
const rows = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const f = fixture();
  const state = () => {
    const c = connectivity(f.layout, f.lattice);
    const pads = f.layout.pads.map(p => ({ id: p.id, ref: f.layout.parts.find(x => x.id === p.part)!.ref, at: p.at, component: c.componentOf.get(p.id) }));
    return { pads, tracks: structuredClone(f.layout.tracks), opens: incompleteCount(c, 0), violations: checkDrc(f.layout).violations.length,
      acConnected: c.componentOf.get(f.pad("A").id) === c.componentOf.get(f.pad("C").id) };
  };
  const before = state();
  const start = performance.now();
  const result = runOptimise(f.layout, f.lattice, f.journal, resolveSettings({}, undefined, "45"), new Set());
  const elapsedMs = performance.now() - start;
  rows.push({ repeat, before, after: state(), result, elapsedMs });
}
await Bun.write(output!, JSON.stringify({ fixture: "terminal-swap", repeats: 3, nativeBenchmark: false, rows }, null, 2) + "\n");
