"""Compare complete same-host default router runs without treating controls as scores."""
import pathlib,json,hashlib,sys,statistics,importlib.util,collections
from decimal import Decimal,InvalidOperation
sys.dont_write_bytecode=True
R=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('p',R/'runtime-tools/native-thermal-proposals.py');p=importlib.util.module_from_spec(spec);sys.modules[spec.name]=p;spec.loader.exec_module(p)
def canon(n):
 if isinstance(n,list) and n[0]=='segment':return ('segment',tuple(sorted(tuple(Decimal(v).normalize() for v in p.child(n,k)[1:]) for k in ('start','end'))),tuple(canon(x) for x in n[1:] if not(isinstance(x,list) and x[0] in ('uuid','tstamp','start','end'))))
 if isinstance(n,list):return tuple(canon(x) for x in n if not(isinstance(x,list) and x[0] in ('uuid','tstamp')))
 try:return str(Decimal(n).normalize()) if not n.startswith('"') else n
 except InvalidOperation:return n
def copper(f):return sorted(repr(canon(n)) for n in p.parse(f.read_text()) if isinstance(n,list) and n[0] in ('segment','via','arc'))
read=lambda f:json.loads(f.read_text());phases=['full-before','full-router'];controls=[read(R/f/'controls.json') for f in phases]
for c in controls:assert c['complete'] and c['controls_preserved'] and not c['interrupted'] and c['allowed_cpus']==[20,21,22,23,24,25] and c['seeds']==[1,2,3]
for k in ('order','inputs_sha256','harness_sha256','runtime_sha256','runtime_source_sha256','allowed_cpus','cases','seeds'):assert controls[0][k]==controls[1][k],k
assert controls[0]['candidate']['source_sha256']==controls[1]['candidate']['source_sha256']
results=[read(R/f/'results.json') for f in phases];maps=[{(x['case'],x['seed']):x for x in rows} for rows in results];assert maps[0].keys()==maps[1].keys() and len(maps[0])==78
for key,b in maps[0].items():
 a=maps[1][key]
 for f in ('status','passed','opens','new_errors','new_error_types','failed_fidelity','vias'):assert a[f]==b[f],(key,f)
 for f in ('fidelity','integrity_checks','ignored_checks','new_warnings','new_warning_types'):assert a['check'][f]==b['check'][f],(key,f)
 assert copper(R/phases[0]/b['evidence']/'work/output.kicad_pcb')==copper(R/phases[1]/a['evidence']/'work/output.kicad_pcb'),(key,'copper')
 for f in ('board.dsn','board.ses'):assert (R/phases[0]/b['evidence']/'work'/f).read_bytes()==(R/phases[1]/a['evidence']/'work'/f).read_bytes(),(key,f)
summaries=[]
for phase,rows in zip(phases,results):
 summary=read(R/phase/'summary.json');assert summary['complete'] and summary['completed_runs']==78
 summaries.append(dict(phase=phase,runs=78,passed=sum(x['passed'] for x in rows),validCases=summary['routers'][0]['valid_cases'],opens=sum(x['opens'] for x in rows),newErrors=sum(x['new_errors'] for x in rows),medianRouteSeconds=statistics.median(x['seconds'] for x in rows),aquarius=[{k:x[k] for k in ('seed','passed','opens','new_errors','new_error_types')} for x in rows if x['case']=='kitspace-aquarius-j4']))
print(json.dumps(dict(beforeAfter=summaries,sameCasesSeedsMachineControls=True,sameSourceHashes=True,all78PhysicalCopperOutcomesDsnSesMatch=True,productionChange=False,noSpeedClaim=True),indent=2))
