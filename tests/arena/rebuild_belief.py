"""Reconstruct frozen belief models from training artifact IDs only.
Fail closed unless both complete rankers and both classifiers match frozen models.
No development, arena outcomes or final data is used to fit any model.
"""
import hashlib,json
from pathlib import Path
import numpy as np
import lightgbm as lgb
from sklearn.model_selection import GroupKFold
from rebuild_policy import load,MODEL_SHA
from policy_features import public_features
from belief_features import features,tile,aggregate
SHARDS=[
(14509506737,14508284908,14509860321,14509032691),
(14509084068,14509960724,14509158890,14509088902),
(14509438094,14509088835,14510085503,14509616515),
(14509576388,14508953910,14509815628,14510080330),
(14509334641,14510370934,14510565095,14510091746),
(14509906917,14510390791,14510222419,14509209829),
(14509433221,14508784762,14509647577,14510415688),
(14510570370,14509499456,14510605336,14509757579),
(14508978825,14510161142,14510325772,14509268372),
(14510376604,14510296932,14510296936,14509289463),
(14510990316,14510192619,14510695871,14509713449),
(14510278160,14510616796,14509958535,14510472346)]
EXPECTED={'t':'4b6325559cbcf5fe45145eccfd938d0e68c2c5e2bc1de9985378fae2cb2e5f0a','r':'1028569ef3889c8b86c1085fecd3fe8789ec284a5b56b9a2cae6d946c8e98fa9','learned':'b10b2b7f8d772e37a459695984eb8abed075c760cc5c0e3e9fafee782d01fc2a','belief':'2fdd84eaf6f228b7156ea9380f939e1a09f89f9df9a32f80f3257be8bbd290a3'}
def main():
 root=Path('/tmp/belief-model');root.mkdir(exist_ok=True)
 arr={k:[] for k in ['tx','ty','tg','ti','ts','rx','ry','rg','ri','ro','rt','rs']}
 pure=[];seen=set();seeds=set()
 for qi,ri,mi,ti in SHARDS:
  qs=load(qi,'blind.json')['items'];refs={r['id']:r for r in load(ri,'reference.json')};teacher={r['id']:r for r in load(ti,'belief-teacher.json')};sm={v['prefix']:v['matchSeed'] for v in load(mi,'manifest.json')['matches']}
  assert len(sm)==10 and not seeds.intersection(sm.values());seeds.update(sm.values())
  assert len(refs)==len(qs)
  for x in qs:
   if x['phase']!='turn':continue
   match,idx=x['id'].rsplit('-',1);seed=sm[match];ident=f'{seed:010d}:{int(idx):04d}';assert ident not in seen;seen.add(ident)
   ts=sorted({v[:2] for a in x['actions'] if a['action']<37 for v in a['details']});own=x['scene']['ownSeat'];y=teacher[x['id']]
   assert {lab['seat'] for lab in y['opponents']}==set(range(4))-{own} and len(y['opponents'])==3
   for lab in y['opponents']:
    seat=lab['seat'];relative=(seat-own)%4;g,c,guard=features(x,seat,ts);ys=[int(lab['legalRon'][v]) for v in ts];assert not any(a and b for a,b in zip(guard,ys))
    for k,v in zip(['tx','ty','tg','ti','ts'],[g,lab['tenpai'],seed,ident,relative]):arr[k].append(v)
    for k,v in zip(['rx','ry','rg','ri','ro','rt','rs'],[c,ys,[seed]*len(ts),[ident]*len(ts),[relative]*len(ts),ts,guard]):arr[k].extend(v)
   if any(a['action']>=37 for a in x['actions']):continue
   cat,X,a=public_features(x);assert cat=='pure'
   ref=refs[x['id']];assert ref['model_sha256']==MODEL_SHA and set(a)=={j for j,v in enumerate(ref['q']) if v is not None}
   q=np.array([ref['q'][int(j)] for j in a],dtype=np.float64);loss=(q.max()-q)/max(1e-6,q.max()-q.min());label=np.maximum(0,np.floor(19*(1-loss))).astype(int)+(loss<1e-9)
   pure.append((ident,X,a,label))
  print('training shard',qi,flush=True)
 d={k:np.array(v,dtype=np.float32 if k in ('tx','rx') else None) for k,v in arr.items()}
 assert len(seeds)==120 and len(pure)==12198 and len(d['ty'])==40395 and len(d['ry'])==445449
 seedlist=sorted(seeds);folds=[set(np.array(seedlist)[j]) for _,j in GroupKFold(5).split(seedlist,groups=seedlist)]
 hashes={};oof={}
 def save(k,m):
  p=root/f'{k}.lgb';m.save_model(str(p));h=hashlib.sha256(p.read_bytes()).hexdigest()
  assert h==EXPECTED[k],(k,'frozen model mismatch',h);hashes[k]=h
 for k in ('t','r'):
  x=d[k+'x'];y=d[k+'y'];safe=d['rs'] if k=='r' else x[:,0]>0;guarantee=0 if k=='r' else 1
  assert np.all(y[safe]==guarantee);out=np.full(len(y),np.nan);count=np.zeros(len(y),np.int8)
  def fit(mask):
   m=lgb.LGBMClassifier(n_estimators=100,num_leaves=15,learning_rate=.05,min_child_samples=100,reg_lambda=8,n_jobs=3,random_state=20261119,verbosity=-1)
   m.fit(x[mask&~safe],y[mask&~safe]);return m
  for fold in folds:
   mask=np.isin(d[k+'g'],list(fold));assert set(d[k+'g'][mask]).isdisjoint(set(d[k+'g'][~mask]));p=fit(~mask).predict_proba(x[mask])[:,1];p[safe[mask]]=guarantee;out[mask]=p;count[mask]+=1
  assert np.isfinite(out).all() and np.all(count==1)
  save(k,fit(np.ones(len(y),bool)).booster_);oof[k]=out
 tm={(i,int(j)):float(p) for i,j,p in zip(d['ti'],d['ts'],oof['t'])};rm={(i,int(j),k):float(p) for i,j,k,p in zip(d['ri'],d['ro'],d['rt'],oof['r'])}
 assert len(tm)==len(d['ti']) and len(rm)==len(d['ri'])
 X=np.concatenate([v[1] for v in pure]);groups=np.array([len(v[2]) for v in pure]);rel=np.concatenate([v[3] for v in pure])
 B=np.concatenate([aggregate([tm[i,j] for j in (1,2,3)],[rm[i,j,tile(int(a))] for j in (1,2,3) for a in acts]) for i,_,acts,_ in pure])
 assert X.shape==(len(rel),105) and B.shape==(len(rel),10)
 for k,F in [('learned',X),('belief',np.column_stack([X,B]))]:
  m=lgb.LGBMRanker(objective='lambdarank',label_gain=list(range(21)),n_estimators=160,learning_rate=.05,num_leaves=31,min_child_samples=50,reg_lambda=2,n_jobs=3,random_state=259,verbosity=-1,lambdarank_truncation_level=5);m.fit(F,rel,group=groups);save(k,m.booster_)
 test=[int.from_bytes(hashlib.sha256(f'coach-belief-arena-v1:{i}'.encode()).digest()[:4],'little') or 1 for i in range(1,106)]
 prev={int.from_bytes(hashlib.sha256(f'coach-arena-v1:{i}'.encode()).digest()[:4],'little') or 1 for i in range(1,106)}
 assert len(set(test))==105 and not set(test)&(seeds|prev)
 (root/'freeze.json').write_text(json.dumps({'models':hashes,'train_matches':len(seeds),'train_pure':len(pure),'oof_folds':5,'training_seeds':sorted(seeds),'arena_seeds':test},indent=2))
 print('BELIEF_FREEZE',hashes,flush=True)
if __name__=='__main__':main()
