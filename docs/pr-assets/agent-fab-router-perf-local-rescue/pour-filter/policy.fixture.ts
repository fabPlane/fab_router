/** Scratch-candidate policy regression; requires POUR_FILTER_SOURCE. */
import {expect, test} from 'bun:test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const source=process.env.POUR_FILTER_SOURCE;
if(!source)throw Error('POUR_FILTER_SOURCE required');
const load=(p:string)=>import(pathToFileURL(resolve(source,p)).href);
const {createLattice}=await load('src/lattice/index.ts');
const {emptyLayout}=await load('src/layout/index.ts');
const {dop8OfPts}=await load('src/geom/index.ts');
const q=dop8OfPts([{x:-200000,y:-200000},{x:200000,y:200000}]);
function fixture(){
  const lattice=createLattice(emptyLayout('policy'),{cellSize:1000,luPerUm:1});
  const pour={id:2,net:1,sheet:0,kind:1,hold:'free',outline:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],holes:[],origin:'file'};
  lattice.insertItem('pour',pour);
  lattice.insert({id:1},0,dop8OfPts([{x:0,y:0}]));
  return {lattice,pour};
}
test('ordinary pour excluded only from explicit routing policy; raw slots preserved',()=>{
  const {lattice}=fixture();
  expect(lattice.sweepHits(0,q)).toEqual([{id:1},{id:2}]);
  expect(lattice.hits(0,q)).toEqual([{id:1},{id:2}]);
  expect(lattice.sweepHits(0,q,undefined,true)).toEqual([{id:1}]);
});
test('live prior metadata, replacement, removal and free-slot reuse',()=>{
  const {lattice,pour}=fixture();
  pour.origin='prior';
  expect(lattice.sweepHits(0,q,undefined,true)).toEqual([{id:1},{id:2}]);
  pour.origin='file';
  expect(lattice.sweepHits(0,q,undefined,true)).toEqual([{id:1}]);
  lattice.insertItem('pour',{...pour,origin:'prior'});
  lattice.rebuild(500);
  expect(lattice.sweepHits(0,q,undefined,true)).toEqual([{id:1},{id:2}]);
  lattice.removeItem(2);
  lattice.insert({id:2},0,dop8OfPts([{x:0,y:0}]));
  expect(lattice.sweepHits(0,q,undefined,true)).toEqual([{id:1},{id:2}]);
});
test('shelf path and retained result snapshot obey policy',()=>{
  const {lattice,pour}=fixture();
  lattice.insertItem('pour',{...pour,outline:[{x:-100000,y:-100000},{x:100000,y:-100000},{x:100000,y:100000},{x:-100000,y:100000}]});
  const snapshot=lattice.sweepHits(0,q,undefined,true);
  expect(snapshot).toEqual([{id:1}]);
  lattice.insertItem('pour',{...pour,origin:'prior'});
  expect(lattice.sweepHits(0,q,undefined,true)).toEqual([{id:1},{id:2}]);
  expect(snapshot).toEqual([{id:1}]);
});
