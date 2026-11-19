"""Public-only inference. No teacher, Q values, hidden status or reference label."""
import json,sys,hashlib
from pathlib import Path
import numpy as np
import lightgbm as lgb
from policy_features import public_features
from belief_features import predict
from rebuild_belief import EXPECTED
root=Path('/tmp/belief-model')
other=Path('/tmp/arena-model')
freeze=json.loads((other/'freeze.json').read_text())
shared={}
for k in ('reaction','special'):
 p=other/f'{k}.lgb';m=freeze['models'][k]
 assert m['byte_parity'] and hashlib.sha256(p.read_bytes()).hexdigest()==m['model_hash']
 shared[k]=lgb.Booster(model_file=str(p))
models={}
for k,h in EXPECTED.items():
 p=root/f'{k}.lgb';assert hashlib.sha256(p.read_bytes()).hexdigest()==h
 models[k]=lgb.Booster(model_file=str(p))
assert [models[k].num_feature() for k in ('t','r','learned','belief')]==[26,57,105,115]
for line in sys.stdin:
 try:
  req=json.loads(line);assert set(req)=={'policy','question'} and req['policy'] in ('learned','belief')
  policy=req['policy'];x=req['question'];cat,X,a=public_features(x);used=policy=='belief' and cat=='pure'
  if used:X=np.column_stack([X,predict(models,x,a)])
  m=models[policy] if cat=='pure' else shared[cat];assert X.shape[1]==m.num_feature()
  p=m.predict(X,num_threads=1);assert np.isfinite(p).all();p[a==43]=1e6
  print(json.dumps({'id':x['id'],'action':int(a[p.argmax()]),'scores':[[int(k),float(v)] for k,v in zip(a,p)],'category':cat,'usedBelief':used},allow_nan=False),flush=True)
 except Exception as e:print(json.dumps({'error':str(e)}),flush=True)
