import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? import.meta.dir + '/../../..');
const { route, checkDrc, requiredConnections } = await import(root + '/src/api.ts');
const { endcapBoard } = await import(root + '/test/helpers/endcap-board.ts');
const results = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  const layout = endcapBoard();
  const pads = JSON.stringify(layout.pads);
  const report = route(layout, { viasAllowed: false, fanoutEnabled: false, neckWidthUm: 0, optimizerEnabled: false, maxPasses: 1 });
  if (JSON.stringify(layout.pads) !== pads) throw Error('pads changed');
  results.push({ repeat, report, opens: requiredConnections(layout).length,
    violations: checkDrc(layout).violations, pads: layout.pads, tracks: layout.tracks, barrels: layout.barrels });
}
console.log(JSON.stringify(results, null, 2));
