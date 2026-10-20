"""Keep complete result metadata and selected regression/improvement native evidence."""
import gzip,json,tarfile,sys
from pathlib import Path
base,bench,asset=map(Path,sys.argv[1:]);selected={'paperino-hw-paperino-shield-j4','kitspace-aquarius-j4','nextbusclock-nextbusclockv1-j3'}
for mode in ['before','after']:
 root=base/f'native-{mode}'
 for name in ['results','controls','summary']:
  (asset/f'native-{mode}-{name}.json.gz').write_bytes(gzip.compress((root/f'{name}.json').read_bytes(),mtime=0))
with tarfile.open(asset/'native-evidence.tar.gz','w:gz')as tar:
 for mode in ['before','after']:
  root=base/f'native-{mode}'
  for name in ['results.json','controls.json','summary.json']:tar.add(root/name,arcname=f'{mode}/{name}')
  rows=json.loads((root/'results.json').read_text())
  for row in rows:
   if row['case']not in selected:continue
   rel=Path(row['evidence']);p=root/rel
   names=['check.json','record.json','work/board.ses','work/router-summary.json']
   if row['seed']==1:names+=['final.kicad_pcb','refilled.kicad_pcb','final.kicad_pro','final.kicad_dru','drc.json','refill-drc.json','work/board.dsn','work/candidate-settings.json','work/dsn-manifest.json']
   for name in names:
    if not (p/name).exists():
     assert name in ['refilled.kicad_pcb','refill-drc.json'],name
     continue
    tar.add(p/name,arcname=str(Path(mode)/rel/name))
 for case in sorted(selected):
  root=bench/'benchmarks/autorouter/cases'/case
  for name in ['board.kicad_pcb','board.kicad_pro','board.kicad_dru','job.json','baseline-drc.json','LICENSE']:
   tar.add(root/name,arcname=f'case-provenance/{case}/{name}')
print(asset/'native-evidence.tar.gz')
