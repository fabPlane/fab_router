import importlib.util,sys,gzip,pathlib,json
sys.dont_write_bytecode=True
root=pathlib.Path(sys.argv[1]);mods=[]
for name,file in [('old','discovery-sexpr-helper.py'),('new','native-thermal-proposals.py')]:
 spec=importlib.util.spec_from_file_location(name,root/file);module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module);mods.append(module)
f=root/'fixture';checked=[]
for name,raw in [('source',gzip.decompress((f/'input.kicad_pcb.gz').read_bytes()).decode()),('full','(kicad_pcb '+gzip.decompress((f/'full-added.sexpr.gz').read_bytes()).decode()+')')]:
 a,b=mods;assert a.parse(raw)==b.parse(raw);assert a.dump(a.parse(raw))==b.dump(b.parse(raw));checked.append(name)
value=dict(checked=checked,parsedTreesEqual=True,serializedBytesEqual=True)
assert value==json.loads((root/'parser-equivalence.json').read_text())
print(json.dumps(value,indent=2))
