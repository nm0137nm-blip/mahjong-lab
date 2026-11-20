"""R1 fixability experiment, only development data.
Preexisting 200-game training set plus group-excluded recent on-policy games.
No formal candidate selection or game-strength claim."""
import json,sys,math,collections,hashlib,os
from pathlib import Path
import numpy as np
import lightgbm as lgb
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
from rebuild_policy import get_rows, digest, EXPECTED
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
# Verify original matrices before any augmented fit.
assert [digest(X0,'<f8'),digest(groups0,'<i4'),digest(labels0,'<i4')]==list(EXPECTED['pure'][:3])
assert cat=='pure' and len(records)==2497
X=np.concatenate([X0,*[r['X'] for r in records]]);y=np.concatenate([labels0,*[r['labels'] for r in records]]);groups=groups0+[len(r['a']) for r in records]
w=np.concatenate([np.ones(len(X0)),np.full(len(X)-len(X0),4.)])
def fit(dest):
 model=lgb.LGBMRanker(objective='lambdarank',label_gain=list(range(21)),learning_rate=.05,n_jobs=3,random_state=259,verbosity=-1,lambdarank_truncation_level=5,**params)
 model.fit(X,y,group=groups,sample_weight=w)
 model.booster_.save_model(str(dest))
 return hashlib.sha256(dest.read_bytes()).hexdigest()
import shutil
dest=Path('/tmp/augmented-model');shutil.copytree(frozen,dest)
sha=fit(dest/'pure.lgb');assert sha==fit(Path('/tmp/pure-repeat.lgb')) and sha!=freeze['models']['pure']['model_hash']
manifest={'status':'frozen_development_candidate_not_formal','candidate':'pure_augmented_200_plus_24_v1','training_seeds':sorted(set.union(*all_seeds.values())),'training_old_decisions':len(old),'training_new_decisions':len(records),'training_matrix_sha256':digest(X,'<f8'),'training_labels_sha256':digest(y,'<i4'),'training_groups_sha256':digest(groups,'<i4'),'new_row_weight':4,'repeat_model_sha256':sha,'files':{k:hashlib.sha256((dest/(k+'.lgb')).read_bytes()).hexdigest() for k in ('pure','reaction','special')},'baseline_files':{k:freeze['models'][k]['model_hash'] for k in ('pure','reaction','special')},'code_sha':os.environ['GITHUB_SHA']}
assert all(manifest['files'][k]==manifest['baseline_files'][k] for k in ('reaction','special'))
(dest/'candidate.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
