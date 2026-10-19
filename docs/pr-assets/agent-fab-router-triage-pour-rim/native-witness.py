import pathlib,shutil,subprocess,json,collections,pcbnew,argparse,hashlib
# Disposable diagnostic only; no router output is accepted or scored.
a=argparse.ArgumentParser()
a.add_argument("--source",type=pathlib.Path,required=True)
a.add_argument("--out",type=pathlib.Path,required=True)
args=a.parse_args()
assert pcbnew.Version()=="10.0.6"
provenance=json.loads((pathlib.Path(__file__).parent/"provenance.json").read_text())
assert hashlib.sha256(args.source.read_bytes()).hexdigest()==provenance["source_sha256"]
args.out.mkdir(parents=True,exist_ok=False)
root=args.out
source=args.source
rows=[]
for repeat in range(1,4):
 for variant in ['original','via-witness']:
  out=root/f'native-{repeat}-{variant}';out.mkdir();board=out/'board.kicad_pcb';shutil.copyfile(source,board)
  for ext in ['kicad_pro','kicad_dru']:shutil.copyfile(source.with_suffix('.'+ext),board.with_suffix('.'+ext))
  if variant=='via-witness':
   b=pcbnew.LoadBoard(str(board));pad=next(p for f in b.GetFootprints() if f.GetReference()=='C5' for p in f.Pads() if p.GetNumber()=='2')
   assert pad.GetNetname()=='GNDA';v=pcbnew.PCB_VIA(b);v.SetPosition(pad.GetPosition());v.SetWidth(600000);v.SetDrill(300000);v.SetLayerPair(pcbnew.F_Cu,pcbnew.B_Cu);v.SetNetCode(pad.GetNetCode());b.Add(v);pcbnew.SaveBoard(str(board),b)
  with (out/'check.log').open('w') as log:subprocess.run(['kicad-cli','pcb','drc','--refill-zones','--save-board','--severity-all','--format','json','-o',str(out/'drc.json'),str(board)],check=True,stdout=log,stderr=log,timeout=90)
  d=json.loads((out/'drc.json').read_text());rows.append({'repeat':repeat,'variant':variant,'errors':dict(collections.Counter(x['type'] for x in d['violations'] if x['severity']=='error')),'opens':len(d['unconnected_items'])});print(rows[-1],flush=True)
assert all(r['errors']=={} and r['opens']==(1 if r['variant']=='original' else 0) for r in rows)
(root/'native-summary.json').write_text(json.dumps(rows,indent=2)+'\n')
