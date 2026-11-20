"""Join public-only frozen predictor outputs to independent audited labels.
Outer mode: exactly 160 prelocked matches, no tuning."""
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
ten=[];ron=[];aggregate=[];seen=set();matches=[];public_hashes=set()
manifest=read(sys.argv[3]);history=read(sys.argv[4]);entries={e['shard']:e for e in manifest['entries']}
assert manifest['candidate']==meta and manifest['status']=='locked_before_outer_acquisition' and len(entries)==160
manifest_sha=hashlib.sha256(Path(sys.argv[3]).read_bytes()).hexdigest()
paths=sorted(q.parent for q in root.rglob('manifest.json'));assert len(paths)==160
for d in paths:
 m=read(d/'manifest.json');seed=m['seed'];sh=m['shard'];assert seed not in seen and len(m['rows'])==1 and m['split']=='outer-locked' and m['manifestSha']==manifest_sha and m['codeSha']==manifest['codeSha']
 seen.add(seed);r=m['rows'][0];f=r['opponentFamily'];progression=r['policy']
 assert f in FAMILIES and progression in ('efficiency','s42') and r['seed']==seed and r['cpuAudit']['fallbacks']==0 and r['cpuAudit']['activeSeats']==3
 assert len(r['wallHashes'])==r['hands'] and sorted(r['allRanks'])==[1,2,3,4]
 e=entries[sh];assert (seed,f,progression,r['dealer'])==(e['seed'],e['family'],e['policy'],e['dealer'])
 assert m['runtime']['node']=='v'+manifest['runtime']['node']
 matches.append(dict(seed=seed,family=f,progression=progression,wall=r['wallHashes'][0],log=r['logHash'],runtime=m['runtime']))
 xs=read(d/'public.json');assert len(xs)==r['publicDecisions'] and len({x['id'] for x in xs})==len(xs)
 # Complete predictions from public input before opening oracle file.
 preds={}
 for x in xs:
  digest=hashlib.sha256(json.dumps([x['phase'],x['scene'],x['actions']],sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()
  assert digest not in history and digest not in public_hashes,('exact public duplicate',seed,x['id'])
  public_hashes.add(digest)
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
assert seen=={e['seed'] for e in entries.values()}
assert len({m['wall'] for m in matches})==160 and len({m['log'] for m in matches})==160
assert len({(m['runtime']['node'],m['runtime']['chromium']) for m in matches})==1
assert set(collections.Counter((m['family'],m['progression']) for m in matches).values())=={20}
out=evaluate(ten,ron,meta['training_only_baseline'],aggregate)
out['matches']=len(paths);out['manifest_sha256']=manifest_sha;out['match_manifest']=matches
out['coverage']={'tenpai_rows':len(ten),'ron_rows':len(ron),'aggregate_candidates':len(aggregate),'deterministic_riichi':sum(r['known'] for r in ten),'deterministic_safe':sum(r['safe'] for r in ron)}
out['progression']={s:{'ron':prob_eval([r for r in ron if r['progression']==s and not r['safe']]),'ranking':rank_eval([r for r in ron if r['progression']==s and not r['safe']])} for s in ('efficiency','s42')}
def pack(rows):
 return {'n':len(rows),'matches':len({r['seed'] for r in rows}),**{k+'_rmse':float(np.sqrt(np.mean([(r[k]-r['settlement_actual' if k=='settlement' else 'actual'])**2 for r in rows]))) for k in ('direct','decomp','settlement')},'divergence_quantiles':[float(v) for v in np.quantile([abs(r['direct']-r['decomp']) for r in rows],[.5,.9,.95,.99])]}
out['aggregate']={k:pack([r for r in aggregate if k=='all' or r['family']==k]) for k in ('all',*FAMILIES)}
out['scope']='formal fixed 160-match outer; no tuning, visible-only legal opportunity; historical raw wall hashes incomplete; no release'
Path('/tmp/p1-outer-summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in out.items() if k not in ('scopes','match_manifest','progression')},ensure_ascii=False,indent=2))
