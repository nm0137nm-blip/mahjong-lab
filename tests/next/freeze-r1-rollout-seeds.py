import json,hashlib,sys
from pathlib import Path
h=json.loads(Path(sys.argv[1]).read_text());v=json.loads(Path(sys.argv[2]).read_text());m=json.loads(Path(sys.argv[3]).read_text())
assert h['overlap']==0 and len(m['seeds'])==48
used=set(h['excluded_seeds'])|set(m['seeds'])|{s for d in v.values() if isinstance(d,dict) for s in d['seeds']}
seeds=[int.from_bytes(hashlib.sha256(f'coach-v11-20261120:r1-pure-rollout-dev-v1:{i}'.encode()).digest()[:4],'little') or 1 for i in range(1,9)]
assert len(set(seeds))==8 and not used.intersection(seeds)
out={'status':'development_only','seeds':seeds,'excluded':len(used),'sha256':hashlib.sha256(json.dumps(seeds,separators=(',',':')).encode()).hexdigest()}
Path('/tmp/rollout-seeds.json').write_text(json.dumps(out,indent=2));print(out)
