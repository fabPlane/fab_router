"""Create a separate committed-source archive with exact clearance branch counters."""
from pathlib import Path
import argparse,hashlib,json,subprocess,tarfile,io
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('repository',type=Path);p.add_argument('commit');p.add_argument('output',type=Path)
args=p.parse_args()
if args.output.exists():p.error('output already exists')
commit=subprocess.check_output(['git','-C',str(args.repository),'rev-parse',args.commit],text=True).strip()
archive=subprocess.check_output(['git','-C',str(args.repository),'archive',commit,'src','spec','package.json'])
args.output.mkdir(parents=True)
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(args.output,filter='data')
path=args.output/'src/route/clear.ts';text=path.read_text();original=hashlib.sha256(path.read_bytes()).hexdigest()
marker='function closerConvex(a: ConvexShape, b: ConvexShape, required: number, orTouching: boolean): boolean {'
assert text.count(marker)==1
text=text.replace(marker,'''const __capsuleTrace = (globalThis as typeof globalThis & {
  __capsuleTrace: { total: number; fast: number; fallback: Record<string, number> }
}).__capsuleTrace;

'''+marker+'\n  __capsuleTrace.total++;')
marker='    const need = required + a.r + b.r;'
assert text.count(marker)==1;text=text.replace(marker,'    __capsuleTrace.fast++;\n'+marker)
marker='  const ca = coreOf(a), cb = coreOf(b);'
assert text.count(marker)==1
text=text.replace(marker,'''  const __pair = a.kind + "/" + b.kind;
  __capsuleTrace.fallback[__pair] = (__capsuleTrace.fallback[__pair] ?? 0) + 1;
'''+marker)
path.write_text(text)
metadata={'commit':commit,'archive_sha256':hashlib.sha256(archive).hexdigest(),'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'original_clear_sha256':original,'instrumented_clear_sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(args.output/'capsule-instrumentation.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(metadata,indent=2))
