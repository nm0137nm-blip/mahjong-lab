"""Freeze prospective namespaces; no outcome data. Incomplete legacy inventory blocks activation."""
import hashlib,json,sys
from pathlib import Path
def seed(key):return int.from_bytes(hashlib.sha256(key.encode()).digest()[:4],'little') or 1
def make(known):
    blocked=set(known['training_seeds'])|set(known['arena_seeds'])
    namespaces={k:n for k,n in [('coach-arena-v1',105),('coach-belief-arena-v1',105),('coach-phase0-duplicate-v1',4),('coach-phase0-duplicate-v2',4),('coach-phase0-variance-v1',12),('coach-phase0-variance-v2',12),('coach-phase0-payload-v1',2),('coach-phase0-payload-v2',2),('coach-phase0-live-v1',2)]}
    blocked|={seed(f'{k}:{i}') for k,n in namespaces.items() for i in range(1,n+1)}
    units={}
    used=set(blocked)
    for phase in ('primary_interim','primary_second','secondary_standard_cpu','confirmation_reserve','unallocated_reserve','p1_r1_development'):
        n=8 if phase=='p1_r1_development' else 160
        a=[seed(f'coach-v11-20261120:{phase}:{i}') for i in range(1,n+1)]
        assert len(set(a))==n and not used.intersection(a)
        used.update(a)
        digest=hashlib.sha256(json.dumps(a,separators=(',',':')).encode()).hexdigest()
        units[phase]={'phase':phase,'seeds':a,'sha256':digest}
    return {**units,'known_legacy_unique_seeds':len(blocked),'activation':'BLOCKED until missing historical 80 training and 30 dev seed manifests plus hashes audited; namespaces fixed; never replace after outcome inspection'}
if __name__=='__main__': print(json.dumps(make(json.loads(Path(sys.argv[1]).read_text())),indent=2))
