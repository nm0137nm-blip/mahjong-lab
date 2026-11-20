"""Pilot only: calculate paired 4-seat block variance of frozen 200-game policy vs S42."""
import json,sys,hashlib,math
from pathlib import Path
from statistics import stdev,mean
U=[90,45,0,-135]
def evaluate(root):
 docs=[json.loads(p.read_text()) for p in Path(root).rglob('variance-*.json')]
 assert sorted(x['pair'] for x in docs)==list(range(1,13))
 deltas=[]
 for x in sorted(docs,key=lambda x:x['pair']):
  seed=int.from_bytes(hashlib.sha256(f"coach-phase0-variance-v2:{x['pair']}".encode()).digest()[:4],'little') or 1
  assert x['seed']==seed
  rows=x['rows'];assert len(rows)==8 and {(r['policy'],r['dealer']) for r in rows}=={(a,d) for a in ('learned','s42') for d in range(4)}
  for r in rows:
   assert r['seed']==seed and sorted(r['allRanks'])==[1,2,3,4] and r['rank']==r['allRanks'][0]
   a=r['cpuAudit'];assert a['fallbacks']==0 and a['model']+a['forced']==a['decisions'] and a['activeSeats']==3 and a['sharedWorker']
  assert len({r['wallHashes'][0] for r in rows})==1
  a={k:mean(U[r['rank']-1] for r in rows if r['policy']==k) for k in ('learned','s42')}
  deltas.append(a['learned']-a['s42'])
 sd=stdev(deltas)
 # Conservative upper 95% bound on variance under normal approximation (chi-square_0.05, df=11 ~=4.575)
 upper_sd=sd*math.sqrt(11/4.575)
 n=math.ceil(((1.959964+0.841621)*upper_sd/15)**2)
 return {'status':'variance_pilot_complete','n_blocks':12,'n_matches':96,'block_sd':sd,'upper_sd_normal_approx':upper_sd,'mme':15,'target_power_approx':0.8,'recommended_blocks_approx':max(30,n),'formal_cap_blocks':400,'cap_sufficient_under_approx':n<=400,'deltas':deltas,'limitations':'small disjoint pilot; normal approximation for planning, not evidence of skill or proof of future variance; freeze candidate-specific protocol before formal test; no pilot pooling'}
if __name__=='__main__':print(json.dumps(evaluate(sys.argv[1]),indent=2))
