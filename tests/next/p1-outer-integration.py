"""Join public-only frozen predictor outputs to independent audited labels.
QA mode only: existing eight development games. No outer acquisition or tuning."""
import json,hashlib,sys,collections
from pathlib import Path
import numpy as np
from p1_public_predictor import Predictor
from p1_outer_metrics import evaluate,prob_eval,rank_eval,FAMILIES
from belief_features import features
def read(p):return json.loads(Path(p).read_text())
root=Path(sys.argv[1]);model=Path(sys.argv[2]);meta=read(model/'manifest.json')
assert meta==read(Path(__file__).with_name('p1-expected-candidate.json'))
p=Predictor(model)
ten=[];ron=[];aggregate=[];seen=set();matches=[]
paths=sorted(q.parent for q in root.rglob('manifest.json'));assert len(paths)==8
for d in paths:
 m=read(d/'manifest.json');seed=m['seed'];sh=m['shard'];assert seed not in seen and len(m['rows'])==1 and m['split']=='qa-reused-development-only'
 seen.add(seed);r=m['rows'][0];f=r['opponentFamily'];progression=r['policy']
 assert f in FAMILIES and progression in ('efficiency','s42') and r['seed']==seed and r['cpuAudit']['fallbacks']==0 and r['cpuAudit']['activeSeats']==3
 assert len(r['wallHashes'])==r['hands'] and sorted(r['allRanks'])==[1,2,3,4]
 matches.append(dict(seed=seed,family=f,progression=progression,wall=r['wallHashes'][0],log=r['logHash']))
 xs=read(d/'public.json');assert len(xs)==r['publicDecisions'] and len({x['id'] for x in xs})==len(xs)
 # Complete predictions from public input before opening oracle file.
 preds={}
 for x in xs:
  if x['phase']!='turn':continue
  a=p.predict(x);b={}
  for z in a['opponents']:
   j=z['seat'];G,C,safe=features(x,j,a['tiles']);G=np.asarray([G],np.float32);C=np.asarray(C,np.float32)
   t=1. if G[0,0] else float(p.models['frozen-t.lgb'].predict(G,num_threads=1)[0])
   ref=p.models['frozen-r.lgb'].predict(C,num_threads=1);ref[np.asarray(safe,bool)]=0
   assert z['tenpai']==t
   strata=[k for k,v in [('riichi',G[0,0]>0),('multi_meld',G[0,1]>=2),('late',G[0,3]<=18)] if v]
   b[j]=(t,ref,safe,strata,bool(G[0,0]))
  preds[x['id']]=(a,b)
 truth=read(d/'oracle.json')
 assert len(truth)==len(preds)==r['teacherTurns'] and {z['id'] for z in truth}==set(preds)
 for q in truth:
  a,b=preds.pop(q['id']);tiles=a['tiles'];assert tiles==q['tiles'];labels={z['seat']:z for z in q['opponents']}
  assert len(labels)==3 and set(labels)==set(b)
  for z in a['opponents']:
   j=z['seat'];lab=labels[j];t,br,safe,strata,known=b[j]
   common=dict(seed=seed,family=f,progression=progression,id=q['id'],seat=j,strata=strata)
   ten.append(dict(**common,y=int(lab['tenpai']),p=z['tenpai'],baseline=t,known=known))
   for i,tile in enumerate(tiles):
    y=int(lab['legalRon'][tile]);loss=lab['baseLoss'][tile] or 0
    assert bool(loss)==bool(y)
    lo,md,hi=z['visible_conditional_interval'][i];assert 0<=lo<=md<=hi
    ron.append(dict(**common,tile=tile,y=y,p=z['ron'][i],baseline=float(br[i]),t=t,safe=bool(safe[i]),loss=loss,mean=z['visible_conditional_mean'][i],lo=lo,hi=hi,median=md))
  for i,tile in enumerate(tiles):
   actual=sum(lab['baseLoss'][tile] or 0 for lab in labels.values())
   aggregate.append(dict(seed=seed,family=f,progression=progression,id=q['id'],tile=tile,actual=actual,settlement_actual=q['allAcceptVisibleLoss'][tile],direct=a['direct_base_exposure'][i],decomp=a['decomposed_base_exposure'][i],settlement=a['direct_visible_all_accept'][i]))
 assert not preds
 print('JOINED',sh,f,progression,flush=True)
assert len(seen)==8 and len({m['wall'] for m in matches})==8 and len({m['log'] for m in matches})==8
assert set(collections.Counter((m['family'],m['progression']) for m in matches).values())=={1}
out=evaluate(ten,ron,meta['training_only_baseline'],aggregate)
assert out['status']=='P1_visible_outer_not_full_pass' and not out['primary_pass'] and not out['all_family_gate']
# Support gates must reject this small reused QA cohort even if metrics look good.
summary={'status':'outer_evaluator_integration_qa_pass','matches':len(paths),'tenpai_rows':len(ten),'ron_rows':len(ron),'aggregate_candidates':len(aggregate),'deterministic_riichi':sum(r['known'] for r in ten),'deterministic_safe':sum(r['safe'] for r in ron),'scope':'Existing audited QA matches only, no held-out data, no metric-driven model changes or promotion. Insufficient support correctly rejected.'}
Path('/tmp/p1-integration-qa.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
