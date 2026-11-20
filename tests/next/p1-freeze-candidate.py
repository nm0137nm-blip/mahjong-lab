"""Development-only probability retraining: old 120 matches + 3 families.
Each outer development fold and each calibration fold are whole, distinct matches.
No reserved formal/outer seed is used. Historical labels lack new independent replay.
"""
import json,sys,collections,hashlib,math
from pathlib import Path
import numpy as np
import lightgbm as lgb
from sklearn.linear_model import LogisticRegression
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'phase0'))
from belief_features import features
from policy_features import norm
from rebuild_belief import SHARDS,EXPECTED
from rebuild_policy import load
from p1_metrics import binary_metrics,within_decision_auc,reliability
def extra(x,seat,tiles):
 s=x['scene'];r=s['rivers'][seat];d=r['discards'];vis=x['facts']['見え枚数'];seen=[norm(v['tile']) for v in d];hand=[norm(v['tile']) for v in d if not v['tsumogiri']]
 ev=s['publicEvents']; disc=[(i,z) for i,z in enumerate(ev) if z.get('種類')=='打牌' and z.get('席')==seat]
 assert len(disc)==len(d),(len(disc),len(d))
 seq=[]
 for j in range(1,7):
  if len(d)>=j:
   p=seen[-j];seq.extend([*map(int,[p[0]==u for u in 'mpsz']),int(p[1]),int(d[-j]['tsumogiri']),1])
  else:seq.extend([0]*7)
 g=[*seq,sum(z['ツモ切り'] for _,z in disc[-6:]),sum(p[0]=='z' for p in hand[:4]),sum(p[1] in '19' for p in hand[:4]),len(ev)-1-disc[-1][0] if disc else len(ev),*[sum(m[0]==u for m in r['melds']) for u in 'mpsz']]
 out=[]
 for t in tiles:
  z=norm(t);u=z[0];n=int(z[1]);adj=lambda k:u+str(n+k) if u!='z' and 1<=n+k<=9 else ''
  seq2=[]
  for j in range(1,7):
   if len(d)>=j:
    v=seen[-j];seq2.extend([int(v[0]==u),int(v[0]==u and v[0]!='z' and abs(int(v[1])-n)<=2),int(v in (adj(-3),adj(3)))])
   else:seq2.extend([0,0,0])
  # Visibility, sequential public evidence, and same-suit calls only.
  out.append([*g,*seq2,sum(v[0]==u for v in seen[:4]),sum(v[0]==u for v in hand[:4]),sum(v[0]==u for v in hand[-6:]),sum(v[0]==u and v[1] in '456' for v in hand[-6:]),sum(m[0]==u for m in r['melds']),*[int(vis.get(adj(k),0)==4) for k in (-3,-2,-1,1,2,3)]])
 return g,out
TX=[];RX=[];TY=[];RY=[];TG=[];RG=[];RI=[];SAFE=[];TF=[];RF=[];KEY=[];hist_seeds=set();development_seeds=set()
def add(x,labels,seed,family,ident):
 o=x['scene']['ownSeat'];tiles=sorted({v[:2] for a in x['actions'] if a['action']<37 for v in a['details']})
 assert set(z['seat'] for z in labels)==set(range(4))-{o}
 for lab in labels:
  seat=lab['seat'];g,c,safe=features(x,seat,tiles);eg,ec=extra(x,seat,tiles)
  y=int(lab['tenpai']);r=[int(lab['legalRon'][t]) for t in tiles]
  assert not (g[0] and not y) and all(not a or y for a in r) and not any(a and b for a,b in zip(r,safe))
  i=len(TY);TX.append(g+eg);TY.append(y);TG.append(seed);TF.append(family)
  RX.extend([v+u for v,u in zip(c,ec)]);RY.extend(r);RG.extend([seed]*len(r));RI.extend([i]*len(r));SAFE.extend(safe);RF.extend([family]*len(r));KEY.extend([(seed,ident,seat)]*len(r))
for qi,ri,mi,ti in SHARDS:
 qs=load(qi,'blind.json')['items'];teacher={r['id']:r for r in load(ti,'belief-teacher.json')};sm={v['prefix']:v['matchSeed'] for v in load(mi,'manifest.json')['matches']}
 assert len(sm)==10 and not hist_seeds.intersection(sm.values());hist_seeds.update(sm.values())
 for x in qs:
  if x['phase']!='turn':continue
  prefix,_=x['id'].rsplit('-',1);add(x,teacher[x['id']]['opponents'],sm[prefix],'historical',x['id'])
 print('HISTORICAL',qi,flush=True)
assert len(hist_seeds)==120 and len(TY)==40395 and len(RY)==445449
for root,fam_expected,n in [(Path(sys.argv[1]),None,48),(Path(sys.argv[2]),'self',24)]:
 paths=sorted(p.parent for p in root.rglob('manifest.json'));assert len(paths)==n
 for p in paths:
  m=json.loads((p/'manifest.json').read_text());seed=m['seed'];fam=m['rows'][0]['opponentFamily']
  assert m['split']=='development-only' and seed not in hist_seeds and seed not in development_seeds
  assert fam in ('s42','basic','self') and (fam_expected is None or fam==fam_expected)
  development_seeds.add(seed);x={z['id']:z for z in json.loads((p/'public.json').read_text())}
  for q in json.loads((p/'oracle.json').read_text()):add(x[q['id']],q['opponents'],seed,fam,q['id'])
assert len(development_seeds)==72
T=np.asarray(TX,np.float32);R=np.asarray(RX,np.float32);ty=np.asarray(TY,int);ry=np.asarray(RY,int);tg=np.asarray(TG,np.uint32);rg=np.asarray(RG,np.uint32);ri=np.asarray(RI,int);safe=np.asarray(SAFE,bool);tf=np.array(TF);rf=np.array(RF)
del TX,RX,TY,RY,TG,RG,RI,SAFE,TF,RF
assert np.isfinite(T).all() and np.isfinite(R).all()
assert np.array_equal(tg[ri],rg) and np.array_equal(tf[ri],rf)
known=T[:,0]>0
dev=tf!='historical';rd=rf!='historical';families=('s42','basic','self')
folds=[set() for _ in range(6)]
for f in families:
 seeds=sorted(set(tg[tf==f]));assert len(seeds)==24
 for k,s in enumerate(seeds):folds[k%6].add(s)
assert len(set.union(*folds))==72 and all(len(f)==12 for f in folds)
root=Path('/tmp/belief-model')
for k in ('t','r'):assert hashlib.sha256((root/(k+'.lgb')).read_bytes()).hexdigest()==EXPECTED[k]
T0=lgb.Booster(model_file=str(root/'t.lgb'));R0=lgb.Booster(model_file=str(root/'r.lgb'))
ft=T0.predict(T[:,:26],num_threads=3);ft[known]=1
fr=R0.predict(R[:,:57],num_threads=3);fr[safe]=0
# A single immutable calibration split: first stratified fold, 12 matches.
# Remaining 60 + historical 120 train the conditional Ron classifier.
cal_seeds=folds[0];rc=np.isin(rg,list(cal_seeds));rt=~rc
assert len(cal_seeds)==12 and len(development_seeds-cal_seeds)==60
m=rt&~safe&(ty[ri]==1);cc=rc&~safe&(ty[ri]==1)
X=R[:,:57]
assert set(rg[m]).isdisjoint(set(rg[cc]))
def logit(p):
 p=np.clip(p,1e-6,1-1e-6);return np.log(p/(1-p))
dest=Path('/tmp/p1-frozen-candidate');dest.mkdir()
import shutil
for k in ('t','r'):shutil.copyfile(root/(k+'.lgb'),dest/('frozen-'+k+'.lgb'))
def save(clf,name):
 b=clf.booster_ if hasattr(clf,'booster_') else clf
 p=dest/(name+'.lgb');b.save_model(str(p));return hashlib.sha256(p.read_bytes()).hexdigest()
def fit_cond():
 return lgb.LGBMClassifier(n_estimators=100,num_leaves=15,learning_rate=.05,min_child_samples=100,reg_lambda=8,n_jobs=3,random_state=20261119,verbosity=-1).fit(X[m],ry[m],sample_weight=np.where(rf[m]=='historical',1.,3.))
model=fit_cond();sha=save(model,'ron-conditional')
assert save(fit_cond(),'ron-repeat')==sha
(dest/'ron-repeat.lgb').unlink()
cal=LogisticRegression(C=1.,max_iter=500,random_state=261120).fit(logit(model.predict_proba(X[cc])[:,1])[:,None],ry[cc])
intercept=float(cal.intercept_[0]);coef=float(cal.coef_[0,0])
pred=.5*np.minimum(fr,ft[ri])+.5*cal.predict_proba(logit(model.predict_proba(X)[:,1])[:,None])[:,1]*ft[ri];pred[safe]=0
assert np.isfinite(pred).all() and np.all(pred<=ft[ri]+1e-12)
# Align exact public decision, opponent and candidate sequence used above.
dev_rows=np.flatnonzero(rd);offset=0;payment=[];ids=[];direct=[];honba=[]
for root in (Path(sys.argv[1]),Path(sys.argv[2])):
 for p in sorted(q.parent for q in root.rglob('manifest.json')):
  m=json.loads((p/'manifest.json').read_text());seed=m['seed']
  cases={x['id']:x for x in json.loads((p/'public.json').read_text())}
  for q in json.loads((p/'oracle.json').read_text()):
   x=cases[q['id']];tiles=q['tiles'];ix={t:[] for t in tiles}
   for lab in q['opponents']:
    for t in tiles:
     k=dev_rows[offset];offset+=1
     assert KEY[k]==(seed,q['id'],lab['seat']) and ry[k]==int(lab['legalRon'][t])
     payment.append(lab['baseLoss'][t] or 0);ids.append(k);ix[t].append(k)
   for t,ks in ix.items():
    assert len(ks)==3
    direct.append((seed,ks,q['allAcceptVisibleLoss'][t],x['scene']['honba']))
assert offset==len(dev_rows) and ids==dev_rows.tolist()
y=np.array(payment,float);X=R[rd,:57];g=rg[rd];fam=rf[rd];pp=pred[rd];p0=np.minimum(fr[rd],ft[ri[rd]]);truth=ry[rd]
assert np.array_equal(y>0,truth==1)
D=np.stack([np.concatenate([R[k,:57] for k in ks]+[np.array([h])]) for _,ks,_,h in direct])
lookup={k:i for i,k in enumerate(ids)};di=np.array([[lookup[k] for k in ks] for _,ks,_,h in direct]);dy=y[di].sum(axis=1);sy=np.array([v[2] for v in direct]);dg=np.array([v[0] for v in direct]);df=fam[di[:,0]]

# Payment labels require the independently audited 72 recent games (not historical).
train=~np.isin(g,list(cal_seeds));ct=~train;pos=train&(y>0);cp=ct&(y>0)
assert len(set(g[train]))==60 and len(set(g[ct]))==12
assert pos.sum()>100 and cp.sum()>100
def reg(X,y,objective='regression',alpha=None):
 kw=dict(n_estimators=35,num_leaves=7,min_child_samples=20,reg_lambda=10,learning_rate=.05,n_jobs=2,random_state=261120,verbosity=-1,objective=objective)
 if alpha is not None:kw['alpha']=alpha
 return lgb.LGBMRegressor(**kw).fit(X,y)
payment_model=reg(X[pos],y[pos]);save(payment_model,'payment-mean')
qp=[]
for k,a in enumerate((.1,.5,.9)):
 z=reg(X[pos],y[pos],'quantile',a);save(z,'payment-q'+str(k));qp.append(np.maximum(0,z.predict(X[cp])))
raw=np.sort(np.stack(qp,axis=1),axis=1)
# Calibrate an interval on the 12 held matches with equal total match weights,
# using nonnegative residual widening. No finite-sample coverage guarantee.
nonconf=np.maximum.reduce([raw[:,0]-y[cp],y[cp]-raw[:,2],np.zeros(cp.sum())])
cs=g[cp];w=np.array([1/np.sum(cs==v) for v in cs]);order=np.argsort(nonconf);cum=np.cumsum(w[order])/w.sum()
widen=float(nonconf[order[min(len(order)-1,np.searchsorted(cum,.8))]])
lo=np.maximum(0,raw[:,0]-widen);hi=raw[:,2]+widen
tr=~np.isin(dg,list(cal_seeds))
save(reg(D[tr],dy[tr]),'direct-exposure');save(reg(D[tr],sy[tr]),'direct-visible-settlement')
def hashfile(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
manifest={'status':'frozen_candidate_for_independent_review_not_released','version':'P1-visible-risk-v1','historical_training_seeds':sorted(hist_seeds),'recent_training_seeds':sorted(development_seeds-cal_seeds),'calibration_seeds':sorted(cal_seeds),'feature_contract':{'tenpai':26,'ron_payment':57,'aggregate':172,'feature_source_sha256':hashfile(Path(__file__).resolve().parents[1]/'arena'/'belief_features.py')},'mixture':.5,'ron_platt':{'coef':coef,'intercept':intercept,'clip':1e-6},'payment_interval':{'nominal':.8,'widen_points':widen,'calibration_positives':int(cp.sum()),'calibration_raw_coverage':float(np.mean((y[cp]>=raw[:,0])&(y[cp]<=raw[:,2]))),'calibration_widened_coverage':float(np.mean((y[cp]>=lo)&(y[cp]<=hi))),'scope':'reused development calibration only; no exchangeability or formal coverage guarantee'},'training_only_baseline':{'payment_mean':float(y[pos].mean()),'payment_median':float(np.median(y[pos])),'legal_ron_frequency':float(truth[train].mean())},'files':{p.name:hashfile(p) for p in sorted(dest.glob('*.lgb'))},'code_sha256':hashfile(__file__),'target':'current-visible-dora, no ura; legal opportunity exposure, not actual payment; separate all-accept visible settlement','release':'blocked','outer':'not acquired or authorized by this fit'}
assert manifest['files']['frozen-t.lgb']==EXPECTED['t'] and manifest['files']['frozen-r.lgb']==EXPECTED['r']
(dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False,indent=2))
