"""Bounded marker-driven candidate discovery, with no board-specific identifiers."""
def child(n,key):
    return next((c for c in n if isinstance(c,list) and c[0]==key),None)

def uid(n):
    value=child(n,'uuid');return value[1].strip('"') if value else None

def rank_vias(nodes, protected, error, limit):
    if not 1<=limit<=8:raise ValueError('via budget must be between 1 and 8')
    if error['type']!='starved_thermal':return []
    pads={uid(p) for n in nodes if isinstance(n,list) and n[0]=='footprint'
          for p in n if isinstance(p,list) and p[0]=='pad'}
    zones={uid(n):child(n,'layer')[1].strip('"') for n in nodes
           if isinstance(n,list) and n[0]=='zone' and child(n,'layer')}
    stack=next(n for n in nodes if isinstance(n,list) and n[0]=='layers')
    copper=[n[1].strip('"') for n in stack[1:] if isinstance(n,list) and n[1].strip('"').endswith('.Cu')]
    points=[i['pos'] for i in error['items'] if i['uuid'] in pads]
    target={zones[i['uuid']] for i in error['items'] if i['uuid'] in zones}
    if not points or not target:return []
    def spans(n):
        endpoints=child(n,'layers')
        if not endpoints or len(endpoints)!=3:return False
        ends=[v.strip('"') for v in endpoints[1:]]
        if any(v not in copper for v in ends):return False
        lo,hi=sorted(map(copper.index,ends))
        return bool(target.intersection(copper[lo:hi+1]))
    def key(n):
        x,y=map(float,child(n,'at')[1:3])
        return min((x-p['x'])**2+(y-p['y'])**2 for p in points),uid(n)
    vias=[n for n in nodes if isinstance(n,list) and n[0]=='via' and uid(n)
          and uid(n) not in protected and spans(n)]
    return [uid(n) for n in sorted(vias,key=key)[:limit]]
