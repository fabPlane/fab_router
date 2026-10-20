import {prepareRing,pointInRing} from './candidate/src/geom/predicates.ts';
let checks=0, seed=95;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
for(let trial=0;trial<100;trial++){
 const n=3+Math.floor(random()*200);
 const ring=Array.from({length:n},(_,i)=>{const a=i/n*2*Math.PI,r=100+random()*900;return {x:Math.round(Math.cos(a)*r),y:Math.round(Math.sin(a)*r)}});
 if(trial%2)ring.reverse();
 const prepared=prepareRing(ring);
 const probes=ring.flatMap((p,i)=>{const q=ring[(i+1)%n]!;return [p,{x:(p.x+q.x)/2,y:(p.y+q.y)/2}]});
 for(let i=0;i<2000;i++)probes.push({x:Math.floor(random()*2400)-1200,y:Math.floor(random()*2400)-1200});
 for(const p of probes){checks++;if(prepared(p)!==pointInRing(ring,p))throw Error(JSON.stringify({trial,p}));}
 const p={x:0,y:0},expected=prepared(p);for(const q of ring){q.x+=10000;q.y+=10000;}if(prepared(p)!==expected)throw Error('snapshot mutation');checks++;
}
console.log(JSON.stringify({checks,status:'PASS',scope:'finite radial rings, reversed winding, vertices, midpoints, random probes, snapshot ownership'}));
const {emptyLayout}=await import('./candidate/src/layout/index.ts');
const {createLattice,RIM_ID}=await import('./candidate/src/lattice/index.ts');
const {withinRim}=await import('./candidate/src/geom/onboard.ts');
const layout=emptyLayout();
const rim={outline:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],cutouts:[]};
const lattice=createLattice(layout);
const shapes=[{kind:'disk' as const,c:{x:50,y:50},r:1}];
function check(){if((lattice.rimContains ? lattice.rimContains(rim,shapes) : withinRim(rim,shapes))!==withinRim(rim,shapes))throw Error('lifecycle');}
check();lattice.insertItem('rim',rim);check();lattice.rebuild();check();lattice.removeItem(RIM_ID);rim.outline.forEach(p=>p.x+=1000);check();lattice.insertItem('rim',rim);check();
const replacement={outline:rim.outline.map(p=>({x:p.x-1000,y:p.y})),cutouts:[]};lattice.insertItem('rim',replacement);check();
console.log('lifecycle PASS: absent, insert, rebuild, remove, mutate/reinsert, replace, foreign rim fallback');

const big={outline:Array.from({length:64},(_,i)=>({x:100*Math.cos(i*Math.PI/32),y:100*Math.sin(i*Math.PI/32)})),cutouts:[]};
if(lattice.rimContains)throw Error('small rim did not bypass');
lattice.insertItem('rim',big);
if(!lattice.rimContains)throw Error('large rim did not prepare');
for(let x=-110;x<=110;x+=2)for(let y=-110;y<=110;y+=2){const ss=[{kind:'disk' as const,c:{x,y},r:1}];if(lattice.rimContains(big,ss)!==withinRim(big,ss))throw Error('large rim');}
lattice.rebuild();if(!lattice.rimContains)throw Error('rebuild lost index');
lattice.removeItem(RIM_ID);if(lattice.rimContains)throw Error('removal retained index');
lattice.insertItem('rim',big);lattice.insertItem('rim',replacement);if(lattice.rimContains)throw Error('replacement retained index');
console.log('hybrid PASS: small bypass, 64-edge preparation, 12321 large-rim probes, rebuild, remove, replace');
