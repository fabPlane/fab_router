const { aStar, aStarLayered, DIRS_8 } = await import(process.argv[2]!);
const free = (x: number, y: number) => x !== 15 || y === 29;
const space = { step: 1, pointOf: (x: number, y: number) => ({ x, y }), nodeFree: free,
 edgeCost: (_a: unknown, b: {x:number;y:number}) => ({ blocked: !free(b.x,b.y), extra:0,rip:[] }) };
const options = { start:{gx:14,gy:0},goal:{gx:16,gy:0},region:{gx0:0,gy0:0,gx1:29,gy1:29},
 dirs:DIRS_8,stepCost:()=>1,minCost:1,bendCost:10,maxPops:4000 };
const runs=[];
for(let repeat=1;repeat<=3;repeat++) {
 const single=aStar(space,options);
 const layered=aStarLayered({...space,layers:1,nodeFree:(_l:number,x:number,y:number)=>free(x,y),
  edgeCost:(_l:number,a:unknown,b:{x:number;y:number})=>space.edgeCost(a,b),viaMove:()=>null},
  {...options,starts:[{layer:0,...options.start}],goalCell:options.goal,goalLayers:[0],viaFloor:0});
 runs.push({repeat,single,layered});
}
console.log(JSON.stringify(runs,null,2));
