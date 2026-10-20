// SPDX-License-Identifier: GPL-3.0-only
// Experimental internal borrowed cores. Never expose or mutate a returned wrapper outside
// this module. Public coreOf remains fresh. Registration follows lazy lattice shape creation;
// weak keys do not retain removed geometry. All live shape fields are reread at each borrow.
import type { ConvexShape, Core, Shape } from "../geom/types.ts";
import { coreOf, dist2Pts } from "../geom/distance.ts";
interface Record { core: Core; box: [number,number,number,number] | undefined }
const records = new WeakMap<ConvexShape, Record>();
export function prepareShape(s: Shape): void {
  if (s.kind === "pieces") { for (const p of s.parts) prepareShape(p); return; }
  if (records.has(s)) return;
  records.set(s,{core:coreOf(s),box:s.kind==="box"?[s.x0,s.x1,s.y0,s.y1]:undefined});
}
function borrow(s: ConvexShape): Core {
  const rec=records.get(s);
  if (!rec) return coreOf(s);
  const c=rec.core;
  switch(s.kind) {
    case "disk": c.pts[0]=s.c; c.r=s.r; break;
    case "capsule": {
      c.pts[0]=s.a;
      if(s.a.x===s.b.x&&s.a.y===s.b.y) c.pts.length=1;
      else {c.pts[1]=s.b;c.pts.length=2;}
      c.r=s.r; break;
    }
    case "hull": c.pts=s.pts; break;
    case "rounded": c.pts=s.pts;c.r=s.r;break;
    case "box": {
      const b=rec.box!;
      if(!Object.is(b[0],s.x0)||!Object.is(b[1],s.x1)||!Object.is(b[2],s.y0)||!Object.is(b[3],s.y1)) {
        rec.core=coreOf(s); b[0]=s.x0;b[1]=s.x1;b[2]=s.y0;b[3]=s.y1;
      }
      break;
    }
  }
  return rec.core;
}
export function closerPreparedConvex(a:ConvexShape,b:ConvexShape,required:number,orTouching:boolean):boolean {
  const ca=borrow(a),cb=borrow(b);
  const need=required+ca.r+cb.r;
  const d2=dist2Pts(ca.pts,cb.pts);
  return orTouching?d2<=need*need:d2<need*need;
}
