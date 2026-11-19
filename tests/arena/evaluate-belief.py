"""Pre-specified fixed-sample paired evaluation. No pilot pooling/exclusions."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
EXPECTED={"t":"4b6325559cbcf5fe45145eccfd938d0e68c2c5e2bc1de9985378fae2cb2e5f0a","r":"1028569ef3889c8b86c1085fecd3fe8789ec284a5b56b9a2cae6d946c8e98fa9","learned":"b10b2b7f8d772e37a459695984eb8abed075c760cc5c0e3e9fafee782d01fc2a","belief":"2fdd84eaf6f228b7156ea9380f939e1a09f89f9df9a32f80f3257be8bbd290a3"}
SHARED={'reaction':'11d5699e20319f23040a9e7584e25179615ca8228089de0dce38c527dd7aa42f','special':'0617e41120d1918d69302bf564d294659692e4c35d2a8015c162d003b94a2ff5'}
UTILITY=np.array([90,45,0,-135])
def seed(i):return int.from_bytes(hashlib.sha256(f'coach-belief-arena-v1:{i}'.encode()).digest()[:4],'little') or 1
def evaluate(root,split):
 expected=set(range(1,3) if split=='smoke' else range(6,106))
 pairs={op:{} for op in ('basic','s42')}
 for p in sorted(Path(root).rglob('paired-*.json')):
  x=json.loads(p.read_text());i=x['pair']
  assert i in expected and x['seed']==seed(i) and x['split']==split,(p,i)
  assert x['beliefFreeze']['models']==EXPECTED
  assert all(x['weights']['models'][k]['model_hash']==v and x['weights']['models'][k]['byte_parity'] for k,v in SHARED.items())
  assert len(x['rows'])==2 and {r['policy'] for r in x['rows']}=={'learned','belief'}
  d={r['policy']:r for r in x['rows']};op=d['learned']['opponents'];assert op in pairs and i not in pairs[op]
  for k,r in d.items():
   assert r['opponents']==op and r['seed']==seed(i) and r['pair']==i and r['rank'] in (1,2,3,4) and r['hands']>0 and r['decisions']>0 and r['pureCalls']>0
   assert r['beliefCalls']==(r['pureCalls'] if k=='belief' else 0)
   assert 0<=r['wins']<=r['hands'] and 0<=r['dealIns']<=r['hands']
   if op=='basic':
    assert len(r['opponentAudit'])==3 and all(a['invalid']==0 and a['actions']>0 for a in r['opponentAudit'])
   else:
    a=r['cpuAudit'];assert a['fallbacks']==0 and a['sharedWorker'] and a['activeSeats']==3 and a['model']+a['forced']==a['decisions']
  pairs[op][i]=d
 out={}
 for op,ps in pairs.items():
  assert set(ps)==expected,(op,'missing',sorted(expected-set(ps)))
  rows={k:[ps[i][k] for i in sorted(ps)] for k in ('learned','belief')}
  ranks={k:np.array([r['rank'] for r in v]) for k,v in rows.items()}
  report={}
  for k,v in rows.items():
   rank=ranks[k];hands=sum(r['hands'] for r in v)
   report[k]=dict(n=len(v),mean_rank=float(rank.mean()),rank_rates=[float((rank==i).mean()) for i in range(1,5)],mean_score=float(np.mean([r['score'] for r in v])),custom_rank_utility=float(UTILITY[rank-1].mean()),win_rate=sum(r['wins'] for r in v)/hands,deal_in_rate=sum(r['dealIns'] for r in v)/hands,hands=hands,pure_calls=sum(r['pureCalls'] for r in v),belief_calls=sum(r['beliefCalls'] for r in v))
  a,b=ranks['belief'],ranks['learned'];delta=np.column_stack([UTILITY[a-1]-UTILITY[b-1],a-b,(a==4).astype(int)-(b==4).astype(int)])
  idx=np.random.default_rng(261120).integers(len(ps),size=(20000,len(ps)));m=delta[idx].mean(1)
  report['belief_minus_learned']={k:dict(mean=float(delta[:,j].mean()),ci95=np.percentile(m[:,j],[2.5,97.5]).tolist()) for j,k in enumerate(['custom_rank_utility','rank','last_rate'])}
  out[op]=report
 return {'split':split,'primary':'S42 opponent paired custom rank utility difference','secondary':'basic opponent comparison and other metrics','interpretation':'Operational only; no skill claim' if split=='smoke' else 'Fixed 100 matched seed pairs per opponent type. Same seeds across pools, analyze separately; not official Tenhou points. No optional stopping or pilot pooling.','results':out}
if __name__=='__main__':
 assert sys.argv[1] in ('smoke','prospective')
 print(json.dumps(evaluate(sys.argv[2],sys.argv[1]),indent=2))
