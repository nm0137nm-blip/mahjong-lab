"""Verifier-only development diagnostic. Reads oracle AFTER sampler output fixed.
Never writes any private tile or per-case oracle result. No calibration claim.
"""
import json,sys,collections
from pathlib import Path
root=Path(sys.argv[1]);s=json.loads(Path(sys.argv[2]).read_text());out=Path(sys.argv[3])
groups=collections.defaultdict(lambda: {'seats':0,'actual_ready':0,'proposal_ready_sum':0.,'heuristic_ready_sum':0.,'brier_uniform':0.,'brier_heuristic':0.})
for row in s['cases']:
 d=root/('p1-v2-dev-data-'+str(row['shard']))
 m=json.loads((d/'manifest.json').read_text());assert m['split']=='development-only' and m['seed']==row['seed']
 pub=[x for x in json.loads((d/'public.json').read_text()) if x['id']==row['decision']]
 oracle=[x for x in json.loads((d/'oracle.json').read_text()) if x['id']==row['decision']]
 assert len(pub)==len(oracle)==1
 assert pub[0]['scene']['ownSeat']==oracle[0]['ownSeat']
 assert row['accepted']==16
 for opp in oracle[0]['opponents']:
  i=str(opp['seat']);assert i in row['unweighted_ready']
  # Historical virtual-fifth labels are irrelevant for this small subset only if
  # the structural wait can physically exist; verify private shape with Python.
  from mahjong.shanten import Shanten
  import re
  hand=opp['privateHand'];assert ',' not in hand
  tiles=[a+b for a,digits in re.findall(r'([mpsz])([0-9]+)',hand) for b in digits]
  assert len(tiles)==13
  ts=[a+str(n) for a in 'mpsz' for n in range(1,8 if a=='z' else 10)]
  cc=[0]*34
  for t in tiles:cc[ts.index(t.replace('0','5'))]+=1
  sh=Shanten();truth=sh.calculate_shanten(cc)==0 and any(sh.calculate_shanten(cc[:k]+[cc[k]+1]+cc[k+1:])==-1 for k in range(34) if cc[k]<4)
  assert truth==opp['tenpai']
  u=row['unweighted_ready'][i];w=row['heuristic_weighted_ready'][i]
  for key in ['all','riichi' if pub[0]['scene']['rivers'][int(i)]['riichi'] else 'non_riichi']:
   g=groups[key];g['seats']+=1;g['actual_ready']+=int(truth)
   g['proposal_ready_sum']+=u;g['heuristic_ready_sum']+=w
   g['brier_uniform']+=(u-int(truth))**2;g['brier_heuristic']+=(w-int(truth))**2
for g in groups.values():
 for k in ['proposal_ready_sum','heuristic_ready_sum','brier_uniform','brier_heuristic']:g[k]/=g['seats']
res={'status':'restricted_development_sampler_bias_diagnostic','cases':len(s['cases']),'groups':dict(groups),'limitations':['eight selected no-call cases, no independent statistical claim','one true state per case, not a conditional distribution truth','uniform label denotes unweighted biased proposal, not uniform posterior','never used in stage1 or product']}
out.write_text(json.dumps(res,indent=2)+'\n');print(json.dumps(res))
