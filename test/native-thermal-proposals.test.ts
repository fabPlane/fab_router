import { expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("thermal proposals exclude reidentified authored tracks, including reversed numeric equivalents", async () => {
  const root = await mkdtemp(join(tmpdir(), "thermal-identities-"));
  const track = (id: string, start = "0 0", end = "1 1", width = "0.25") => `(segment (start ${start}) (end ${end}) (width ${width}) (layer "F.Cu") (net 1) (uuid "${id}"))`;
  const board = (tracks: string) => `(kicad_pcb ${tracks} (footprint (pad "1" smd circle (uuid "pad"))))`;
  try {
    await writeFile(join(root, "source"), board(track("authored")));
    await writeFile(join(root, "report"), JSON.stringify({ newErrors: [{ type: "starved_thermal", items: [{ uuid: "pad", pos: { x: 0, y: 0 } }] }] }));
    for (const [index, tracks, allowed] of [
      [0, track("imported"), []],
      [1, track("imported", "1.000 1e0", "0.0 -0", ".2500"), []],
      [2, track("imported") + track("duplicate"), []],
      [3, track("authored", "0 0", "2 2"), []],
      [4, track("imported") + track("generated", "1 1", "2 2"), ["generated"]],
      [5, track("different-width", "0 0", "1 1", "0.3"), ["different-width"]],
      [6, track("named").replace("(net 1)", '(net "GND")'), ["named"]],
      [7, track("named-import").replace("(net 1)", '(net "GND")'), []],
    ] as const) {
      await writeFile(join(root, "source"), board(index === 7 ? track("authored").replace("(net 1)", '(net "GND")') : track("authored")));
      await writeFile(join(root, "current"), board(tracks));
      const out = join(root, `out${index}`);
      const result = Bun.spawnSync(["python3", "tools/native-thermal-proposals.py", "--source", join(root, "source"), "--current", join(root, "current"), "--report", join(root, "report"), "--out", out]);
      expect(result.exitCode).toBe(0);
      const rows = JSON.parse(await readFile(join(out, "manifest.json"), "utf8")) as {label: [string, string | string[]]}[];
      expect([...new Set(rows.flatMap(row => typeof row.label[1] === "string" ? [row.label[1]] : row.label[1]))]).toEqual([...allowed]);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("axial thermal detours preserve endpoints, directions and the six-proposal bound", () => {
  const script = String.raw`
import importlib.util, sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('thermal', 'tools/native-thermal-proposals.py')
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
for start,end in [((0,0),(8,0)),((8,0),(0,0)),((0,0),(0,8)),((0,8),(0,0))]:
 paths=list(m.paths(start,end))
 assert len(paths)==6, (start,end,len(paths))
 assert len(set(tuple(p) for p in paths))==6
 for points in paths:
  assert points[0]==start and points[-1]==end
  assert len(points)==4 and all(a!=b for a,b in zip(points,points[1:]))
  for a,b in zip(points,points[1:]):
   dx,dy=abs(b[0]-a[0]),abs(b[1]-a[1])
   assert dx==0 or dy==0 or dx==dy
assert list(m.paths((1,1),(1,1)))==[]
assert len(list(m.paths((0,0),(8,8))))==6
`;
  const result = Bun.spawnSync(["python3", "-c", script]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

test("axial proposals follow the complete existing diagonal and pair prefix", async () => {
  const root = await mkdtemp(join(tmpdir(), "thermal-order-"));
  const header = '(kicad_pcb (footprint (pad "1" smd circle (uuid "pad")))';
  const track = (id: string, end: string) => `(segment (start 0 0) (end ${end}) (width 0.25) (layer "F.Cu") (net 1) (uuid "${id}"))`;
  try {
    await writeFile(join(root, "source"), header + ")");
    await writeFile(join(root, "current"), header + track("axial", "1 0") + track("diagonal", "1 1") + ")");
    await writeFile(join(root, "report"), JSON.stringify({ newErrors: [{ type: "starved_thermal", items: [{ uuid: "pad", pos: { x: 0, y: 0 } }] }] }));
    const out = join(root, "out");
    const result = Bun.spawnSync(["python3", "tools/native-thermal-proposals.py", "--source", join(root, "source"), "--current", join(root, "current"), "--report", join(root, "report"), "--out", out]);
    expect(result.exitCode).toBe(0);
    const rows = JSON.parse(await readFile(join(out, "manifest.json"), "utf8")) as {label: unknown}[];
    expect(rows.map(row => row.label)).toEqual([
      ...Array.from({ length: 6 }, () => ["segment", "diagonal"]),
      ...Array.from({ length: 15 }, () => ["pair", ["axial", "diagonal"]]),
      ...Array.from({ length: 6 }, () => ["segment", "axial"]),
      ...Array.from({ length: 6 }, () => ["short-axial", "axial"]),
    ]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("short axial thermal paths scale with width and retain endpoints without degenerate segments", () => {
  const script = String.raw`
import importlib.util,sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('thermal','tools/native-thermal-proposals.py')
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
for start,end in [((0,0),(8,0)),((8,0),(0,0)),((0,0),(0,8)),((0,8),(0,0))]:
 paths=list(m.short_paths(start,end,.2))
 assert len(paths)==6
 assert len(set(tuple(p) for p in paths))==6
 assert abs(paths[0][1][0]-start[0])==.06 or abs(paths[0][1][1]-start[1])==.06
 for points in paths:
  assert points[0]==start and points[-1]==end
  assert all(a!=b for a,b in zip(points,points[1:]))
  for a,b in zip(points,points[1:]):
   dx,dy=abs(b[0]-a[0]),abs(b[1]-a[1])
   assert dx==0 or dy==0 or abs(dx-dy)<1e-12
assert list(m.short_paths((0,0),(1,1),.2))==[]
assert list(m.short_paths((0,0),(0,0),.2))==[]
assert len(list(m.short_paths((0,0),(.01,0),.2)))==2
`;
  const result = Bun.spawnSync(["python3", "-c", script]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

test("short axial proposals never displace a full 304-proposal prefix", async () => {
  const root = await mkdtemp(join(tmpdir(), "thermal-full-prefix-"));
  const header = '(kicad_pcb (footprint (pad "1" smd circle (uuid "pad")))';
  try {
    await writeFile(join(root,"source"),header+")");
    const tracks = Array.from({length:8},(_,i)=>`(segment (start 0 0) (end ${i+3} 0) (width 0.2) (layer "F.Cu") (net 1) (uuid "track-${i}"))`).join(" ");
    await writeFile(join(root,"current"),header+tracks+")");
    await writeFile(join(root,"report"),JSON.stringify({newErrors:[{type:"starved_thermal",items:[{uuid:"pad",pos:{x:0,y:0}}]}]}));
    const out=join(root,"out");
    const process=Bun.spawn(["python3","tools/native-thermal-proposals.py","--source",join(root,"source"),"--current",join(root,"current"),"--report",join(root,"report"),"--out",out],{stdout:"ignore",stderr:"pipe"});
    expect(await process.exited).toBe(0);
    const rows=JSON.parse(await readFile(join(out,"manifest.json"),"utf8")) as {label:string[]}[];
    expect(rows).toHaveLength(304);
    expect(rows.filter(r=>r.label[0]==="pair")).toHaveLength(256);
    expect(rows.filter(r=>r.label[0]==="segment")).toHaveLength(48);
    expect(rows.some(r=>r.label[0]==="short-axial")).toBe(false);
  } finally {await rm(root,{recursive:true,force:true});}
});
