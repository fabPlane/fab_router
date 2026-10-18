import { board } from '../../../test/helpers/pass-progress.ts';
const root = process.argv[2] ?? process.cwd();
const api = await import(`${root}/src/api.ts`) as typeof import('../../../src/api.ts');
const runs = [];
for (let repeat = 1; repeat <= 3; repeat++) {
  for (const hooks of [false, true]) {
    const layout = board([{ net: 1, pts: [{ x: 0, y: -96_000 }, { x: 0, y: 96_000 }] }]);
    const events: { kind: string; pass?: number; reported: number; actual: number }[] = [];
    const report = api.route(layout, { viasAllowed: false, optimizerEnabled: false, shoveEnabled: false,
      maxPasses: 3, maxStagnantPasses: 0 }, hooks ? {
      onPass: e => events.push({ kind: 'pass', pass: e.pass, reported: e.incomplete, actual: api.requiredConnections(layout).length }),
      onProgress: e => events.push({ kind: 'progress', reported: e.total - e.done, actual: api.requiredConnections(layout).length }),
    } : undefined);
    const { wallClockMs, ...stableReport } = report;
    runs.push({ repeat, hooks, report: stableReport, events, tracks: layout.tracks, barrels: layout.barrels,
      drc: api.checkDrc(layout) });
  }
}
console.log(JSON.stringify({ runs }, null, 2));
