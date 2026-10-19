import {expect, test} from 'bun:test';
import {route, checkDrc, requiredConnections} from '../src/api.ts';
import {buildLattice, rotatePt} from '../src/lattice/index.ts';
import {resolveSettings} from '../src/pipeline/index.ts';
import {resolveProfile} from '../src/route/profile.ts';
import {ignoreOf, sweepClear} from '../src/route/clear.ts';
import {legaliseTrail} from '../src/route/legalise.ts';
import {trailFallbackBoard} from './helpers/trail-fallback-board.ts';

for (const rotation of [0,90,180,270]) test(`retain a clear search trail when its pulled shortcut cannot be shaped (${rotation})`, () => {
  const layout=trailFallbackBoard();
  layout.pads=layout.pads.map(p=>({...p,at:rotatePt(p.at,rotation),rotationDeg:rotation}));
  const before=JSON.stringify(layout.pads);
  const lattice=buildLattice(layout);
  const profile=resolveProfile(layout,0,resolveSettings({},undefined,layout.angleMode));
  const straight=[layout.pads[0]!.at,layout.pads[1]!.at];
  expect(sweepClear(layout,lattice,0,{a:straight[0]!,b:straight[1]!},profile,ignoreOf(0),profile.width).ok).toBe(true);
  expect(legaliseTrail(layout,lattice,0,straight,profile,ignoreOf(0)).ok).toBe(false);
  const report=route(layout,{viasAllowed:false,fanoutEnabled:false,ripupEnabled:false,optimizerEnabled:false,maxPasses:1,neckWidthUm:0});
  expect(report.incompleteAfter).toBe(0);
  expect(requiredConnections(layout)).toHaveLength(0);
  expect(checkDrc(layout).violations).toHaveLength(0);
  expect(layout.tracks.length).toBeGreaterThan(0);
  expect(layout.tracks.every(t=>t.width===2500 && t.pts.slice(1).every((b,i)=>{
    const a=t.pts[i]!;return a.x===b.x || a.y===b.y || Math.abs(a.x-b.x)===Math.abs(a.y-b.y);
  }))).toBe(true);
  expect(layout.barrels).toHaveLength(0);
  expect(JSON.stringify(layout.pads)).toBe(before);
});
