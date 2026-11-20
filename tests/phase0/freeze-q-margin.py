"""Freeze margin using synthetic calibration only. Do not read live outputs here."""
import json,sys,math
from pathlib import Path
ref=json.loads(Path(sys.argv[1]).read_text())
root=Path(sys.argv[2]);runs=[]
for p in sorted(root.rglob('browser-*.json')):runs.append(json.loads(p.read_text()))
for p in sorted(root.rglob('cpu.json')):runs.extend(json.loads(p.read_text()))
startups=[json.loads(p.read_text()) for p in sorted(root.rglob('startup-*.json'))]
assert len(startups)==6 and {(x['engine'],x['replicate']) for x in startups}=={(k,n) for k in ('chromium','webkit') for n in (1,2,3)}
assert all(1<=x['attempts']<=3 and x['startup_failures']==x['attempts']-1 for x in startups)
assert len(ref)==100 and len(runs)==12
assert sorted(x['engine'] for x in runs if x['engine'] in ('chromium','webkit'))==['chromium']*3+['webkit']*3
assert len({r['engine'] for r in runs if r['engine'].startswith('onnx-cpu')})==6
drifts=[];by_runtime={};mismatches=0
for i,r in enumerate(ref):
 mask=[v is not None for v in r['q']]
 for run in runs:
  row=run['rows'][i]
  assert len(run['rows'])==len(ref) and (row['name'],row['eventIndex'])==(r['name'],r['eventIndex'])
  assert [v is not None for v in row['q']]==mask
  assert all(math.isfinite(v) for v in row['q'] if v is not None)
  a=max(abs(x-y) for x,y in zip(r['q'],row['q']) if x is not None)
  k=run['engine'];by_runtime[k]=max(by_runtime.get(k,0),a)
 for j,ok in enumerate(mask):
  if ok:
   vals=[r['q'][j]]+[x['rows'][i]['q'][j] for x in runs]
   drifts.append(max(vals)-min(vals))
m=max(drifts);assert m<=1e-4
def quantile(v,p):
 a=sorted(v);return a[round(p*(len(a)-1))]
threshold=max(1e-7,10*m)
out={'status':'margin_frozen_calibration_only','calibration_decisions':len(ref),'legal_q_values':len(drifts),'executions_per_state':len(runs)+1,'max_pairwise_drift':m,'p50_drift':quantile(drifts,.5),'p95_drift':quantile(drifts,.95),'p99_drift':quantile(drifts,.99),'margin_threshold':threshold,'factor':10,'startup_attempts':startups,'startup_failures':sum(x['startup_failures'] for x in startups),'reference_runtime_max_abs_difference':by_runtime,'scope':'native reference CPU, repeated ONNX CPU 1/2 threads, repeated Chromium/WebKit WASM CPU; GPU is not enabled or supported by this test'}
Path(sys.argv[3]).write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
