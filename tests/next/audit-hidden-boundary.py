import json,sys,hashlib
from pathlib import Path
from p1_public_predictor import Predictor
p=Predictor(sys.argv[1]);root=Path(sys.argv[2]);files=sorted(root.rglob('hidden.json'));assert len(files)==2
n=0;families=set()
for f in files:
 m=json.loads((f.parent/'manifest.json').read_text());families.add(m['rows'][0]['opponentFamily'])
 rows=json.loads(f.read_text());assert len(rows)==m['rows'][0]['teacherTurns'] and rows
 for r in rows:
  assert r['blockedFields']==9 and r['public']==r['poisoned']
  assert p.predict(r['public'])==p.predict(r['poisoned'])
  n+=1
assert families=={'s42','basic'}
print(json.dumps({'status':'live_hidden_boundary_pass','matches':2,'turns':n,'scope':'reused development seeds, synchronous read-poison test of 3 hidden concealed/drawn states, wall sequence (length allowed), ura and hidden Ron status. Restored before teacher read/game action. Exact public features and candidate prediction equality. Not a proof for all possible code paths or production runtime.'},indent=2))
