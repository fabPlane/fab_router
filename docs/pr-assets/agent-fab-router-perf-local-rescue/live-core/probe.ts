// SPDX-License-Identifier: GPL-3.0-only
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
const root=process.argv[2]!;
const load=async(p:string)=>import(pathToFileURL(resolve(root,p)).href);
const {prepareShape,closerPreparedConvex}=await load('src/lattice/prepared-core.ts');
const {coreOf,dist2Pts}=await load('src/geom/distance.ts');
const {closerThan,overlaps}=await load('src/route/clear.ts');
const control=await import(pathToFileURL(resolve(root,'../control/src/route/clear.ts')).href);
let checks=0;
function check(v:unknown){checks++;if(!v)throw Error('check '+checks);}
const shapes:any[]=[{kind:'disk',c:{x:0,y:0},r:4},{kind:'capsule',a:{x:0,y:0},b:{x:0,y:0},r:2},{kind:'box',x0:0,x1:10,y0:0,y1:10},{kind:'hull',pts:[{x:0,y:0},{x:10,y:0},{x:0,y:10}]},{kind:'rounded',pts:[{x:0,y:0},{x:10,y:0},{x:0,y:10}],r:3}];
const target={kind:'capsule',a:{x:12,y:-10},b:{x:12,y:20},r:1};
function compare(){for(const a of shapes)for(const b of [...shapes,target])for(const n of [0,1,2,5,10,20]){
 const ca=coreOf(a),cb=coreOf(b),need=n+ca.r+cb.r,d=dist2Pts(ca.pts,cb.pts);
 check(closerPreparedConvex(a,b,n,false)===(d<need*need));
 check(closerPreparedConvex(a,b,n,true)===(d<=need*need));
 check(closerThan(a,b,n)===control.closerThan(a,b,n));check(overlaps(a,b)===control.overlaps(a,b));
}}
// Public wrappers and disk/capsule arrays stay independent even after preparation.
for(const s of shapes){prepareShape(s);const a=coreOf(s),b=coreOf(s);check(a!==b);if(s.kind==='disk'||s.kind==='capsule'||s.kind==='box')check(a.pts!==b.pts);}
prepareShape({kind:'pieces',parts:shapes});prepareShape(target);compare();
shapes[0].c={x:20,y:20};shapes[0].r=7;
shapes[1].b={x:20,y:0};shapes[1].r=5;
shapes[2].x0=20;shapes[2].x1=-10;shapes[2].y0=shapes[2].y1=5;
shapes[3].pts=[{x:3,y:3},{x:8,y:3},{x:3,y:8}];
shapes[4].pts=[{x:2,y:2},{x:9,y:2},{x:2,y:9}];shapes[4].r=1;compare();
shapes[1].a=shapes[1].b;shapes[2].x0=shapes[2].x1;compare();
let seed=42;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;}
for(let k=0;k<300;k++){
 shapes[0].c.x=rand()%100-50;shapes[0].c.y=rand()%100-50;shapes[0].r=rand()%10;
 shapes[1].a={x:rand()%100-50,y:rand()%100-50};shapes[1].b=k%3?{x:rand()%100-50,y:rand()%100-50}:shapes[1].a;
 shapes[2].x0=rand()%100-50;shapes[2].x1=k%3?rand()%100-50:shapes[2].x0;
 shapes[2].y0=rand()%100-50;shapes[2].y1=k%2?rand()%100-50:shapes[2].y0;
 compare();
}
const {createLattice}=await load('src/lattice/grid.ts');const {emptyLayout}=await load('src/layout/index.ts');
const lattice=createLattice(emptyLayout('prepared'),{luPerUm:10});
const track={id:101,sheet:0,net:1,width:10,pts:[{x:0,y:0},{x:100,y:0}]};lattice.insertItem('track',track);
const first=lattice.shapesOf(101,0,0)[0];check(first===lattice.shapesOf(101,0,0)[0]);
lattice.rebuild();check(first===lattice.shapesOf(101,0,0)[0]);
for(const x of [0,1,100,200]){track.pts[1]!.x=x;check(closerPreparedConvex(first,target,3,false)===control.closerThan(first,target,3));}
lattice.removeItem(101);check(lattice.shapesOf(101,0,0).length===0);lattice.insertItem('track',track);const second=lattice.shapesOf(101,0,0)[0];check(first!==second);
check(closerPreparedConvex(second,target,3,false)===control.closerThan(second,target,3));
// Mixed registration, same-identity operands, and independently mutable public wrappers.
for(const a of shapes){
 const foreign={kind:'disk',c:{x:7,y:9},r:2};
 for(const [left,right]of [[a,foreign],[foreign,a],[a,a]])for(const n of [1,5,20]){
  check(closerPreparedConvex(left,right,n,false)===control.closerThan(left,right,n));
  check(closerPreparedConvex(left,right,0,true)===control.overlaps(left,right));
 }
 const publicCore=coreOf(a);publicCore.r=987;
 if(a.kind==='disk'||a.kind==='capsule'||a.kind==='box')publicCore.pts.length=0;
 check(closerPreparedConvex(a,foreign,5,false)===control.closerThan(a,foreign,5));
}
console.log('PASS '+checks+' live mutation, replacement, degeneration, fresh public wrapper, comparison and lattice lifecycle checks');
