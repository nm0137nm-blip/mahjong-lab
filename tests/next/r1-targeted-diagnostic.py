"""R1 targeted on-policy diagnostic. Not candidate promotion or strength trial."""
import json,sys,collections,hashlib,math
from pathlib import Path
import numpy as np
import lightgbm as lgb
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
from policy_features import public_features
root=Path(sys.argv[1]);paths=sorted(p.parent for p in root.rglob('manifest.json'));assert len(paths)==48
freeze=json.loads(Path('/tmp/arena-model/freeze.json').read_text())
models={}
for cat in ('pure','reaction','special'):
 p=Path('/tmp/arena-model')/(cat+'.lgb');assert hashlib.sha256(p.read_bytes()).hexdigest()==freeze['models'][cat]['model_hash']
 models[cat]=lgb.Booster(model_file=str(p))
records=[];transition=collections.Counter();opp=collections.Counter()
def actname(i):return 'discard' if i<37 else {37:'riichi',38:'chi_low',39:'chi_mid',40:'chi_high',41:'pon',42:'kan',43:'win',44:'abort',45:'pass'}[i]
for p in paths:
 m=json.loads((p/'manifest.json').read_text());s=m['seed'];fam=m['rows'][0]['opponentFamily']
 if m['rows'][0]['policy']!='learned':continue
 x=json.loads((p/'public.json').read_text());q=json.loads((p/'reference.json').read_text())
 for u,v in zip(x,q):
  assert u['id']==v['id']
  cat,X,a=public_features(u)
  qq=np.array([v['q'][i] for i in a],float);assert np.isfinite(qq).all()
  score=models[cat].predict(X,num_threads=1);score[a==43]=1e6
  k=int(score.argmax());assert a[k]==v['chosen']
  gap=(qq.max()-qq)/max(1e-6,qq.max()-qq.min())
  if qq[k]<qq.max():transition[(fam,cat,actname(int(a[k])),actname(v['best']))]+=1
  opp[(fam,cat)]+=1
  if cat not in ('reaction','special'):continue
  modscore=score.copy();modscore[a==43]=np.max(score[a!=43])+10 if np.any(a!=43) else 10
  normscore=(modscore-modscore.min())/max(1e-6,np.ptp(modscore))
  X=np.column_stack([X,normscore, np.arange(len(a))==k])
  labels=np.maximum(0,np.floor(19*(1-gap))).astype(int)+(gap<1e-9)
  records.append({'seed':s,'family':fam,'cat':cat,'a':a,'x':X,'q':qq,'gap':gap,'base':k,'labels':labels})
seeds={f:sorted({r['seed'] for r in records if r['family']==f}) for f in ('s42','basic')};assert all(len(v)==12 for v in seeds.values())
res=[]
for fold in range(6):
 held={s for v in seeds.values() for i,s in enumerate(v) if i%6==fold}
 for cat in ('reaction','special'):
  train=[r for r in records if r['cat']==cat and r['seed'] not in held];test=[r for r in records if r['cat']==cat and r['seed'] in held]
  assert train and test and {r['seed'] for r in train}.isdisjoint({r['seed'] for r in test})
  rank=lgb.LGBMRanker(objective='lambdarank',label_gain=list(range(21)),n_estimators=60,num_leaves=7,min_child_samples=30,reg_lambda=15,learning_rate=.04,n_jobs=1,random_state=261120,verbosity=-1,lambdarank_truncation_level=5)
  rank.fit(np.concatenate([r['x'] for r in train]),np.concatenate([r['labels'] for r in train]),group=[len(r['a']) for r in train])
  for r in test:
   v=rank.predict(r['x']);v[r['a']==43]=1e6;j=int(v.argmax());k=r['base']
   res.append({'seed':r['seed'],'family':r['family'],'cat':cat,'baseline_gap':float(r['gap'][k]),'candidate_gap':float(r['gap'][j]),'baseline_top':bool(r['gap'][k]<1e-9),'candidate_top':bool(r['gap'][j]<1e-9),'changed':j!=k,'baseline_action':actname(int(r['a'][k])),'candidate_action':actname(int(r['a'][j]))})
assert len(res)==len(records)
def pack(rows):
 n=len(rows)
 return {'n':n,'matches':len({r['seed'] for r in rows}),'baseline_relative_q_loss':sum(r['baseline_gap'] for r in rows)/n,'candidate_relative_q_loss':sum(r['candidate_gap'] for r in rows)/n,'baseline_top1':sum(r['baseline_top'] for r in rows)/n,'candidate_top1':sum(r['candidate_top'] for r in rows)/n,'changed':sum(r['changed'] for r in rows),'improved':sum(r['candidate_gap']<r['baseline_gap']-1e-9 for r in rows),'worsened':sum(r['candidate_gap']>r['baseline_gap']+1e-9 for r in rows)}
out={'status':'R1_fixability_diagnostic_only','scope':'Full 24 learned-focal development games, no Q at inference, six group folds, baseline exact choices. Teacher relative loss not game payoff, no proof of 15pt improvement. Only reaction/special heads tested, teacher group not concrete action equivalence.','transition_counts':[{'family':k[0],'category':k[1],'chosen':k[2],'teacher':k[3],'count':v} for k,v in transition.most_common()],'opportunities':[{'family':k[0],'category':k[1],'count':v} for k,v in opp.items()],'grouped':{f+':'+c:pack([r for r in res if r['family']==f and r['cat']==c]) for f in seeds for c in ('reaction','special')},'overall':{c:pack([r for r in res if r['cat']==c]) for c in ('reaction','special')}}
Path('/tmp/r1-targeted-diagnostic.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in out.items() if k!='transition_counts'},ensure_ascii=False,indent=2))
