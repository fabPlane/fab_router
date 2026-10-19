import pathlib,subprocess,shutil,json,hashlib
root=pathlib.Path(__file__).resolve().parent;out=root/'audit-final';out.mkdir(exist_ok=False)
for name,source in [('rewired',root/'control'),('actual',root/'native/004')]:
 d=out/name;d.mkdir();groups=[]
 for role in ['input','candidate']:
  t=d/role;shutil.copytree(source/role,t)
  board=t/'board.kicad_pcb';report=t/'report.json'
  p=subprocess.run(['taskset','-c','20-25','nice','-n','10','timeout','130','kicad-cli','pcb','drc','--severity-all','--format','json','--units','mm','--refill-zones','--save-board','--output',str(report),str(board)],capture_output=True,text=True,timeout=140)
  (t/'native.log').write_text(p.stdout+p.stderr);assert p.returncode==0
  p=subprocess.run(['python3',str(root/'audit-pads.py'),str(board)],capture_output=True,text=True,timeout=130)
  (t/'pads.log').write_text(p.stderr);assert p.returncode==0,p.stderr
  result=json.loads(p.stdout);(t/'groups.json').write_text(json.dumps(result,indent=2)+'\n');groups.append(result)
 a,b=groups;assert a.keys()==b.keys()
 losses=sorted([x,y] for x in a for y in a[x] if x<y and y not in b[x])
 expected=2 if name=='rewired' else 17
 assert len(losses)==expected,(name,len(losses))
 (d/'summary.json').write_text(json.dumps(dict(lost_terminal_pairs=len(losses),lost_pairs=losses,native_api='GetConnectedItems; independent pad-identity replay'),indent=2)+'\n');print(name,len(losses),flush=True)
