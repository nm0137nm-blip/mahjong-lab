import json,sys,hashlib
from pathlib import Path
H,V,M,S,P=[json.loads(Path(p).read_text()) for p in sys.argv[1:]]
assert H['overlap']==0 and len(M['seeds'])==48 and len(S['seeds'])==24 and len(P['seeds'])==8
used=set(H['excluded_seeds'])|set(M['seeds'])|set(S['seeds'])|set(P['seeds'])|{s for d in V.values() if isinstance(d,dict) for s in d['seeds']}
seeds=[int.from_bytes(hashlib.sha256(f'coach-v11-20261120:r1-pure-rollout-extension-v1:{i}'.encode()).digest()[:4],'little') or 1 for i in range(1,17)]
assert len(set(seeds))==16 and not used.intersection(seeds)
out={'status':'development_only_extension','seeds':seeds,'excluded':len(used),'sha256':hashlib.sha256(json.dumps(seeds,separators=(',',':')).encode()).hexdigest()}
Path('/tmp/rollout-seeds.json').write_text(json.dumps(out,indent=2));print(out)
