"""Fresh native-save replay of all183 archived boards; destination must be absent."""
import pathlib,shutil,subprocess,sys
root=pathlib.Path(__file__).resolve().parent
out=pathlib.Path(sys.argv[1]);assert not out.exists()
shutil.copytree(root,out,ignore=shutil.ignore_patterns('before-tools','measure','__pycache__'))
for name in ('audit','audit-roles','axial/native'):
 for submitted in sorted((out/name).rglob('submitted.kicad_pcb')):
  d=submitted.parent;shutil.copyfile(submitted,d/'board.kicad_pcb')
  p=subprocess.run(['kicad-cli','pcb','drc','--severity-all','--format','json','--units','mm','--refill-zones','--save-board','--output',str(d/'report.json'),str(d/'board.kicad_pcb')],capture_output=True,text=True,timeout=120)
  (d/'native.log').write_text(p.stdout+p.stderr);assert p.returncode==0,(d,p.stderr)
subprocess.run(['python3',str(out/'verify.py'),str(out)],check=True,timeout=120)
