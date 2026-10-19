/** Scratch-only transformation; production source is read, never modified.
 * Retain at most maxNodes-2 unique corners with the smallest sum of endpoint
 * distances. A max heap bounds storage and charges before every comparison.
 * Final coordinate order is deterministic; original endpoint indices stay 0,1.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function makeCandidate(out:string){
 const source=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../src/route/visibility-recovery.ts');
 let s=readFileSync(source,'utf8');
 if(createHash('sha256').update(s).digest('hex')!=='9485d946c33a87a8e2ffbe86a871905ca357a51e5269c5e0f918faded63275a8')throw Error('Unmeasured visibility source');
 s=s.replace(/from '([^']+)'/g,(_,p)=>`from '${resolve(dirname(source),p)}'`);
 const start=s.indexOf('  const add=(p:Pt)=>{'),end=s.indexOf('  // Corners are',start);
 if(start<0||end<0)throw Error('Source shape changed');
 s=s.slice(0,start)+`
  type Candidate={p:Pt;score:number};
  const heap:Candidate[]=[];
  const worse=(a:Candidate,b:Candidate)=>{
   trial.expand();return a.score>b.score||(a.score===b.score&&(a.p.x>b.p.x||(a.p.x===b.p.x&&a.p.y>b.p.y)));
  };
  const add=(p:Pt)=>{
   trial.expand();
   if(!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||p.x-h<r.x0||p.x+h>r.x1||p.y-h<r.y0||p.y+h>r.y1)return;
   const key=p.x+','+p.y;if(keys.has(key)||maxNodes===2)return;
   const entry={p,score:Math.hypot(p.x-from.at.x,p.y-from.at.y)+Math.hypot(p.x-to.at.x,p.y-to.at.y)};
   if(heap.length<maxNodes-2){
    keys.add(key);heap.push(entry);let i=heap.length-1;
    while(i>0){const parent=(i-1)>>1;if(!worse(heap[i]!,heap[parent]!))break;[heap[i],heap[parent]]=[heap[parent]!,heap[i]!];i=parent;}
   }else if(worse(heap[0]!,entry)){
    keys.delete(heap[0]!.p.x+','+heap[0]!.p.y);keys.add(key);heap[0]=entry;let i=0;
    while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&worse(heap[child+1]!,heap[child]!))child++;
     if(!worse(heap[child]!,heap[i]!))break;[heap[i],heap[child]]=[heap[child]!,heap[i]!];i=child;}
   }
  };
`+s.slice(end);
 const anchor='  totalNodes+=nodes.length;';
 if(s.split(anchor).length!==2)throw Error('Missing single node marker');
 s=s.replace(anchor,`  // Heap extraction uses charged comparisons and preserves the best-first order.
  const ordered:Pt[]=[];
  while(heap.length){
   trial.expand();ordered.push(heap[0]!.p);const tail=heap.pop()!;if(!heap.length)break;heap[0]=tail;let i=0;
   while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&worse(heap[child+1]!,heap[child]!))child++;
    if(!worse(heap[child]!,heap[i]!))break;[heap[i],heap[child]]=[heap[child]!,heap[i]!];i=child;}
  }
  nodes.push(...ordered.reverse());
`+anchor);
 const path=resolve(out,'selected-visibility.ts');writeFileSync(path,s);
 return (await import(path)).proposeVisibility;
}
