import pcbnew,json,sys
b=pcbnew.LoadBoard(sys.argv[1]);c=b.GetConnectivity();assert c.Build(b)
key=lambda p: json.dumps([p.GetNetname(),p.GetParentFootprint().GetReference(),p.GetNumber(),p.GetPosition().x,p.GetPosition().y],separators=(',',':'))
pads={key(p):p for p in b.GetPads() if p.GetNetCode()>0};assert len(pads)==sum(p.GetNetCode()>0 for p in b.GetPads())
groups={k:sorted({k}|{key(other) for other in c.GetConnectedPads(p)}) for k,p in pads.items()}
assert all(groups[other]==members for members in groups.values() for other in members)
print(json.dumps(groups))
