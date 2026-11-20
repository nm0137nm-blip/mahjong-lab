"""Artifact smoke and strict public request boundary checks, not upstream full hidden perturbation."""
import sys,json,copy,hashlib
from pathlib import Path
from p1_public_predictor import Predictor
p=Predictor(sys.argv[1]);root=Path(sys.argv[2]);count=0;rejected=0;hashes=[]
for f in sorted(root.rglob('public.json')):
 xs=json.loads(f.read_text());m=json.loads((f.parent/'manifest.json').read_text());assert m['split']=='development-only'
 for x in [z for z in xs if z['phase']=='turn'][:3]:
  a=p.predict(x);b=p.predict(json.loads(json.dumps(x,ensure_ascii=False)))
  assert a==b
  for field in ('oracle','privateHand','wall','teacherQ','future'):
   y=copy.deepcopy(x);y[field]={'secret':[1,2,3]}
   try:p.predict(y)
   except AssertionError:rejected+=1
   else:raise AssertionError('accepted disallowed input '+field)
  count+=1;hashes.append(hashlib.sha256(json.dumps(a,sort_keys=True,ensure_ascii=False).encode()).hexdigest())
assert count==216 and rejected==1080
print(json.dumps({'status':'public_predictor_contract_smoke_pass','cases':count,'rejected_extra_fields':rejected,'prediction_hash':hashlib.sha256(''.join(hashes).encode()).hexdigest(),'scope':'public requests only, repeated deterministic outputs, forbidden top-level inputs rejected. Not full upstream hidden-state perturbation or independent outer evaluation.'},indent=2))
