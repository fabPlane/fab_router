"""Native endpoint-preserving detour diagnostic; no acceptance policy changes."""
import gzip, importlib.util, json, pathlib, shutil, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parent
REPO=pathlib.Path('/home/hyper/bench/wt/fr-bugs')
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
sx=module('proposals',REPO/'tools/native-thermal-proposals.py')
gp=module('groups',REPO/'tools/native-terminal-groups.py')
fixture=REPO/'test/fixtures/native-aquarius-thermal'
source=sx.parse(gzip.decompress((fixture/'input.kicad_pcb.gz').read_bytes()).decode())
tracks=[sx.parse(s) for s in (fixture/'connectivity-added.sexpr').read_text().splitlines()]
out=ROOT/'results';out.mkdir(exist_ok=False);rows=[]
def check(nodes,name):
 d=out/name;d.mkdir();board=d/'board.kicad_pcb';board.write_text(sx.dump(nodes)+'\n')
 for ext in ('.kicad_pro','.kicad_dru'):shutil.copyfile(fixture/('board'+ext),board.with_suffix(ext))
 p=subprocess.run(['timeout','120','kicad-cli','pcb','drc','--severity-all','--format','json','--units','mm','--refill-zones','--save-board','--output',str(d/'drc.json'),str(board)],capture_output=True,text=True,timeout=130)
 (d/'native.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr
 groups=gp.terminal_groups(str(board));(d/'groups.json').write_text(json.dumps(groups)+'\n')
 membership={v:i for i,g in enumerate(groups) for v in g};report=json.loads((d/'drc.json').read_text())
 row=dict(name=name,opens=len(report['unconnected_items']),errors=[v['type'] for v in report['violations'] if v['severity']=='error'])
 for key,reference in [('lost_source_pairs',baseline if rows else groups),('lost_routed_pairs',routed if len(rows)>1 else groups)]:
  assert set(membership)=={v for g in reference for v in g}
  row[key]=sum(membership[a]!=membership[b] for g in reference for i,a in enumerate(g) for b in g[i+1:])
 rows.append(row);(out/'summary.json').write_text(json.dumps(rows,indent=2)+'\n');print(row,flush=True);return groups
baseline=check(source,'source');routed=check(source+tracks,'reduced')
for track_index,track in enumerate(tracks):
 for path_index,proposal in enumerate(sx.proposals(source+tracks,sx.uid(track))):
  check(sx.parse(proposal.decode()),f'track-{track_index}-path-{path_index}')
