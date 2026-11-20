import json,hashlib,sys
from pathlib import Path
history=json.loads(Path(sys.argv[1]).read_text())
assert history['status']=='all_available_historical_training_development_seed_inventory_verified' and history['overlap']==0
initial=json.loads(Path(sys.argv[2]).read_text())
reserved={v for u in initial.values() if isinstance(u,dict) for v in u['seeds']}
blocked=set(history['excluded_seeds'])|reserved
seeds=[int.from_bytes(hashlib.sha256(f'coach-v11-20261120:multifamily-development-v1:{i}'.encode()).digest()[:4],'little') or 1 for i in range(1,49)]
assert len(set(seeds))==48 and not blocked.intersection(seeds)
out={'version':'multifamily-development-v1','split':'development-only','seeds':seeds,'sha256':hashlib.sha256(json.dumps(seeds,separators=(',',':')).encode()).hexdigest(),'counts':{'s42x3':24,'basicx3':24,'learned_focal_each':12,'s42_focal_each':12},'history_sha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'excluded_seed_count':len(blocked),'limitation':'historical raw wall hashes incomplete; no formal seeds or test data used'}
Path('/tmp/multifamily-manifest.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
