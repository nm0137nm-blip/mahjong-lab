"""Line-oriented, local-only public policy inference. No Q input."""
import json,sys,hashlib
from pathlib import Path
import numpy as np
import lightgbm as lgb
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
from policy_features import public_features
root=Path(sys.argv[1]);assert root in (Path('/tmp/arena-model'),Path('/tmp/augmented-model'))
freeze=json.loads((root/'freeze.json').read_text())
models={}
for cat,m in freeze['models'].items():
 p=root/f'{cat}.lgb'
 expected=m['model_hash']
 if root.name=='augmented-model':
  candidate=json.loads((root/'candidate.json').read_text());assert candidate['status']=='frozen_development_candidate_not_formal' and candidate['baseline_files'][cat]==expected
  expected=candidate['files'][cat]
  if cat!='pure':assert expected==m['model_hash']
 if not m['choice_parity'] or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise RuntimeError('model integrity')
 models[cat]=lgb.Booster(model_file=str(p))
for line in sys.stdin:
 try:
  x=json.loads(line);cat,X,a=public_features(x)
  pred=models[cat].predict(X,num_threads=1)
  if not np.isfinite(pred).all():raise ValueError('nonfinite scores')
  pred[a==43]=1e6
  print(json.dumps({'id':x['id'],'action':int(a[pred.argmax()]),'scores':[[int(k),float(v)] for k,v in zip(a,pred)]},allow_nan=False),flush=True)
 except Exception as e:print(json.dumps({'error':str(e)}),flush=True)
