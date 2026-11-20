"""R1 fixability experiment, only development data.
Preexisting 200-game training set plus group-excluded recent on-policy games.
No formal candidate selection or game-strength claim."""
import json,sys,math,collections,hashlib,os
from pathlib import Path
import numpy as np
import lightgbm as lgb
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
from rebuild_policy import get_rows
from policy_features import public_features
cat=sys.argv[2];assert cat in ('pure','reaction','special')
root=Path(sys.argv[1]);paths=sorted(p.parent for p in root.rglob('manifest.json'));assert len(paths)==48
old=get_rows()[cat]
frozen=Path('/tmp/arena-model');freeze=json.loads((frozen/'freeze.json').read_text())
path=frozen/(cat+'.lgb');assert hashlib.sha256(path.read_bytes()).hexdigest()==freeze['models'][cat]['model_hash']
baseline=lgb.Booster(model_file=str(path))
X0=np.concatenate([v[0] for v in old]);labels0=np.concatenate([v[2] for v in old]);groups0=[len(v[1]) for v in old]
assert len(old)==freeze['models'][cat]['decisions'] and len(X0)==sum(groups0)
records=[];all_seeds=collections.defaultdict(set)
for p in paths:
 m=json.loads((p/'manifest.json').read_text());seed=m['seed'];fam=m['rows'][0]['opponentFamily']
 if m['rows'][0]['policy']!='learned':continue
 all_seeds[fam].add(seed)
 xs=json.loads((p/'public.json').read_text());qs=json.loads((p/'reference.json').read_text())
 assert len(xs)==len(qs)
 for x,q in zip(xs,qs):
  assert x['id']==q['id']
  c,F,a=public_features(x)
  if c!=cat:continue
  v=np.array([q['q'][int(i)] for i in a],float)
  assert np.isfinite(v).all() and len(v)>=2
  score=baseline.predict(F,num_threads=1);score[a==43]=1e6
  k=int(score.argmax());assert int(a[k])==q['chosen']
  gap=v.max()-v;relative=gap/max(1e-6,np.ptp(v))
  labels=np.maximum(0,np.floor(19*(1-relative))).astype(int)+(relative<1e-9)
  records.append(dict(seed=seed,family=fam,id=x['id'],X=F,a=a,q=v,relative=relative,labels=labels,base=k))
assert len(all_seeds)==2 and all(len(v)==12 for v in all_seeds.values())
params=dict(n_estimators=160 if cat=='pure' else 100,num_leaves=31 if cat=='pure' else 15,min_child_samples=50 if cat=='pure' else 30,reg_lambda=2 if cat=='pure' else 3)
out=[]
for fold in range(6):
 held={s for v in all_seeds.values() for i,s in enumerate(sorted(v)) if i%6==fold}
 train=[r for r in records if r['seed'] not in held];test=[r for r in records if r['seed'] in held]
 assert train and test and {r['seed'] for r in train}.isdisjoint({r['seed'] for r in test})
 X=np.concatenate([X0,*[r['X'] for r in train]]);y=np.concatenate([labels0,*[r['labels'] for r in train]])
 groups=groups0+[len(r['a']) for r in train]
 # Fixed 4x weight on each new on-policy candidate row, no fold-dependent optimization.
 w=np.concatenate([np.ones(len(X0)),np.full(len(X)-len(X0),4.)])
 model=lgb.LGBMRanker(objective='lambdarank',label_gain=list(range(21)),learning_rate=.05,n_jobs=3,random_state=259,verbosity=-1,lambdarank_truncation_level=5,**params)
 model.fit(X,y,group=groups,sample_weight=w)
 for r in test:
  pred=model.predict(r['X'],num_threads=1);assert np.isfinite(pred).all()
  pred[r['a']==43]=1e6;j=int(pred.argmax());k=r['base'];q=r['q'];d=r['relative'];raw=q.max()-q
  top=np.sort(q)[-2:]
  out.append(dict(seed=r['seed'],family=r['family'],id=r['id'],base=int(r['a'][k]),candidate=int(r['a'][j]),teacher=int(r['a'][q.argmax()]),raw0=float(raw[k]),raw1=float(raw[j]),rel0=float(d[k]),rel1=float(d[j]),top_margin=float(top[1]-top[0]),changed=j!=k))
 print('FOLD_COMPLETE',cat,fold+1,len(train),len(test),flush=True)
assert len(out)==len(records) and len({(r['seed'],r['id']) for r in out})==len(out)
def stats(rows):
 n=len(rows)
 if not n:return None
 return dict(n=n,matches=len({r['seed'] for r in rows}),raw_Q_loss_base=sum(r['raw0'] for r in rows)/n,raw_Q_loss_augmented=sum(r['raw1'] for r in rows)/n,relative_Q_loss_base=sum(r['rel0'] for r in rows)/n,relative_Q_loss_augmented=sum(r['rel1'] for r in rows)/n,top1_base=sum(r['raw0']<1e-9 for r in rows)/n,top1_augmented=sum(r['raw1']<1e-9 for r in rows)/n,changed=sum(r['changed'] for r in rows),improved=sum(r['raw1']<r['raw0']-1e-9 for r in rows),worsened=sum(r['raw1']>r['raw0']+1e-9 for r in rows))
result=dict(status='R1_augmented_development_diagnostic',category=cat,historical_decisions=len(old),recent_onpolicy_decisions=len(out),all=stats(out),family={f:stats([r for r in out if r['family']==f]) for f in all_seeds},margin={'numerically_close':stats([r for r in out if r['top_margin']<=5.7220458984375e-5]),'high':stats([r for r in out if r['top_margin']>5.7220458984375e-5])},scope='Historical 200-game public Q-label training plus recent 24 learned-focal games, six grouped folds. Old adapter teacher group labels retained; actual grouped action details not evaluated. Raw/relative Q not physical payoff, no claim of +15pt; no held-out formal game or candidate promotion.')
Path('/tmp/r1-augmentation-'+cat+'.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
