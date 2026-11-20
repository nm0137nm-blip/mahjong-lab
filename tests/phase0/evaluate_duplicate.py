"""Operational duplicate pilot, NOT a skill estimate or sample-size pilot for candidate differences."""
import json,sys,hashlib
from pathlib import Path
from statistics import mean,stdev
U=[90,45,0,-135]
def check(root):
 docs=[json.loads(p.read_text()) for p in Path(root).rglob('duplicate-*.json')]
 assert sorted(x['pair'] for x in docs)==[1,2,3,4]
 blocks=[]
 for x in sorted(docs,key=lambda x:x['pair']):
  expected=int.from_bytes(hashlib.sha256(f"coach-phase0-duplicate-v1:{x['pair']}".encode()).digest()[:4],'little') or 1
  assert x['seed']==expected
  rows=x['rows'];assert [r['dealer'] for r in rows]==[0,1,2,3,0]
  for r in rows:
   assert r['seed']==expected and r['policy']=='s42' and sorted(r['allRanks'])==[1,2,3,4]
   assert len(r['wallHashes'])==r['hands'] and all(len(h)==64 for h in r['wallHashes'])
   a=r['cpuAudit'];assert a['fallbacks']==0 and a['model']+a['forced']==a['decisions'] and a['activeSeats']==3 and a['sharedWorker']
  assert len({r['wallHashes'][0] for r in rows})==1,'initial wall differs across rotations'
  a,b=rows[0],rows[-1]
  for k in ['logHash','allRanks','allScores','wallHashes','rank','decisions','forced']:
   assert a[k]==b[k],('same-seat replay mismatch',k)
  blocks.append({'pair':x['pair'],'rank_by_dealer':[r['rank'] for r in rows[:4]],'block_utility':mean(U[r['rank']-1] for r in rows[:4]),'repeat_exact':True})
 return {'status':'duplicate_operational_pass','blocks':blocks,'n_matches':20,'mean_focal_utility':mean(b['block_utility'] for b in blocks),'sd_all_s42_block_utility':stdev(b['block_utility'] for b in blocks),'limitation':'same-policy operational check only; candidate-vs-baseline paired variance still needs a separate pilot'}
if __name__=='__main__':print(json.dumps(check(sys.argv[1]),indent=2))
