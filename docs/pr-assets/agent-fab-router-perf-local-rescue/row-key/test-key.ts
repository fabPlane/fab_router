import {strict as a} from 'node:assert';
const OFFSET=1<<25, STRIDE=1<<26;
let seed=0x12345678,checks=0;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)|0;return seed>>>0;}
const edges=[-OFFSET,-OFFSET+1,-1,0,1,OFFSET-2,OFFSET-1];
for(let i=0;i<100000;i++){
 const cx=i<edges.length?edges[i]!:rnd()%(2*OFFSET)-OFFSET;
 const cy=i<edges.length?edges[edges.length-1-i]!:rnd()%(2*OFFSET)-OFFSET;
 const original=(x:number,y:number)=>(x+OFFSET)*STRIDE+(y+OFFSET);
 const row=(cx+OFFSET)*STRIDE;
 a.equal(row+(cy+OFFSET),original(cx,cy));checks++;
}
console.log('PASS',checks,'exact numeric key comparisons across supported signed cell coordinates');
