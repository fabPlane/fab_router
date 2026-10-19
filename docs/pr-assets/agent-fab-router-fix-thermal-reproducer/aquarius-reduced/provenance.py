#!/usr/bin/python3
"""Verify retained native geometry against the completed baseline and export DSN."""
import argparse,hashlib,json
from pathlib import Path
import native
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',required=True,type=Path);p.add_argument('--original',required=True,type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args();a.out.mkdir(exist_ok=False,parents=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def point(v):return [v.x,v.y]
def pad(p):return dict(uuid=p.m_Uuid.AsString(),position_nm=point(p.GetPosition()),size_nm=point(p.GetSize()),shape=p.GetShape(),radius_nm=p.GetRoundRectCornerRadius(),orientation_degrees=p.GetOrientationDegrees(),layers=list(p.GetLayerSet().Seq()),net=p.GetNetname(),local_gap_nm=p.GetLocalThermalGapOverride(),local_width_nm=p.GetLocalThermalSpokeWidthOverride(),spoke_angle=p.GetThermalSpokeAngle().AsDegrees())
def track(t):return dict(uuid=t.m_Uuid.AsString(),start_nm=point(t.GetStart()),end_nm=point(t.GetEnd()),width_nm=t.GetWidth(),layer=t.GetLayer(),net=t.GetNetname())
boards=[native.pcbnew.LoadBoard(str(s)) for s in [native.SRC,a.source,a.original]]
small,source,original=boards
sp=next(iter(small.GetPads()));bp=next(p for p in source.GetPads() if p.m_Uuid.AsString()==native.TARGET);op=next(p for p in original.GetPads() if p.m_Uuid.AsString()==native.TARGET)
assert pad(sp)==pad(bp)
byid={t.m_Uuid.AsString():t for t in source.GetTracks()};retained=[track(t) for t in small.GetTracks()]
assert all(t==track(byid[t['uuid']]) for t in retained)
zone=next(iter(small.Zones()));sz=next(z for z in source.Zones() if z.m_Uuid.AsString()==zone.m_Uuid.AsString())
zone_nodes=lambda b:[n for n in native.parse(b.read_text()) if isinstance(n,list) and n[0]=='zone' and native.uid(n)==zone.m_Uuid.AsString()]
without_fill=lambda z:[n for n in z if not(isinstance(n,list) and n[0]=='filled_polygon')]
assert without_fill(zone_nodes(native.SRC)[0])==without_fill(zone_nodes(a.source)[0])
assert zone.GetLayer()==native.pcbnew.B_Cu and sp.GetOrientationDegrees()==315
for ext in ['.kicad_pro','.kicad_dru']:assert sha(native.SRC.with_suffix(ext))==sha(a.source.with_suffix(ext))==sha(a.original.with_suffix(ext))
assert native.pcbnew.ExportSpecctraDSN(small,str(a.out/'board.dsn'))
report=dict(source_sha256={s.name:sha(s) for s in [a.source,a.original]},fixture_sha256=sha(native.SRC),retained_pad=pad(sp),original_pad=pad(op),retained_tracks=retained,zone_definition_unchanged=True,sidecars_unchanged=True,dsn_sha256=sha(a.out/'board.dsn'),dsn_is_native_thermal_model=False)
(a.out/'provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
