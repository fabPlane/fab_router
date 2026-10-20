import json,gzip,hashlib,importlib.util,copy,sys
from pathlib import Path
sys.dont_write_bytecode=True
p=Path('docs/pr-assets/agent-fab-router-perf-local-rescue');out=p/'reachability';scratch=Path(sys.argv[1])
spec=importlib.util.spec_from_file_location('report',out/'report.py');report=importlib.util.module_from_spec(spec);spec.loader.exec_module(report)
raw=[(scratch/f'reach-{i}.json').read_bytes() for i in (1,2,3)];assert raw[0]==raw[1]==raw[2];data=json.loads(raw[0]);report.validate(data)
census=json.loads(gzip.decompress((p/'candidate-coverage/results.json.gz').read_bytes()))
for row in data['rows']:
 old=next(r for r in census['rows'] if r['case']==row['case'] and r['target']==row['target'] and r['margin']==64 and r['sheet']==row['sheet'])
 assert old['nodeSha256']==row['nodeSha256'] and old['nodes']==len(row['nodes']) and old['dsnSha256']==row['dsnSha256'] and old['sesSha256']==row['sesSha256']
 assert old['exits']==len(row['adjacency'][0]) and old['entries']==sum(1 in a for a in row['adjacency'][2:])
controls={}
for name in ('missing-row','node-coordinate','false-path','false-reachability'):
 d=copy.deepcopy(data)
 if name=='missing-row':d['rows'].pop()
 if name=='node-coordinate':d['rows'][0]['nodes'][0]['x']+=1
 if name=='false-path':d['rows'][0]['adjacency'][0]=sorted(set(d['rows'][0]['adjacency'][0]+[1]))
 if name=='false-reachability':d['rows'][0]['reachable']=True
 try:report.validate(d)
 except AssertionError:controls[name]='rejected'
 else:raise AssertionError(name)
audit=json.loads((p/'candidate-coverage/source-audit.json').read_text())
for file,sha in audit['files'].items():assert hashlib.sha256(Path(file).read_bytes()).hexdigest()==sha
(out/'source-audit.json').write_text(json.dumps({'runtimeCommit':audit['runtimeCommit'],'files':audit['files']},indent=2)+'\n')
(out/'validation.json').write_text(json.dumps({'byteIdenticalRepeats':3,'repeatSha256':hashlib.sha256(raw[0]).hexdigest(),'priorCensusNodeAndInputParity':4,'priorCensusExitEntryParity':4,'runtimeFilesUnchanged':len(audit['files']),'controls':controls},indent=2)+'\n')
with (out/'results.json.gz').open('wb') as f:
 with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as g:g.write(raw[0])
