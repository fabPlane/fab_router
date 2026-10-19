import { expect, test } from "bun:test";
import { routeSrj, route } from "../src/api.ts";
import { buildSrjLayout, extractTraces } from "../src/srj/index.ts";
import type { SimpleRouteJson } from "../spec/types/srj.ts";
import type { Track } from "../spec/types/layout.ts";
const branch: SimpleRouteJson = {
  "layerCount": 2,
  "minTraceWidth": 0.2,
  "bounds": {
    "minX": 0,
    "maxX": 20,
    "minY": 0,
    "maxY": 12
  },
  "obstacles": [
    {
      "type": "rect",
      "layers": [
        "top"
      ],
      "center": {
        "x": 2,
        "y": 5
      },
      "width": 1.2,
      "height": 1,
      "connectedTo": [
        "NET1"
      ]
    },
    {
      "type": "rect",
      "layers": [
        "top"
      ],
      "center": {
        "x": 18,
        "y": 5
      },
      "width": 1.2,
      "height": 1,
      "connectedTo": [
        "NET1"
      ]
    },
    {
      "type": "rect",
      "layers": [
        "top"
      ],
      "center": {
        "x": 10,
        "y": 9
      },
      "width": 1.2,
      "height": 1,
      "connectedTo": [
        "NET1"
      ]
    }
  ],
  "connections": [
    {
      "name": "NET1",
      "pointsToConnect": [
        {
          "x": 2,
          "y": 5,
          "layer": "top"
        },
        {
          "x": 18,
          "y": 5,
          "layer": "top"
        },
        {
          "x": 10,
          "y": 9,
          "layer": "top"
        }
      ]
    }
  ]
}
;
test("real three-terminal route exports exactly the routed track runs", () => {
  const built = buildSrjLayout(branch);
  expect(route(built.layout, {}).incompleteAfter).toBe(0);
  const tracks = built.layout.tracks.filter(t => t.origin === "router");
  expect(tracks.length).toBe(2);
  const result = routeSrj(branch, {});
  expect(result.report.incompleteAfter).toBe(0);
  expect(result.srj.traces!.length).toBe(tracks.length);
  for (const t of tracks) {
    const trace = result.srj.traces!.find(x => x.pcb_trace_id.endsWith(`_track_${t.id}`))!;
    expect(trace.connection_name).toBe("NET1");
    const mm = (v:number) => Math.round(v / built.layout.frame.luPerUnit * 1e6) / 1e6;
    expect(trace.route).toEqual(t.pts.map(p => ({ route_type:"wire",x:mm(p.x),y:mm(p.y),width:mm(t.width),layer:"top" })));
  }
});
test("disconnected tracks retain layer and width; barrels never create planar segments", () => {
  const b = buildSrjLayout(branch);
  const net = b.netByConnection.get("NET1")!;
  for (const reverse of [false,true]) for (const ids of [[1,2],[2,1]]) {
    const track = (id:number,sheet:number,width:number,x:number): Track => ({id,sheet,width,net,
      pts: reverse ? [{x:x+1000,y:0},{x,y:0}] : [{x,y:0},{x:x+1000,y:0}],kind:1,hold:"free",origin:"router"});
    b.layout.tracks = [track(ids[0]!,0,200,0),track(ids[1]!,1,300,10000)];
    b.layout.barrels = [{id:1,net,at:{x:20000,y:1000},form:0,fromSheet:0,toSheet:1,kind:1,hold:"free",origin:"router"}];
    const before = JSON.stringify(b.layout);
    const traces = extractTraces(b.layout,b.connectionByNet,b.layerBySheet);
    expect(JSON.stringify(b.layout)).toBe(before);
    expect(traces.length).toBe(3);
    expect(new Set(traces.map(t => t.pcb_trace_id)).size).toBe(3);
    expect(traces.map(t => t.route.length).sort()).toEqual([1,2,2]);
    expect(traces.flatMap(t => t.route).filter(s => s.route_type === "wire").map(s => s.width).sort()).toEqual([0.2,0.2,0.3,0.3]);
    expect(traces.find(t => t.route[0]!.route_type === "via")!.route).toEqual([{route_type:"via",x:20,y:1,from_layer:"top",to_layer:"bottom"}]);
  }
});
