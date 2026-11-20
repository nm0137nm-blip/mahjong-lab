import json,hashlib,sys,os
from pathlib import Path
from collections import Counter
H,V,M,S,P,E,C,O=[json.loads(Path(p).read_text()) for p in sys.argv[1:9]]
assert O['status']=='locked_before_outer_acquisition' and len(O['entries'])==160
assert hashlib.sha256(Path(sys.argv[8]).read_bytes()).hexdigest()=='1b78bcab0b3a496d0c6571f6f3e08b7dc35dd8275fde60c3dc449b6f1055c342'
assert H['overlap']==0 and len(M['seeds'])==48 and len(S['seeds'])==24 and len(P['seeds'])==8 and len(E['seeds'])==16
assert C==json.loads(Path('tests/next/p1-expected-candidate.json').read_text())
used=set(H['excluded_seeds'])|set(M['seeds'])|set(S['seeds'])|set(P['seeds'])|set(E['seeds'])|{s for d in V.values() if isinstance(d,dict) for s in d['seeds']}
assert set(C['historical_training_seeds']+C['recent_training_seeds']+C['calibration_seeds'])<=used
used.update(e['seed'] for e in O['entries'])
entries=[]
for i in range(96):
 f=('s42','basic','self')[i//32]
 policy=('efficiency','s42')[i%2]
 d=(i//2)%4
 s=int.from_bytes(hashlib.sha256(f'coach-v11-20261120:p1-v2-development-v1:{i+1}'.encode()).digest()[:4],'little') or 1
 entries.append(dict(shard=i+1,seed=s,family=f,policy=policy,dealer=d))
assert len({e['seed'] for e in entries})==96 and not used.intersection(e['seed'] for e in entries)
assert set(Counter((e['family'],e['policy'],e['dealer']) for e in entries).values())=={4}
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
paths=['index.html','src/coach/phoenix-coach.mjs','src/coach/s42-benchmark.mjs','src/mortal/mortal-cpu.mjs','tests/arena/belief_features.py','tests/arena/policy_features.py','tests/arena/policy_rpc.py','tests/next/run-p1-v2-dev.cjs','tests/next/p1_public_predictor.py','tests/next/p1_outer_metrics.py','tests/next/evaluate-p1-outer.py','tests/next/audit-independent-p1-outer.py','tests/next/audit-temporal-furiten.py','tests/next/p1-outer-protocol.json']
out=dict(status='locked_v2_development_only',codeSha=os.environ['GITHUB_SHA'],candidate=C,entries=entries,excluded_seeds_count=len(used),excluded_seeds_sha256=hashlib.sha256(json.dumps(sorted(used)).encode()).hexdigest(),source_hashes={p:sha(p) for p in paths},runtime={'os':'ubuntu-24.04','node':'22.23.4','python':'3.13.5','playwright':'1.57.0','numpy':'2.3.5','lightgbm':'4.6.0','scikit-learn':'1.8.0','mahjong':'1.4.0','encoder_js_sha256':'886cb7abb09034dcdf348039d651d63a83cd7edb87d3337a452722c960b9d97a','encoder_wasm_sha256':'0e9dcc57545afb5769d42f372bbd82be5c26941d1e352245b225d62ce0c611bf','onnx_sha256':'30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4'},limits='Historical full wall/trajectory hashes incomplete, all available historical seed and public hashes audited; no exhaustive historical clone guarantee. Prior independent outer excluded permanently; development-only data.')
Path('/tmp/v2-dev-seeds.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('LOCKED',len(entries),'EXCLUDED',len(used),'SHA256',sha('/tmp/v2-dev-seeds.json'))
